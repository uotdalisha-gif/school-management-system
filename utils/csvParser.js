import { StudentStatus, StaffRole } from '../types';

/**
 * Normalizes a date string from various formats to 'YYYY-MM-DD'.
 * Returns an empty string if dateStr is empty (optional fields).
 */
const normalizeDate = (dateStr, fieldName) => {
    if (!dateStr) return '';
    
    const trimmed = dateStr.trim();
    if (!trimmed) return '';
    
    // Format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    
    // Format: DD/MM/YYYY or DD-MM-YYYY
    const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
        const day = dmy[1].padStart(2, '0');
        const month = dmy[2].padStart(2, '0');
        const year = dmy[3];
        return `${year}-${month}-${day}`;
    }

    // Fallback
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }
    
    throw new Error(`'${fieldName}' has invalid format. Use YYYY-MM-DD or DD/MM/YYYY.`);
};

/**
 * Parses a single CSV line handling quoted fields (e.g. "Smith, John").
 */
const parseCSVLine = (text) => {
    const result = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '"') {
            inQuotes = !inQuotes;
        } else if (text[i] === ',' && !inQuotes) {
            let field = text.substring(start, i).trim();
            // Remove surrounding quotes and unescape double quotes
            if (field.startsWith('"') && field.endsWith('"')) {
                field = field.substring(1, field.length - 1).replace(/""/g, '"');
            }
            result.push(field);
            start = i + 1;
        }
    }
    // Push the last field
    let field = text.substring(start).trim();
    if (field.startsWith('"') && field.endsWith('"')) {
        field = field.substring(1, field.length - 1).replace(/""/g, '"');
    }
    result.push(field);
    return result;
};

/**
 * Maps various common header names for students to the internal canonical key.
 */
const getCanonicalHeader = (header) => {
    const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (['name', 'studentname', 'fullname'].includes(h)) return 'name';
    if (['sex', 'gender'].includes(h)) return 'sex';
    if (['dob', 'dateofbirth', 'birthdate'].includes(h)) return 'dob';
    if (['level', 'grade', 'class', 'gradelevel'].includes(h)) return 'level';
    if (['phone', 'mobile', 'contact', 'phonenumber'].includes(h)) return 'phone';
    if (['enrollmentdate', 'joined', 'admissiondate', 'startdate'].includes(h)) return 'enrollmentDate';
    if (['status', 'studystatus'].includes(h)) return 'status';
    
    return null;
};

/**
 * Maps various common header names for staff to the internal canonical key.
 */
const getStaffCanonicalHeader = (header) => {
    const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (['name', 'fullname', 'staffname'].includes(h)) return 'name';
    if (['role', 'position', 'job'].includes(h)) return 'role';
    if (['contact', 'phone', 'email', 'mobile'].includes(h)) return 'contact';
    if (['joined', 'hiredate', 'startdate'].includes(h)) return 'hireDate';
    if (['subject', 'teaching'].includes(h)) return 'subject';
    
    return null;
};

/**
 * Maps various common header names for classes to the internal canonical key.
 */
const getClassCanonicalHeader = (header) => {
    const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (['name', 'classname', 'room', 'roomname'].includes(h)) return 'name';
    if (['level', 'grade', 'gradelevel'].includes(h)) return 'level';
    if (['teacher', 'teachername', 'instructor'].includes(h)) return 'teacher';
    if (['schedule', 'time', 'timeslot', 'session'].includes(h)) return 'schedule';
    
    return null;
};

/**
 * Parses a CSV string containing student data.
 * Validates required columns and data formats.
 */
