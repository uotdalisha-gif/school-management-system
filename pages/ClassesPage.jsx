import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { StaffRole, UserRole } from '../types';
import ClassModal from '../components/ClassModal';
import { generateSingleClassCSV, generateBulkClassCSV } from '../utils/reportGenerator';
import { parseClassCSV } from '../utils/csvParser';
import { parseExcelFile } from '../utils/excelParser';
import ImportResultsModal from '../components/ImportResultsModal';
import ConfirmModal from '../components/ConfirmModal';
import { LevelManager, SessionManager, SubjectManager } from '../components/ClassAcademicConfig';

/**
 * PAGE: ClassesPage
 * DESCRIPTION: Handles class management, scheduling, and enrollment.
 * LOCATION: /classes
 */
const ClassesPage = () => {
    // --- 1. GLOBAL DATA & STATE ---
    const { classes, staff, students, timeSlots, levels, deleteClass, addClasses, addStudents, addEnrollments, saveGradeBatch, highlightedClassId, setHighlightedClassId, enrollments, currentUser, addStaffBatch, updateClassesBatch, updateStudentsBatch, addTimeSlotsBatch } = useData();
    const isAdmin = currentUser?.role === UserRole.Admin;
    const isOffice = currentUser?.role === UserRole.OfficeWorker;

    // --- 2. LOCAL UI STATE ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const highlightedRowRef = useRef(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [classToDelete, setClassToDelete] = useState(null);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [expandedClassId, setExpandedClassId] = useState(null);

    // --- Bulk Selection State ---
    const [selectedClassIds, setSelectedClassIds] = useState(new Set());

    // --- Filter State ---
    const [selectedLevel, setSelectedLevel] = useState('all');
    const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);
    const [selectedTime, setSelectedTime] = useState('all');
    const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false);
    const teacherDropdownRef = useRef(null);

    const confirmDelete = async () => {
        if (classToDelete) {
            try {
                await deleteClass(classToDelete.id);
                setSelectedClassIds(prev => {
                    const next = new Set(prev);
                    next.delete(classToDelete.id);
                    return next;
                });
                setClassToDelete(null);
                setIsConfirmDeleteOpen(false);
            } catch (error) {
                console.error("Failed to delete class:", error);
            }
        }
    };

    // --- Import State ---
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importResults, setImportResults] = useState(null);
    const fileInputRef = useRef(null);

    // --- 3. DERIVED DATA (MEMOIZED) ---
    const availableTeachers = useMemo(() => staff.filter(s => s.role === StaffRole.Teacher), [staff]);
    const allSessionLabels = useMemo(() => timeSlots.map(s => s.time), [timeSlots]);

    // --- 4. SIDE EFFECTS ---

    // Close teacher dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (teacherDropdownRef.current && !teacherDropdownRef.current.contains(event.target)) {
                setIsTeacherDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Effect for highlighting row from global search
    useEffect(() => {
        if (highlightedClassId) {
            highlightedRowRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
            const timer = setTimeout(() => {
                setHighlightedClassId(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [highlightedClassId, setHighlightedClassId]);

    // --- 5. MODAL HANDLERS ---
    /**
     * Opens the class creation/edit modal.
     */
    const handleOpenModal = (e, classData = null) => {
        if (e) e.stopPropagation();
        setEditingClass(classData);
        setIsModalOpen(true);
    };

    /**
     * Closes the class modal and resets editing state.
     */
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingClass(null);
    };

    const filteredClasses = useMemo(() => {
        let baseClasses = classes;
        // Teachers only see their own classes; Admin and Office Workers see all
        if (currentUser?.role === UserRole.Teacher) {
            baseClasses = classes.filter(cls => cls.teacherId === currentUser.id);
        }
        return baseClasses
            .filter(cls => selectedLevel === 'all' || cls.level === selectedLevel)
            .filter(cls => selectedTeacherIds.length === 0 || selectedTeacherIds.includes(cls.teacherId))
            .filter(cls => selectedTime === 'all' || (cls.schedule && cls.schedule.includes(selectedTime)));
    }, [classes, selectedLevel, selectedTeacherIds, selectedTime, currentUser, enrollments]);

    // --- 6. SELECTION & ACTION HANDLERS ---
    /**
     * Toggles the selection of a class for bulk actions.
     */
    const handleToggleSelect = (classId) => {
        setSelectedClassIds(prev => {
            const next = new Set(prev);
            if (next.has(classId)) next.delete(classId);
            else next.add(classId);
            return next;
        });
    };

    /**
     * Selects or deselects all currently filtered classes.
     */
    const handleSelectAllInView = () => {
        if (selectedClassIds.size >= filteredClasses.length) {
            setSelectedClassIds(new Set());
        } else {
            setSelectedClassIds(new Set(filteredClasses.map(c => c.id)));
        }
    };

    /**
     * Exports selected classes to a CSV file.
     * Generates a single class roster or a bulk export depending on selection count.
     */
    const handleExportSelected = () => {
        const selectedList = filteredClasses.filter(c => selectedClassIds.has(c.id));
        if (selectedList.length === 0) return;

        let csvContent = "";
        let filename = "exported_classes.csv";

        if (selectedList.length === 1) {
            csvContent = generateSingleClassCSV(selectedList[0], staff, students, enrollments);
            filename = `${selectedList[0].name.replace(/\s+/g, '_')}_roster.csv`;
        } else {
            csvContent = generateBulkClassCSV(selectedList, staff, students, enrollments);
            filename = `bulk_class_export_${new Date().toISOString().split('T')[0]}.csv`;
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    /**
     * Deletes all currently selected classes after confirmation.
     */
    const handleDeleteSelected = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedClassIds.size} selected class${selectedClassIds.size > 1 ? 'es' : ''}? This action cannot be undone.`)) {
            return;
        }
        
        // Loop and delete each
        for (const id of selectedClassIds) {
            deleteClass(id);
        }
        
        setSelectedClassIds(new Set());
    };

    /**
     * Generates and downloads a CSV template for class imports.
     */
    const handleDownloadTemplate = () => {
        const headers = ['Class Name', 'Level', 'Teacher', 'Schedule'];
        const csvContent = headers.join(',');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'class_import_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    /**
     * Triggers the file input click for importing classes.
     */
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    /**
     * Processes a CSV or XLSX file upload for importing classes and students.
     */
    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.name.endsWith('.csv')) {
            const fileContent = await file.text();
            const { validClasses, errors } = parseClassCSV(fileContent, staff);

            if (validClasses.length > 0) {
                await addClasses(validClasses);
            }

            setImportResults({
                successCount: validClasses.length,
                errorCount: errors.length,
                errors: errors,
            });
            setIsImportModalOpen(true);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            try {
                const result = await parseExcelFile(file);
                
                // --- 1. SMART CLASS MATCHING & ID PREPARATION ---
                const classIDMap = {};
                const classesToAdd = [];
                const classesToUpdate = [];
                const newStaffToCreate = [];
                const newStaffMap = new Map(); // track staff to-be-created in this batch
                const newTimeSlotsToCreate = [];
                const newTimeSlotsMap = new Map(); // track time slots to-be-created
                let classNextIdx = Date.now();
                
                if (result.classes && result.classes.length > 0) {
                    for (const impClass of result.classes) {
                        // --- A. Resolve teacher first ---
                        const targetTeacherName = (impClass.teacherName || '').trim();
                        let teacher = null;
                        
                        if (targetTeacherName) {
                            // 1. Check existing staff
                            teacher = staff.find(s => {
                                const sName = (s.name || '').toLowerCase();
                                const tName = targetTeacherName.toLowerCase();
                                return (sName.length >= 5 && tName.includes(sName)) ||
                                       (tName.length >= 5 && sName.includes(tName));
                            });
                            
                            // 2. Check staff already queued for creation in this batch
                            if (!teacher) {
                                for (const [name, rec] of newStaffMap.entries()) {
                                    if (name === targetTeacherName.toLowerCase()) {
                                        teacher = rec;
                                        break;
                                    }
                                }
                            }
                            
                            // 3. Create if still not found
                            if (!teacher) {
                                const newStaffRecord = {
                                    id: `tr_imp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                                    name: targetTeacherName,
                                    role: StaffRole.Teacher,
                                    contact: '',
                                    hireDate: new Date().toISOString().split('T')[0],
                                    status: 'Active'
                                };
                                newStaffToCreate.push(newStaffRecord);
                                newStaffMap.set(targetTeacherName.toLowerCase(), newStaffRecord);
                                teacher = newStaffRecord;
                            }
                        }

                        // --- B. Match Class ---
                        const existing = classes.find(c => 
                            c.name.toLowerCase() === impClass.name.toLowerCase() && 
                            c.level.toLowerCase() === impClass.level.toLowerCase() &&
                            c.schedule.toLowerCase() === impClass.schedule.toLowerCase()
                        );
                        
                        if (existing) {
                            classIDMap[impClass.id] = existing.id;
                            // Update existing class with teacher if it was missing or matching by name
                            if (teacher && existing.teacherId !== teacher.id) {
                                classesToUpdate.push({ ...existing, teacherId: teacher.id });
                            }
                        } else {
                            const finalClassId = `class_imp_${classNextIdx++}`;
                            const newClass = { ...impClass, id: finalClassId, teacherId: teacher?.id || null };
                            classesToAdd.push(newClass);
                            classIDMap[impClass.id] = finalClassId;
                        }

                        // --- C. Auto-create Missing Time Slot (Session) ---
                        if (impClass.schedule && impClass.schedule.trim()) {
                            let rawTime = impClass.schedule.trim();
                            let scheduleType = 'weekday';
                            
                            const lowerSched = rawTime.toLowerCase();
                            if (lowerSched.startsWith('weekday ')) {
                                rawTime = rawTime.substring(8).trim();
                            } else if (lowerSched.startsWith('weekend ')) {
                                scheduleType = 'weekend';
                                rawTime = rawTime.substring(8).trim();
                            } else if (lowerSched.includes('weekend')) {
                                scheduleType = 'weekend';
                            }
                            
                            const existingSlot = timeSlots.find(ts => 
                                ts.type === scheduleType && 
                                ts.time.toLowerCase().replace(/\s/g, '') === rawTime.toLowerCase().replace(/\s/g, '')
                            );
                            
                            if (!existingSlot) {
                                const lookupKey = `${scheduleType}_${rawTime}`.toLowerCase();
                                if (!newTimeSlotsMap.has(lookupKey)) {
                                    const newSlot = { 
                                        id: `slot_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                                        type: scheduleType, 
                                        time: rawTime 
                                    };
                                    newTimeSlotsMap.set(lookupKey, newSlot);
                                    newTimeSlotsToCreate.push(newSlot);
                                }
                            }
                        }
                    }

                    if (newTimeSlotsToCreate.length > 0) await addTimeSlotsBatch(newTimeSlotsToCreate);
                    if (newStaffToCreate.length > 0) await addStaffBatch(newStaffToCreate);
                    if (classesToAdd.length > 0) await addClasses(classesToAdd);
                    if (classesToUpdate.length > 0) await updateClassesBatch(classesToUpdate);
                }
                
                // --- 2. SMART STUDENT MATCHING & ID PREPARATION ---
                const studentIDMap = {};
                const studentsToAdd = [];
                const studentsToUpdate = [];
                let lastStuId = students.map(s => parseInt(s.id.substring(1), 10)).filter(id => !isNaN(id)).reduce((max, curr) => Math.max(max, curr), 0);
                
                if (result.students && result.students.length > 0) {
                    for (const impStu of result.students) {
                        const existing = students.find(s => 
                            s.name.trim().toLowerCase() === impStu.name.trim().toLowerCase() &&
                            s.sex.toLowerCase() === impStu.sex.toLowerCase()
                        );
                        
                        if (existing) {
                            studentIDMap[impStu.id] = existing.id;
                            
                            // Patch missing info on existing student
                            let needsUpdate = false;
                            const updatedStu = { ...existing };
                            
                            if (!existing.phone && impStu.phone) { updatedStu.phone = impStu.phone; needsUpdate = true; }
                            if (!existing.dob && impStu.dob) { updatedStu.dob = impStu.dob; needsUpdate = true; }
                            if (!existing.level && impStu.level) { updatedStu.level = impStu.level; needsUpdate = true; }
                            if (existing.status !== impStu.status && impStu.status) { updatedStu.status = impStu.status; needsUpdate = true; }
                            
                            if (needsUpdate) {
                                studentsToUpdate.push(updatedStu);
                            }
                        } else {
                            const finalStuId = `s${++lastStuId}`;
                            const newStu = { ...impStu, id: finalStuId };
                            studentsToAdd.push(newStu);
                            studentIDMap[impStu.id] = finalStuId;
                        }
                    }
                    if (studentsToAdd.length > 0) await addStudents(studentsToAdd);
                    if (studentsToUpdate.length > 0) await updateStudentsBatch(studentsToUpdate);
                }
                
                // --- 3. SMART ENROLLMENT MATCHING ---
                if (result.enrollments && result.enrollments.length > 0) {
                    const mappedEnrollments = result.enrollments.map(enr => ({
                        studentId: studentIDMap[enr.studentId] || enr.studentId,
                        classId: classIDMap[enr.classId] || enr.classId,
                        enrollmentDate: new Date().toISOString().split('T')[0],
                        status: 'Enrolled'
                    })).filter(enr => {
                        return !enrollments.find(e => e.studentId === enr.studentId && e.classId === enr.classId);
                    });
                    
                    if (mappedEnrollments.length > 0) await addEnrollments(mappedEnrollments);
                }
                
                // --- 4. SMART GRADE MATCHING ---
                if (result.grades && result.grades.length > 0) {
                    const mappedGrades = result.grades.map(grd => ({
                        ...grd,
                        studentId: studentIDMap[grd.studentId] || grd.studentId,
                        classId: classIDMap[grd.classId] || grd.classId,
                        id: `grd_imp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                    }));
                    if (saveGradeBatch) await saveGradeBatch(mappedGrades);
                }
                
                setImportResults({
                    successCount: classesToAdd.length + studentsToAdd.length + newStaffToCreate.length + (result.grades?.length || 0),
                    errorCount: result.errors?.length || 0,
                    errors: result.errors?.map(e => ({ message: e })) || [],
                    message: `Import complete! Added ${newStaffToCreate.length} new staff, ${classesToAdd.length} new classes, ${studentsToAdd.length} new students, and ${result.grades?.length || 0} marks.`
                });
                setIsImportModalOpen(true);
            } catch (err) {
                 alert("Failed to parse Excel file: " + err.message);
            }
        }

        if (event.target) {
            event.target.value = '';
        }
    };

    /**
     * Retrieves the name of a teacher by their ID.
     */
    const getTeacherName = (teacherId, cls) => {
        const staffMember = staff.find(t => t.id === teacherId);
        // Fall back to the teacherName field on the class if staff not found or name is too short
        if (!staffMember || staffMember.name.length < 5) {
            return cls?.teacherName || 'Unassigned';
        }
        return staffMember.name;
    };

    /**
     * Toggles a teacher's inclusion in the filter criteria.
     */
    const handleTeacherSelect = (teacherId) => {
        setSelectedTeacherIds(prev =>
            prev.includes(teacherId)
                ? prev.filter(id => id !== teacherId)
                : [...prev, teacherId]
        );
    };

    // Group classes by session label
    const classesByTimeSlot = useMemo(() => {
        const grouped = {};
        allSessionLabels.forEach(label => {
            grouped[label] = [];
        });
        grouped['Other Schedule'] = []; // Fallback bucket for unmatched schedules

        filteredClasses.forEach(cls => {
            const matchedSlot = allSessionLabels.find(label => cls.schedule && cls.schedule.includes(label));
            if (matchedSlot) {
                grouped[matchedSlot].push(cls);
            } else {
                grouped['Other Schedule'].push(cls);
            }
        });
        return grouped;
    }, [filteredClasses, allSessionLabels]);

    const selectClasses = "block w-full pl-3 pr-10 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow";

    return (
        <div className="max-w-7xl mx-auto pb-10 space-y-6">

            {/* --- SECTION: HEADER AREA --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Classes</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage schedules, room assignments, and enrollment.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 w-[calc(100%+2rem)] md:w-auto">
                    {selectedClassIds.size > 0 && isAdmin && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDeleteSelected}
                                className="bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2 text-xs sm:text-sm font-bold shadow-sm shrink-0"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                <span>Delete ({selectedClassIds.size})</span>
                            </button>
                            <button
                                onClick={handleExportSelected}
                                className="bg-slate-800 text-white px-4 py-2.5 rounded-xl hover:bg-slate-900 transition-colors flex items-center gap-2 text-xs sm:text-sm font-bold shadow-sm shrink-0"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                                <span>Export ({selectedClassIds.size})</span>
                            </button>
                        </div>
                    )}
                    {isAdmin && (
                        <>
                            <button
                                onClick={handleDownloadTemplate}
                                className="bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 text-xs sm:text-sm font-bold shadow-sm shrink-0"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Template
                            </button>
                            <button
                                onClick={handleImportClick}
                                className="bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 text-xs sm:text-sm font-bold shadow-sm shrink-0"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                Import
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".csv, .xlsx, .xls"
                                className="hidden"
                            />
                            <button
                                onClick={() => setIsConfigOpen(!isConfigOpen)}
                                className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs sm:text-sm font-bold shadow-sm shrink-0 ${isConfigOpen ? 'bg-slate-800 text-white ring-2 ring-slate-100' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                </svg>
                                <span>{isConfigOpen ? 'Close Class Settings' : 'Class Settings'}</span>
                            </button>
                            <button
                                onClick={(e) => handleOpenModal(e)}
                                className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 text-xs sm:text-sm font-bold shadow-sm shrink-0"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                <span className="whitespace-nowrap">Add Class</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Academic Configuration Section */}
            {isConfigOpen && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <LevelManager />
                    <SessionManager />
                    <SubjectManager />
                </div>
            )}

            {/* --- SECTION: FILTER BAR --- */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-50 pb-3">
                    {(isAdmin || isOffice) ? (
                        <label className="flex items-center gap-3 cursor-pointer select-none px-3 py-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                            <input
                                type="checkbox"
                                checked={filteredClasses.length > 0 && selectedClassIds.size === filteredClasses.length}
                                onChange={handleSelectAllInView}
                                className="h-4.5 w-4.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-all"
                            />
                            <span className="text-sm font-bold text-slate-700">Select All</span>
                        </label>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                             <span className="text-sm font-bold text-slate-700">My Schedule</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showing:</span>
                         <span className="text-[10px] font-black text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">{filteredClasses.length} Classes</span>
                    </div>
                </div>

                <div className={`grid grid-cols-1 ${ (isAdmin || isOffice) ? 'sm:grid-cols-3' : 'sm:grid-cols-2' } gap-3`}>
                    <select value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)} className={`${selectClasses} h-11`}>
                        <option value="all">All Levels</option>
                        {levels.map(level => <option key={level} value={level}>{level}</option>)}
                    </select>

                    {(isAdmin || isOffice) && (
                        <div className="relative w-full" ref={teacherDropdownRef}>
                            <button onClick={() => setIsTeacherDropdownOpen(!isTeacherDropdownOpen)} className={`${selectClasses} h-11 text-left flex justify-between items-center bg-white`}>
                                <span className="truncate pr-2">
                                    {selectedTeacherIds.length === 0 ? 'All Teachers' : `${selectedTeacherIds.length} teachers selected`}
                                </span>
                                <svg className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200" style={{ transform: isTeacherDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                            {isTeacherDropdownOpen && (
                                <div className="absolute z-20 mt-1 w-full bg-white shadow-xl border border-slate-100 rounded-lg max-h-60 overflow-auto">
                                    <ul className="p-1">
                                        {availableTeachers.map(teacher => (
                                            <li key={teacher.id}>
                                                <label className="flex items-center gap-3 p-2.5 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                        checked={selectedTeacherIds.includes(teacher.id)}
                                                        onChange={() => handleTeacherSelect(teacher.id)}
                                                    />
                                                    <span className="text-sm text-slate-700">{teacher.name}</span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <select value={selectedTime} onChange={e => setSelectedTime(e.target.value)} className={selectClasses}>
                        <option value="all">All Times</option>
                        {allSessionLabels.map(label => <option key={label} value={label}>{label}</option>)}
                    </select>
                </div>
            </div>

            {/* --- SECTION: MAIN CLASSES LIST --- */}
            <div className="bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden">
                {allSessionLabels.length === 0 && classesByTimeSlot['Other Schedule']?.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-slate-500 italic">No sessions defined and no classes exist. Go to Class Settings to add school sessions (time slots).</p>
                    </div>
                ) : (
                    [...allSessionLabels, 'Other Schedule'].map(label => {
                        const slotClasses = classesByTimeSlot[label];

                        // Prevent undefined errors if it doesn't exist
                        if (!slotClasses) return null;

                        // Skip rendering empty time slots 
                        if (slotClasses.length === 0) return null;

                        return (
                            <div key={label} className="border-b last:border-b-0 border-slate-100">
                                {/* Time Slot Header */}
                                <div className="bg-slate-50/80 backdrop-blur-sm px-6 py-2.5 flex justify-between items-center border-y border-slate-100 sticky top-0 z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</h3>
                                    </div>
                                    {/* Class count badge removed */}
                                </div>

                                {/* Class Rows */}
                                <div className="divide-y divide-slate-100">
                                    {slotClasses.map(cls => {
                                        const isHighlighted = cls.id === highlightedClassId;
                                        const isSelected = selectedClassIds.has(cls.id);
                                        const teacherName = getTeacherName(cls.teacherId, cls);
                                        const studentCount = enrollments.filter(e => e.classId === cls.id).length;
                                        // Assume capacity 30 for visualization
                                        const capacity = 30;
                                        const percentage = Math.min((studentCount / capacity) * 100, 100);
                                        const isExpanded = expandedClassId === cls.id;
                                        const enrolledStudentsInClass = enrollments
                                            .filter(e => e.classId === cls.id)
                                            .map(e => students.find(s => s.id === e.studentId))
                                            .filter(Boolean)
                                            .sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));

                                        return (
                                            <div
                                                key={cls.id}
                                                ref={isHighlighted ? highlightedRowRef : null}
                                                className={`group transition-all duration-200 border-b border-slate-100 last:border-0 ${isSelected ? 'bg-emerald-50/50' : isHighlighted ? 'bg-yellow-50' : (isExpanded ? 'bg-slate-50/80 shadow-sm' : 'hover:bg-slate-50')}`}
                                            >
                                                <div 
                                                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer"
                                                    onClick={() => setExpandedClassId(isExpanded ? null : cls.id)}
                                                >
                                                {/* Left Section (Grouped Info) */}
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    {(isAdmin || isOffice) && (
                                                    <div className="flex items-center h-full">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => { e.stopPropagation(); handleToggleSelect(cls.id); }}
                                                            onClick={e => e.stopPropagation()}
                                                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                        />
                                                    </div>
                                                    )}

                                                    <div className="flex items-center gap-4">
                                                        <div className="p-2.5 bg-indigo-50 text-indigo-500 rounded-xl shrink-0 hidden sm:block border border-indigo-100">
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                        </div>
                                                        <div className="min-w-[140px] max-w-[200px]">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <p className="text-sm font-bold text-slate-900 truncate">{cls.name}</p>
                                                                <span className="sm:hidden inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                    {cls.level}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center text-xs text-slate-500">
                                                                <svg className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                                <span className="truncate">{teacherName}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="hidden sm:flex items-center gap-6 pl-4 border-l border-slate-200">
                                                        <span className="inline-flex items-center px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200 shadow-sm shrink-0">
                                                            {cls.level}
                                                        </span>

                                                        <div className="w-48 shrink-0">
                                                            <div className="flex justify-between text-xs mb-1.5">
                                                                <span className="text-slate-500 font-medium tracking-wide">Enrollment</span>
                                                                <span className={`font-bold ${percentage >= 100 ? 'text-red-600' : percentage > 80 ? 'text-amber-600' : 'text-slate-800'}`}>
                                                                    {studentCount} <span className={`${percentage >= 100 ? 'text-red-400' : 'text-slate-400'} font-medium`}>/ {capacity}</span>
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                                                                <div
                                                                    className={`h-2 rounded-full transition-all duration-1000 ease-out ${percentage >= 100 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : percentage > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                                                    style={{ width: `${percentage}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions - Admin and Office Workers */}
                                                {(isAdmin || isOffice) && (
                                                <div onClick={e => e.stopPropagation()} className={`hidden sm:flex items-center justify-end gap-1 w-auto pl-4 transition-opacity relative z-20 opacity-0 group-hover:opacity-100`}>
                                                    <button
                                                        onClick={(e) => handleOpenModal(e, cls)}
                                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                                        title="Edit Class"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    </button>
                                                    {isAdmin && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setClassToDelete(cls); setIsConfirmDeleteOpen(true); }}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                            title="Delete Class"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                                )}

                                                {/* Mobile Actions - Admin and Office Workers */}
                                                {(isAdmin || isOffice) && (
                                                <div onClick={e => e.stopPropagation()} className="sm:hidden flex items-center justify-end gap-3 mt-3 pt-3 border-t border-slate-50">
                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenModal(e, cls); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all">Edit</button>
                                                    {isAdmin && (
                                                        <button onClick={(e) => { e.stopPropagation(); setClassToDelete(cls); setIsConfirmDeleteOpen(true); }} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all">Delete</button>
                                                    )}
                                                </div>
                                                )}
                                                </div>

                                                {/* Expansion Panel */}
                                                {isExpanded && (
                                                    <div className="bg-white border-t border-slate-100 p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Enrolled Students ({studentCount})</h4>
                                                        {enrolledStudentsInClass.length > 0 ? (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                                {enrolledStudentsInClass.map(student => (
                                                                    <div key={student.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                                                        <div className="flex flex-col truncate pr-3">
                                                                            <span className="text-sm font-semibold text-slate-700 truncate">{student.name}</span>
                                                                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {student.id.startsWith('stu_') ? student.id.split('_').pop().substring(0,6) : student.id}</span>
                                                                        </div>
                                                                        {student.status === 'Active' ? (
                                                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.4)]" title="Active"></span>
                                                                        ) : (
                                                                           <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" title="Inactive"></span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center py-6">
                                                                <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                                </svg>
                                                                <p className="text-sm text-slate-500 font-medium">No students enrolled yet</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {isModalOpen && <ClassModal classData={editingClass} onClose={handleCloseModal} />}
            {isImportModalOpen && <ImportResultsModal results={importResults} onClose={() => setIsImportModalOpen(false)} />}
            <ConfirmModal 
                isOpen={isConfirmDeleteOpen} 
                onClose={() => setIsConfirmDeleteOpen(false)} 
                onConfirm={confirmDelete}
                title="Delete Class"
                message={`Are you sure you want to delete class ${classToDelete?.name}? All enrollments and marks for this class will be affected.`}
            />
        </div>
    );
};

export default ClassesPage;
