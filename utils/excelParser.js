import * as XLSX from 'xlsx';

export const parseExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                let results = {
                    classes: [],
                    students: [],
                    enrollments: [],
                    grades: [],
                    errors: [],
                };

                // Scan all sheets for relevant data
                workbook.SheetNames.forEach(sheetName => {
                    const lSheetName = sheetName.toLowerCase().trim();
                    // Skip templates, guides, summaries, or purely numeric sheets (individual student reports)
                    if (lSheetName === 'guide' || lSheetName === 'classes' || lSheetName.includes('to update') || /^\d+$/.test(lSheetName)) {
                        console.log(`Skipping non-class sheet: ${sheetName}`);
                        return;
                    }
                    
                    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
                    console.log(`Processing sheet: ${sheetName}, Rows: ${sheet.length}`);
                    
                    // --- A. CLASS / CONTEXT SCAN ---
                    let level = '';
                    let room = '';
                    let time = '';
                    let teacherName = '';
                    let branch = 'Primary'; // Default

                    // 1. Try scanning top cells for Room 5, K1, Teacher names, etc.
                    for (let i = 0; i < Math.min(sheet.length, 10); i++) {
                        const row = sheet[i];
                        if (!row) continue;
                        for (let j = 0; j < row.length; j++) {
                            const val = String(row[j] || '').trim();
                            const nextVal = String(row[j+1] || '').trim();
                            const lowerVal = val.toLowerCase();
                            
                            if (!level && (lowerVal.startsWith('k') || lowerVal.startsWith('g')) && val.length <= 4) {
                                if (/\d/.test(val)) level = val.toUpperCase();
                            }
                            
                            if (!room && lowerVal.includes('room')) {
                                if (lowerVal === 'room' || lowerVal === 'room:' || lowerVal === 'room :') {
                                    if (nextVal && nextVal.length < 15) room = nextVal;
                                } else {
                                    room = val;
                                }
                            }
                            
                            if (!time && (lowerVal.includes(':') || lowerVal.includes('am') || lowerVal.includes('pm'))) {
                                if (val.length > 5 && val.length < 20 && /\d/.test(val)) time = val;
                            }
                            
                            if (!teacherName && (lowerVal.includes('teacher') || lowerVal.includes('tr:'))) {
                                if (lowerVal === 'teacher' || lowerVal === 'teacher:' || lowerVal === 'tr:') {
                                     if (nextVal && nextVal.length > 3) teacherName = nextVal;
                                } else {
                                    const parts = val.split(/[:\s]/);
                                    if (parts.length > 1 && parts[1] && parts[1].trim()) {
                                        teacherName = parts.slice(1).join(' ').trim();
                                    }
                                }
                            }
                        }
                    }

                    // 2. FALLBACK FROM SHEET NAME: Try decoding sheet name (e.g. "K1B" or "K2 - Room 5")
                    const sName = sheetName.toUpperCase();
                    if (!level) {
                        const levelMatch = sName.match(/[KG][1-9]/);
                        if (levelMatch) level = levelMatch[0];
                    }
                    if (!room) {
                        if (sName.includes('ROOM')) {
                            const roomMatch = sName.match(/ROOM\s*\d+/);
                            if (roomMatch) room = roomMatch[0];
                        } else if (level && sName.length <= 5) {
                            room = sName;
                        }
                    }
                    
                    // 3. FALLBACK FROM FILENAME or SHEET PARENTHESES: Look for teacher name (e.g. "Hong Leeheng")
                    if (!teacherName) {
                        const searchString = sheetName + ' ' + (file?.name || '');
                        const matches = [...searchString.matchAll(/\(([^)]+)\)/g)];
                        
                        for (const match of matches) {
                            if (match && match[1]) {
                                const candidate = match[1].trim();
                                // Simple heuristic: if it has a space and doesn't look like a level/room indicator like 'i' or 'ii'
                                if (candidate.includes(' ') && candidate.length > 5 && !/^[ivx]+$/i.test(candidate)) {
                                    teacherName = candidate;
                                    break;
                                }
                            }
                        }
                    }

                    // FINAL FALLBACK: If we still don't have a room but have a level, don't leave it blank
                    if (level && (!room || room.toLowerCase() === 'room' || room.toLowerCase() === 'room:')) {
                        room = sheetName.length < 15 ? sheetName : level;
                    }
                    
                    let currentSheetClassId = '';
                    if (level && room) {
                        let finalRoom = room;
                        if (!finalRoom.toLowerCase().includes('room')) finalRoom = `Room ${finalRoom}`;
                        
                        if (time && !time.toLowerCase().includes('weekday') && !time.toLowerCase().includes('weekend')) {
                            time = `Weekday ${time}`;
                        }
                        
                        const isDup = results.classes.some(c => 
                            c.name.toLowerCase() === finalRoom.toLowerCase() && 
                            c.level.toLowerCase() === level.toLowerCase()
                        );

                        currentSheetClassId = `cls_imp_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
                        if (!isDup) {
                            results.classes.push({ 
                                name: finalRoom, level, schedule: time, teacherName, branch, 
                                id: currentSheetClassId
                            });
                        } else {
                            const existing = results.classes.find(c => c.name.toLowerCase() === finalRoom.toLowerCase() && c.level.toLowerCase() === level.toLowerCase());
                            currentSheetClassId = existing.id;
                        }
                    }

                    // --- B. STUDENT LIST SCAN ---
                    let colMapping = { name: -1, sex: -1, phone: -1 };
                    let headerRowIdx = -1;
                    // Find header row by looking for 'name' column
                    for (let i = 0; i < Math.min(sheet.length, 30); i++) {
                        const row = sheet[i];
                        if (!row) continue;
                        
                        let foundName = false;
                        for (let j = 0; j < row.length; j++) {
                            const val = String(row[j] || '').trim().toLowerCase();
                            if (colMapping.name === -1 && (val === 'name' || val === 'student name' || val === 'student')) {
                                colMapping.name = j;
                                foundName = true;
                            }
                            if (colMapping.sex === -1 && (val === 'sex' || val === 'gender')) colMapping.sex = j;
                            if (colMapping.phone === -1 && (val.includes('phone') || val.includes('contact'))) colMapping.phone = j;
                        }
                        if (foundName) { 
                            headerRowIdx = i; 
                            break; 
                        }
                    }

                    // Track students added in this specific sheet
                    let sheetStudentIds = [];
                    
                    if (headerRowIdx !== -1) {
                        for (let i = headerRowIdx + 1; i < sheet.length; i++) {
                            const row = sheet[i];
                            if (!row || !row[colMapping.name]) {
                                // Break consecutive empty rows
                                if (i > headerRowIdx + 20) break;
                                continue;
                            }
                            
                            const nameVal = String(row[colMapping.name]).trim();
                            // Stop parsing if we hit an empty name, "name", "no", or just a number which usually indicates the end of a list.
                            if (!nameVal || nameVal.toLowerCase() === 'name' || nameVal.toLowerCase() === 'no' || (!isNaN(nameVal) && nameVal.length < 3)) {
                                continue;
                            }

                            // Avoid duplicates globally but keep track of ID for this sheet
                            let existingStudentInResults = results.students.find(s => s.name.toLowerCase() === nameVal.toLowerCase());
                            let studentId;
                            
                            if (existingStudentInResults) {
                                studentId = existingStudentInResults.id;
                                
                                let rawPhone = colMapping.phone >= 0 ? String(row[colMapping.phone] || '').trim() : '';
                                if (rawPhone && rawPhone !== 'undefined') {
                                    rawPhone = rawPhone.replace(/^(0?\+855)\s*/, '0');
                                    if (!rawPhone.startsWith('0') && rawPhone.replace(/\s/g, '').length >= 8) {
                                        rawPhone = '0' + rawPhone;
                                    }
                                }
                                
                                // Enrich existing student with phone if they were missing it from a previous sheet
                                if (!existingStudentInResults.phone && rawPhone && rawPhone !== 'undefined') {
                                    existingStudentInResults.phone = rawPhone;
                                }
                                // Include level if missing
                                if (!existingStudentInResults.level && level) {
                                    existingStudentInResults.level = level;
                                }
                            } else {
                                studentId = 'stu_imp_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 3);
                                
                                let rawPhone = colMapping.phone >= 0 ? String(row[colMapping.phone] || '').trim() : '';
                                if (rawPhone && rawPhone !== 'undefined') {
                                    rawPhone = rawPhone.replace(/^(0?\+855)\s*/, '0');
                                    if (!rawPhone.startsWith('0') && rawPhone.replace(/\s/g, '').length >= 8) {
                                        rawPhone = '0' + rawPhone;
                                    }
                                }

                                const studentObj = {
                                    id: studentId,
                                    name: nameVal,
                                    sex: (colMapping.sex >= 0 && String(row[colMapping.sex] || '').toUpperCase().startsWith('M')) ? 'Male' : 'Female',
                                    phone: rawPhone !== 'undefined' ? rawPhone : '',
                                    level: level || 'K1',
                                    dob: '2015-01-01',
                                    status: 'Active',
                                    enrollmentDate: new Date().toISOString().split('T')[0]
                                };
                                results.students.push(studentObj);
                            }
                            
                            if (currentSheetClassId) {
                                results.enrollments.push({ studentId: studentId, classId: currentSheetClassId });
                            }
                        }
                    }

                    // --- C. GRADES / MARKS SCAN ---
                    // Detect Subject and Exam type from sheet name or headers
                    let type = 'Daily'; // Default
                    if (sheetName.toLowerCase().includes('exam')) type = 'Exam';
                    if (sheetName.toLowerCase().includes('result')) type = 'Result';
                    
                    let term = 'Midterm';
                    if (sheetName.toLowerCase().includes('promotion')) term = 'Promotion';
                    
                    // Scan top rows for a dynamic term title (like 'MIDTERM DAILY SCORE SHEET')
                    for (let i = 0; i < Math.min(sheet.length, 6); i++) {
                        const row = sheet[i];
                        if (!row) continue;
                        for (let j = 0; j < row.length; j++) {
                            const val = String(row[j] || '').trim().toLowerCase();
                            if (val.includes('score sheet')) {
                                const cleanTitle = val.replace('score sheet', '').trim();
                                if (cleanTitle.length > 3) {
                                    // Capitalize words for clean term formatting
                                    term = cleanTitle.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                }
                            }
                        }
                    }

                    // Look for Subject names in headers
                    if (headerRowIdx !== -1) {
                        let headerRow = sheet[headerRowIdx];
                        
                        // Fix to prevent parser from locking onto the red "10 points" sub-row as headers
                        let pointsCount = 0;
                        for (let j = 0; j < headerRow.length; j++) {
                            if (String(headerRow[j]).toLowerCase().includes('point')) pointsCount++;
                        }
                        if (pointsCount >= 3 && headerRowIdx > 0) {
                            headerRowIdx = headerRowIdx - 1; // Shift up one row to the true subjects!
                            headerRow = sheet[headerRowIdx];
                        }

                        let subjectCols = [];
                        let lastSubject = '';
                        // Identify subject columns. Support merged multi-columns by appending numeric identifiers
                        for (let j = 0; j < headerRow.length; j++) {
                            const val = String(headerRow[j] || '').trim();
                            const lowerVal = val.toLowerCase();
                            
                            const isExcluded = ['no','name','sex','phone','total','avg','result','mention'].includes(lowerVal) 
                                                || lowerVal.includes('change') 
                                                || lowerVal.includes('stop')
                                                || lowerVal.includes('point');

                            if (val && !isExcluded) {
                                subjectCols.push({ col: j, name: val });
                                lastSubject = val;
                            } else if (!val && lastSubject && j > 3) {
                                // Cell is blank but follows a parsed subject; highly likely this is a merged cell dual-column system.
                                subjectCols.push({ col: j, name: `${lastSubject} Part 2` });
                                lastSubject = ''; // Prevent cascade linking
                            } else {
                                lastSubject = '';
                            }
                        }

                        if (subjectCols.length > 0) {
                            for (let i = headerRowIdx + 1; i < sheet.length; i++) {
                                const row = sheet[i];
                                if (!row || !row[colMapping.name]) continue;
                                const studentName = String(row[colMapping.name]).trim();
                                const student = results.students.find(s => s.name === studentName);
                                if (!student) continue;

                                subjectCols.forEach(sub => {
                                    const score = parseFloat(row[sub.col]);
                                    if (!isNaN(score)) {
                                        results.grades.push({
                                            id: `grd_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                                            studentId: student.id,
                                            classId: currentSheetClassId || results.classes[0]?.id || '',
                                            subject: sub.name,
                                            score: score,
                                            type: type === 'Result' ? 'Exam' : type, // Map Result to Exam for consistency
                                            term: term,
                                            date: new Date().toISOString().split('T')[0]
                                        });
                                    }
                                });
                            }
                        }
                    }
                });

                // Dedup classes globally
                let uniqueClasses = [];
                let classMap = {}; // Maps old duplicate ID to strict unique ID
                
                results.classes.forEach(c => {
                    const key = `${c.name.toLowerCase()}_${c.level.toLowerCase()}`;
                    const existing = uniqueClasses.find(uc => `${uc.name.toLowerCase()}_${uc.level.toLowerCase()}` === key);
                    if (existing) {
                        classMap[c.id] = existing.id;
                    } else {
                        classMap[c.id] = c.id;
                        uniqueClasses.push(c);
                    }
                });
                results.classes = uniqueClasses;

                // --- B2. ENROLLMENT CLEANUP ---
                // We already created enrollments per student per sheet in the main loop.
                // Here we just map them to the unified uniqueClasses if they changed.
                results.enrollments.forEach(enr => {
                    if (classMap[enr.classId]) enr.classId = classMap[enr.classId];
                });
                
                // --- C2. GRADE CLASS ID CLEANUP ---
                // Ensure grades point to the cleaned up class map
                results.grades.forEach(g => {
                   if(classMap[g.classId]) {
                       g.classId = classMap[g.classId];
                   } else {
                       g.classId = results.classes[0]?.id || '';
                   }
                });

                // --- FINAL DEDUPLICATION OF CLASSES AND ENROLLMENTS ---
                const validEnrollmentClassIds = new Set();
                results.enrollments = results.enrollments.filter((enr, idx, self) => {
                    const firstIdx = self.findIndex(e => e.studentId === enr.studentId && e.classId === enr.classId);
                    if (firstIdx === idx) {
                        validEnrollmentClassIds.add(enr.classId);
                        return true;
                    }
                    return false;
                });

                // ONLY KEEP classes that actually received at least one valid student enrollment
                results.classes = results.classes.filter(c => validEnrollmentClassIds.has(c.id));
                
                // Final unique classes
                // This block seems to be a duplicate of the earlier class deduplication,
                // but it's included in the user's snippet.
                // Re-deduplicate classes based on name+level after filtering by enrollments.
                const finalUniqueClasses = [];
                const finalClassMap = {};
                results.classes.forEach(c => {
                    const key = (c.name + '|' + c.level).toLowerCase();
                    if (!finalClassMap[key]) {
                        finalClassMap[key] = c.id;
                        finalUniqueClasses.push(c);
                    }
                });
                results.classes = finalUniqueClasses;


                console.log("Parse complete:", {
                    classes: results.classes.length,
                    students: results.students.length,
                    enrollments: results.enrollments.length,
                    grades: results.grades.length
                });

                resolve(results);
            } catch (err) {
                console.error("Excel parse error:", err);
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};