export const parseStudentCSV = (csvContent) => {
    const validStudents = [];
    const errors = [];

    const content = csvContent.trim().replace(/^\uFEFF/, '');
    const lines = content.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');

    if (lines.length < 2) {
        errors.push({ row: 0, message: 'CSV file is empty or missing headers.' });
        return { validStudents, errors };
    }

    const headerLine = lines[0];
    const rawHeaders = parseCSVLine(headerLine);
    const headers = rawHeaders.map(h => getCanonicalHeader(h));
    
    const requiredColumns = ['name', 'sex'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));

    if (missingColumns.length > 0) {
        const niceNames = { name: 'Full Name', sex: 'Sex' };
        const missingNice = missingColumns.map(c => niceNames[c] || c);
        errors.push({ row: 1, message: `Missing required columns: ${missingNice.join(', ')}` });
        return { validStudents, errors };
    }

    const headerMap = {};
    headers.forEach((h, i) => { if (h) headerMap[h] = i; });

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const rowNumber = i + 1;
        const values = parseCSVLine(line);

        try {
            const getValue = (key) => {
                const idx = headerMap[key];
                return (idx !== undefined && values[idx]) ? values[idx] : '';
            };

            const name = getValue('name');
            const sexRaw = getValue('sex');
            const dobRaw = getValue('dob');
            const levelRaw = getValue('level');
            let phone = getValue('phone');
            if (phone) {
                phone = String(phone).replace(/^(0?\+855)\s*/, '0');
                if (!phone.startsWith('0') && phone.replace(/\s/g, '').length >= 8) {
                    phone = '0' + phone;
                }
            }
            const enrollmentDateRaw = getValue('enrollmentDate');
            const statusRaw = getValue('status');

            if (!name) throw new Error("'Name' is required.");
            if (!sexRaw) throw new Error("'Sex' is required.");
            
            let sex;
            const sexLower = sexRaw.toLowerCase().trim();
            if (['male', 'm'].includes(sexLower)) {
                sex = 'Male';
            } else if (['female', 'f'].includes(sexLower)) {
                sex = 'Female';
            } else {
                throw new Error(`'Sex' must be 'Male' or 'Female'.`);
            }

            const level = levelRaw || 'K1'; 
            const dob = normalizeDate(dobRaw, 'Date of Birth');
            const enrollmentDate = enrollmentDateRaw ? normalizeDate(enrollmentDateRaw, 'Enrollment Date') : new Date().toISOString().split('T')[0];

            let status = StudentStatus.Active;
            if (statusRaw) {
                const s = statusRaw.trim().toLowerCase();
                const matched = Object.values(StudentStatus).find(st => st.toLowerCase() === s);
                if (matched) {
                    status = matched;
                } else {
                     throw new Error(`Invalid 'Status'. Allowed: ${Object.values(StudentStatus).join(', ')}`);
                }
            }

            validStudents.push({
                name,
                sex,
                dob,
                phone,
                enrollmentDate,
                status,
            });
        } catch (e) {
            errors.push({ row: rowNumber, message: e.message || 'Unknown parsing error.' });
        }
    }

    return { validStudents, errors };
};

/**
 * Parses a CSV string containing staff data.
 * Supports shorthand role codes (T, A, C, G, O).
 */
export const parseStaffCSV = (csvContent) => {
    const validStaff = [];
    const errors = [];

    const content = csvContent.trim().replace(/^\uFEFF/, '');
    const lines = content.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');

    if (lines.length < 2) {
        errors.push({ row: 0, message: 'CSV file is empty or missing headers.' });
        return { validStaff, errors };
    }

    const rawHeaders = parseCSVLine(lines[0]);
    const headers = rawHeaders.map(h => getStaffCanonicalHeader(h));
    
    const requiredColumns = ['name', 'role', 'contact'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));

    if (missingColumns.length > 0) {
        const niceNames = { name: 'Name', role: 'Role', contact: 'Contact' };
        errors.push({ row: 1, message: `Missing required columns: ${missingColumns.map(c => niceNames[c] || c).join(', ')}` });
        return { validStaff, errors };
    }

    const headerMap = {};
    headers.forEach((h, i) => { if (h) headerMap[h] = i; });

    // Shorthand mapping for roles
    const shorthandMap = {
        'T': StaffRole.Teacher,
        'A': StaffRole.AssistantTeacher,
        'C': StaffRole.Cleaner,
        'G': StaffRole.Guard,
        'O': StaffRole.Office
    };

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const rowNumber = i + 1;
        const values = parseCSVLine(line);

        try {
            const getValue = (key) => {
                const idx = headerMap[key];
                return (idx !== undefined && values[idx]) ? values[idx] : '';
            };

            const name = getValue('name');
            const roleRaw = getValue('role');
            const contact = getValue('contact');
            const hireDateRaw = getValue('hireDate');
            const subject = getValue('subject');

            if (!name) throw new Error("'Name' is required.");
            if (!contact) throw new Error("'Contact' is required.");
            
            let role;
            const normalizedRole = roleRaw.trim().toUpperCase();

            // First check shorthand, then full name
            if (shorthandMap[normalizedRole]) {
                role = shorthandMap[normalizedRole];
            } else {
                const roleMatch = Object.values(StaffRole).find(r => r.toLowerCase() === roleRaw.trim().toLowerCase());
                if (roleMatch) {
                    role = roleMatch;
                } else {
                    throw new Error(`Invalid 'Role' "${roleRaw}". Use T (Teacher), A (Assistant), C (Cleaner), G (Guard), O (Office) or full names.`);
                }
            }

            const hireDate = hireDateRaw ? normalizeDate(hireDateRaw, 'Hire Date') : new Date().toISOString().split('T')[0];

            validStaff.push({
                name,
                role,
                contact,
                hireDate,
                subject: subject || undefined
            });
        } catch (e) {
            errors.push({ row: rowNumber, message: e.message || 'Unknown parsing error.' });
        }
    }

    return { validStaff, errors };
};

/**
 * Parses a CSV string containing class data.
 * Matches teacher names against the provided staff list to find IDs.
 */
export const parseClassCSV = (csvContent, staffList) => {
    const validClasses = [];
    const errors = [];

    const content = csvContent.trim().replace(/^\uFEFF/, '');
    const lines = content.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');

    if (lines.length < 2) {
        errors.push({ row: 0, message: 'CSV file is empty or missing headers.' });
        return { validClasses, errors };
    }

    const headerLine = lines[0];
    const rawHeaders = parseCSVLine(headerLine);
    const headers = rawHeaders.map(h => getClassCanonicalHeader(h));

    const requiredColumns = ['name', 'level', 'schedule'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));

    if (missingColumns.length > 0) {
        const niceNames = { name: 'Class Name', level: 'Level', schedule: 'Schedule' };
        const missingNice = missingColumns.map(c => niceNames[c] || c);
        errors.push({ row: 1, message: `Missing required columns: ${missingNice.join(', ')}` });
        return { validClasses, errors };
    }

    const headerMap = {};
    headers.forEach((h, i) => { if (h) headerMap[h] = i; });

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const rowNumber = i + 1;
        const values = parseCSVLine(line);

        try {
            const getValue = (key) => {
                const idx = headerMap[key];
                return (idx !== undefined && values[idx]) ? values[idx] : '';
            };

            const name = getValue('name');
            const level = getValue('level');
            const schedule = getValue('schedule');
            const teacherName = getValue('teacher');

            if (!name) throw new Error("'Class Name' is required.");
            if (!level) throw new Error("'Level' is required.");
            if (!schedule) throw new Error("'Schedule' is required.");

            let teacherId = '';
            if (teacherName) {
                const teacher = staffList.find(s => 
                    s.name.toLowerCase() === teacherName.toLowerCase() && 
                    (s.role === StaffRole.Teacher || s.role === StaffRole.AssistantTeacher)
                );
                if (teacher) {
                    teacherId = teacher.id;
                } else {
                    throw new Error(`Teacher '${teacherName}' not found.`);
                }
            }

            validClasses.push({
                name,
                level,
                schedule,
                teacherId,
            });
        } catch (e) {
            errors.push({ row: rowNumber, message: e.message || 'Unknown parsing error.' });
        }
    }

    return { validClasses, errors };
};
