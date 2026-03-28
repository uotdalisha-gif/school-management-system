
// FIX missing React import to resolve namespace errors.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { StudentStatus, UserRole } from '../types';
import { parseStudentCSV } from '../utils/csvParser';
import { parseExcelFile } from '../utils/excelParser';
import ImportResultsModal from '../components/ImportResultsModal';
import ConfirmModal from '../components/ConfirmModal';
import ReportCardModal from '../components/ReportCardModal';
import { generateStudentListCSV } from '../utils/reportGenerator';

/**
 * COMPONENT: StudentModal
 * DESCRIPTION: Handles adding and editing student records.
 */
const StudentModal = ({ studentData, onClose }) => {
    // --- 1. STATE & DATA ---
    const { addStudent, updateStudent, levels } = useData();
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        dob: '',
        sex: 'Male',
        level: levels[0] || 'K1',
        status: StudentStatus.Active,
        phone: '',
        enrollmentDate: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        if (studentData) {
            setFormData({
                name: studentData.name,
                dob: studentData.dob,
                sex: studentData.sex,
                level: studentData.level,
                status: studentData.status,
                phone: studentData.phone,
                enrollmentDate: studentData.enrollmentDate,
            });
        }
    }, [studentData, levels]);

    /**
     * Handles changes to form input fields.
     */
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    /**
     * Validates and submits the student form data.
     * Handles both creation of new students and updates to existing ones.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSaving(true);

        if (!formData.name || !formData.sex) {
            setError('Please provide at least a Name and Gender.');
            setIsSaving(false);
            return;
        }

        // Logic Validation enroll before being born
        if (formData.dob && formData.enrollmentDate) {
            const birth = new Date(formData.dob);
            const enrollment = new Date(formData.enrollmentDate);
            if (enrollment < birth) {
                setError('Enrollment date cannot be earlier than the date of birth.');
                setIsSaving(false);
                return;
            }
        }

        let processedPhone = formData.phone?.trim() || '';
        if (processedPhone) {
            processedPhone = processedPhone.replace(/^(0?\+855)\s*/, '0');
            if (!processedPhone.startsWith('0') && processedPhone.replace(/\s/g, '').length >= 8) {
                processedPhone = '0' + processedPhone;
            }
        }

        const payload = {
            ...formData,
            phone: processedPhone
        };

        try {
            if (studentData) {
                await updateStudent({ ...studentData, ...payload });
            } else {
                await addStudent(payload);
            }
            onClose();
        } catch (err) {
            setError('Save failed network and storage.');
        } finally {
            setIsSaving(false);
        }
    };

    const labelStyle = "block text-sm font-semibold text-primary-900";
    const inputStyle = "mt-1 w-full px-3 py-2 bg-white border border-gray-400 rounded-md text-black shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all";

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-2 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl p-5 sm:p-8 w-full max-w-lg max-h-[95vh] overflow-y-auto">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6">{studentData ? 'Update Student Record' : 'Register New Student'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Full Name *</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputStyle} required />
                        </div>
                        <div>
                            <label className={labelStyle}>Date of Birth</label>
                            <input type="date" name="dob" value={formData.dob} onChange={handleChange} className={inputStyle} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Sex *</label>
                            <select name="sex" value={formData.sex} onChange={handleChange} className={inputStyle}>
                                <option>Male</option>
                                <option>Female</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>Phone Number</label>
                            <input type="text" name="phone" value={formData.phone} onChange={handleChange} className={inputStyle} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Study Status</label>
                            <select name="status" value={formData.status} onChange={handleChange} className={inputStyle}>
                                {Object.values(StudentStatus).map(status => <option key={status} value={status}>{status}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>Enrollment Date</label>
                            <input type="date" name="enrollmentDate" value={formData.enrollmentDate} onChange={handleChange} className={inputStyle} required />
                        </div>
                    </div>
                    {error && (
                        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-100 rounded-lg animate-in fade-in slide-in-from-top-1">
                            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p className="text-xs font-bold text-red-600 leading-tight">{error}</p>
                        </div>
                    )}
                    <div className="flex justify-end pt-6 space-x-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                        <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 shadow-lg shadow-primary-200 flex items-center">
                            {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>}
                            {studentData ? 'Update Record' : 'Save Student'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ITEMS_PER_PAGE = 20;

/**
 * PAGE: StudentsPage
 * DESCRIPTION: Main view for student management.
 */
const StudentsPage = () => {
    // --- 1. STATE & REFS ---
    const { students, staff, deleteStudent, highlightedStudentId, setHighlightedStudentId, addStudents, addClasses, addEnrollments, saveGradeBatch, loading, enrollments, classes, currentUser, levels, subjects, addLevel, addSubject, updateStudentsBatch, updateClass, updateClassesBatch, addStaff, addStaffBatch, timeSlots, addTimeSlot, addTimeSlotsBatch } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [selectedReportStudent, setSelectedReportStudent] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isDeletingId, setIsDeletingId] = useState(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importResults, setImportResults] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef(null);
    const highlightedRowRef = useRef(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    const isAdmin = currentUser?.role === UserRole.Admin;
    const isOffice = currentUser?.role === UserRole.OfficeWorker;

    // --- 2. MEMOIZED DATA ---
    const filteredStudents = useMemo(() => {
        let result = students;

        if (currentUser?.role === UserRole.Teacher) {
            // Find classes assigned to this teacher
            const teacherClasses = classes.filter(c => c.teacherId === currentUser.id);
            const teacherClassIds = new Set(teacherClasses.map(c => c.id));

            // Find students enrolled in those classes
            const teacherStudentIds = new Set(
                enrollments
                    .filter(e => teacherClassIds.has(e.classId))
                    .map(e => e.studentId)
            );

            result = result.filter(s => teacherStudentIds.has(s.id));
        } else if (!currentUser || isAdmin || isOffice) {
            // Keep all students
        } else {
            result = [];
        }

        if (searchTerm.trim()) {
            const lowerterm = searchTerm.toLowerCase();
            result = result.filter(s => 
                s.name.toLowerCase().includes(lowerterm) || 
                s.id.toString().toLowerCase().includes(lowerterm) ||
                (s.phone && s.phone.includes(lowerterm))
            );
        }

        return result;
    }, [students, currentUser, classes, enrollments, isAdmin, isOffice, searchTerm]);

    const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedStudents = filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // --- 3. SIDE EFFECTS ---
    useEffect(() => {
        if (highlightedStudentId) {
            const index = filteredStudents.findIndex(s => s.id === highlightedStudentId);
            if (index !== -1) {
                const targetPage = Math.floor(index / ITEMS_PER_PAGE) + 1;
                if (currentPage !== targetPage) setCurrentPage(targetPage);
                setTimeout(() => highlightedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            }
            const timer = setTimeout(() => setHighlightedStudentId(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [highlightedStudentId, setHighlightedStudentId, filteredStudents, currentPage]);

    // --- 4. SELECTION & ACTION HANDLERS ---

    /**
     * Opens the student creation/edit modal.
     */
    const handleOpenModal = (student = null) => {
        setEditingStudent(student);
        setIsModalOpen(true);
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedStudentIds);
        for (const id of ids) {
            await deleteStudent(id);
        }
        setSelectedStudentIds(new Set());
        setIsBulkDeleteModalOpen(false);
    };

    const toggleSelect = (id) => {
        const next = new Set(selectedStudentIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedStudentIds(next);
    };

    const toggleSelectAllOnPage = () => {
        const pageIds = paginatedStudents.map(s => s.id);
        const allSelected = pageIds.every(id => selectedStudentIds.has(id));
        const next = new Set(selectedStudentIds);
        if (allSelected) {
            pageIds.forEach(id => next.delete(id));
        } else {
            pageIds.forEach(id => next.add(id));
        }
        setSelectedStudentIds(next);
    };
    const handleDeleteRequest = (student) => {
        setStudentToDelete(student);
        setIsConfirmDeleteOpen(true);
    };

    const handleDelete = async (id) => {
        if (!id) return;
        try {
            setIsDeletingId(id);
            await deleteStudent(id);
        } catch (e) {
            console.error(e);
            alert('Deletion failed. Please try again.');
        } finally {
            setIsDeletingId(null);
            setStudentToDelete(null);
        }
    };

    // --- 5. DATA IMPORT / EXPORT HANDLERS ---

    /**
     * Generates and downloads a CSV template for student imports.
     */
    const handleDownloadTemplate = () => {
        const headers = ['Full Name', 'Sex', 'Date of Birth', 'Level', 'Phone Number', 'Enrollment Date', 'Status'];
        const blob = new Blob([headers.join(',')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'student_template.csv';
        link.click();
    };

    /**
     * Exports the current student list to a CSV file.
     */
    const handleExportCSV = () => {
        const csvContent = generateStudentListCSV(filteredStudents);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `student_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    /**
     * Processes a CSV or XLSX file upload for importing students.
     * Checks for duplicates before adding.
     */
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (file.name.endsWith('.csv')) {
            const { validStudents, errors } = parseStudentCSV(await file.text());
            const existingIdentifiers = new Set(students.map(s => s.name.trim().toLowerCase()));
            const nonDuplicateStudents = validStudents.filter(s => !existingIdentifiers.has(s.name.trim().toLowerCase()));
            if (nonDuplicateStudents.length > 0) {
                await addStudents(nonDuplicateStudents);
            }
            setImportResults({ successCount: nonDuplicateStudents.length, errorCount: errors.length, errors: errors });
            setIsImportModalOpen(true);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            try {
                const result = await parseExcelFile(file);

                // --- 1. SMART CLASS MATCHING & ID PREPARATION ---
                const classIDMap = {};
                const classesToAdd = [];
                const classesToUpdate = [];
                const newStaffMap = new Map(); 
                const newStaffToCreate = [];   
                const newSlotsToCreate = [];   
                let classNextIdx = Date.now();
                
                console.group('Excel Import Debug: Classes');
                if (result.classes && result.classes.length > 0) {
                    for (const impClass of result.classes) {
                        // --- Match Existing Class ONLY ---
                        const existing = classes.find(c => 
                            c.name.trim().toLowerCase() === impClass.name.trim().toLowerCase() && 
                            c.level.trim().toLowerCase() === impClass.level.trim().toLowerCase()
                        );
                        
                        if (existing) {
                            classIDMap[impClass.id] = existing.id;
                        }
                    }
                }
                
                // --- 2. SMART STUDENT MATCHING & ID PREPARATION ---
                const studentIDMap = {};
                const studentsToAdd = [];
                const studentsToUpdate = [];
                let lastStuId = students.map(s => parseInt(s.id.substring(1), 10)).filter(id => !isNaN(id)).reduce((max, curr) => Math.max(max, curr), 0);
                
                if (result.students && result.students.length > 0) {
                    for (const impStu of result.students) {
                        const existing = students.find(s => 
                            s.name.trim().toLowerCase() === impStu.name.trim().toLowerCase()
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
                    const mappedEnrollments = result.enrollments
                        .filter(enr => classIDMap[enr.classId]) // ONLY ENROLL IF CLASS ALREADY EXISTS
                        .map(enr => ({
                            studentId: studentIDMap[enr.studentId] || enr.studentId,
                            classId: classIDMap[enr.classId],
                            enrollmentDate: new Date().toISOString().split('T')[0],
                            status: 'Enrolled'
                        }))
                        .filter((enr, idx, self) => {
                            // 1. Check against the current state
                            const alreadyInSystem = enrollments.some(e => e.studentId === enr.studentId && e.classId === enr.classId);
                            if (alreadyInSystem) return false;

                            // 2. Check against previous items in the same import list (self deduplication)
                            const repeatInImport = self.findIndex(s => s.studentId === enr.studentId && s.classId === enr.classId) !== idx;
                            return !repeatInImport;
                        });
                    
                    if (mappedEnrollments.length > 0) await addEnrollments(mappedEnrollments);
                }
                
                // --- 4. SMART GRADE MATCHING ---
                if (result.grades && result.grades.length > 0) {
                    const mappedGrades = result.grades
                        .filter(grd => classIDMap[grd.classId])  // ONLY ADD GRADES IF CLASS ALREADY EXISTS
                        .map(grd => ({
                            ...grd,
                            studentId: studentIDMap[grd.studentId] || grd.studentId,
                            classId: classIDMap[grd.classId],
                            id: `grd_imp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                        }));
                    if(mappedGrades.length > 0) await saveGradeBatch(mappedGrades);
                    
                    // Check for untracked subjects and add them globally to Settings
                    const newSubjects = new Set();
                    result.grades.forEach(g => {
                        if (g.subject && !subjects.includes(g.subject)) newSubjects.add(g.subject);
                    });
                    newSubjects.forEach(sub => addSubject(sub));
                }

                // Check for untracked levels and add them globally to Settings
                if (result.classes && result.classes.length > 0) {
                    const newLevels = new Set();
                    result.classes.forEach(c => {
                        if (c.level && !levels.includes(c.level)) newLevels.add(c.level);
                    });
                    newLevels.forEach(lvl => addLevel(lvl));
                }
                
                setImportResults({
                    successCount: classesToAdd.length + studentsToAdd.length + newStaffToCreate.length + (result.grades?.length || 0),
                    errorCount: result.errors?.length || 0,
                    errors: result.errors?.map(err => ({ message: err })) || [],
                    message: `Import complete! Added ${newStaffToCreate.length} new staff, ${classesToAdd.length} new classes, ${studentsToAdd.length} new students, and ${result.grades?.length || 0} marks.`
                });
                setIsImportModalOpen(true);
            } catch (err) {
                 alert("Failed to parse Excel file: " + err.message);
            }
        }
        
        e.target.value = '';
    };

    /**
     * Returns Tailwind classes for student status badges based on their status.
     */
    const getStatusStyle = (status) => {
        switch (status) {
            case StudentStatus.Active: return 'bg-blue-50 text-blue-600 border-blue-100';
            case StudentStatus.Suspended: return 'bg-amber-50 text-amber-600 border-amber-100';
            case StudentStatus.Dropout: return 'bg-slate-100 text-slate-600 border-slate-200';
            default: return 'bg-gray-50 text-gray-500';
        }
    };

    // --- 6. RENDER ---
    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="w-full md:w-auto">
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Student Records</h1>
                    <p className="text-slate-500 mt-1">Manage enrollments and levels.</p>
                </div>
                
                {/* Search Bar */}
                <div className="flex-1 max-w-md w-full relative group">
                    <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input 
                        type="text" 
                        placeholder="Search by name, ID, or phone..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow shadow-sm placeholder:text-slate-400"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                    {selectedStudentIds.size > 0 && isAdmin && (
                        <button 
                            type="button" 
                            onClick={() => setIsBulkDeleteModalOpen(true)}
                            className="bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-lg hover:bg-red-100 text-sm font-bold flex items-center transition-all animate-in fade-in zoom-in duration-200"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Delete ({selectedStudentIds.size})
                        </button>
                    )}
                    {(isAdmin || isOffice) && (
                        <>
                            <button type="button" onClick={handleExportCSV} className="bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold flex items-center transition-colors">Export</button>
                            <button type="button" onClick={handleDownloadTemplate} className="bg-white text-emerald-600 border border-emerald-100 px-4 py-2 rounded-lg hover:bg-emerald-50 text-sm font-semibold flex items-center transition-colors">Template</button>
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold transition-all">Import CSV/XLSX</button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv, .xlsx, .xls" className="hidden" />
                            <button type="button" onClick={() => handleOpenModal()} className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-bold shadow-lg shadow-primary-200 transition-all">+ New Student</button>
                        </>
                    )}
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-4 w-10 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer w-4 h-4"
                                        checked={paginatedStudents.length > 0 && paginatedStudents.every(s => selectedStudentIds.has(s.id))}
                                        onChange={toggleSelectAllOnPage}
                                    />
                                </th>
                                <th className="px-4 py-4 w-16 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Gender</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Contact</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Class</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {paginatedStudents.map(student => {
                                const isHighlighted = student.id === highlightedStudentId;
                                const isDeleting = isDeletingId === student.id;
                                const isSelected = selectedStudentIds.has(student.id);

                                // For teachers, show only the class they teach. For admin/office, show all classes the student is enrolled in.
                                const studentEnrollments = enrollments.filter(e => e.studentId === student.id);
                                let displayClasses = [];
                                
                                if (currentUser?.role === UserRole.Teacher) {
                                    // Find enrollment in a class taught by THIS teacher
                                    const teacherClassEnrollment = studentEnrollments.find(e => {
                                        const cls = classes.find(c => c.id === e.classId);
                                        return cls && cls.teacherId === currentUser.id;
                                    });
                                    if (teacherClassEnrollment) {
                                        const cls = classes.find(c => c.id === teacherClassEnrollment.classId);
                                        if (cls) displayClasses.push(cls);
                                    }
                                } else {
                                    // Admin/Office: Show all classes
                                    displayClasses = studentEnrollments
                                        .map(e => classes.find(c => c.id === e.classId))
                                        .filter(Boolean);
                                }

                                return (
                                    <tr key={student.id} ref={isHighlighted ? highlightedRowRef : null} className={`transition-all duration-300 ${isHighlighted ? 'bg-primary-50 ring-2 ring-inset ring-primary-200' : isSelected ? 'bg-primary-50/40' : 'hover:bg-slate-50'}`}>
                                        <td className="px-4 py-4 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer w-4 h-4"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(student.id)}
                                            />
                                        </td>
                                        <td className="px-4 py-4 w-16 whitespace-nowrap text-sm font-medium text-slate-400">{student.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">{student.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{student.sex}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {student.phone ? (
                                                <a href={`tel:${student.phone}`} className="flex items-center gap-1.5 text-primary-600 hover:text-primary-800 font-medium transition-colors">
                                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                    {student.phone}
                                                </a>
                                            ) : (
                                                <span className="text-slate-300 italic">No contact</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {displayClasses.length > 0 ? (
                                                <div className="flex flex-wrap gap-2 items-center">
                                                    {displayClasses.slice(0, 3).map(c => {
                                                        const teacherName = c.teacherId ? (staff.find(s => s.id === c.teacherId)?.name || 'No Teacher') : 'No Teacher';
                                                        return (
                                                            <div key={c.id} className="flex flex-col bg-blue-50/50 border border-blue-100/60 rounded-md px-2.5 py-1.5 shadow-sm hover:shadow transition-shadow" title={`Teacher: ${teacherName}`}>
                                                                <span className="font-bold text-blue-900 text-xs leading-none mb-1">{c.name}</span>
                                                                <span className="text-[9px] text-blue-600/70 font-bold uppercase tracking-wider leading-none">{c.level}</span>
                                                            </div>
                                                        );
                                                    })}
                                                    {displayClasses.length > 3 && (
                                                        <details className="mt-1 group cursor-pointer relative z-40">
                                                            <summary className="text-[10px] font-bold text-slate-500 outline-none select-none flex items-center gap-1 hover:text-slate-700 w-fit bg-slate-50 border border-slate-200 px-2 py-1 rounded-md transition-colors shadow-sm">
                                                                <span>+{displayClasses.length - 3} More</span>
                                                                <svg className="w-3 h-3 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                            </summary>
                                                            <div className="absolute top-full left-0 mt-2 p-3 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-3 min-w-[140px] z-50">
                                                                {displayClasses.slice(3).map(studentClass => (
                                                                    <div key={studentClass.id} className="flex flex-col pl-2 border-l-2 border-primary-300">
                                                                        <span className="font-bold text-slate-700 text-xs">{studentClass.name}</span>
                                                                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                                                            <span>{studentClass.level}</span>
                                                                            <span className="text-slate-300">•</span>
                                                                            <span className="truncate max-w-[80px]">
                                                                                {studentClass.teacherId ? (staff.find(s => s.id === studentClass.teacherId)?.name || 'No Teacher') : 'No Teacher'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-1.5 opacity-90">
                                                    <span className="font-bold text-slate-500 flex items-center gap-1.5">
                                                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                        Not Enrolled
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 text-[10px] leading-tight font-bold rounded-full border ${getStatusStyle(student.status)}`}>
                                                {student.status.toUpperCase()}
                                            </span>
                                        </td>
                                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                                            <div className="flex items-center justify-end gap-3">
                                                 {(isAdmin || isOffice) && (
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleOpenModal(student)} 
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100"
                                                            title="Edit Student"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        {isAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteRequest(student)}
                                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 disabled:opacity-50"
                                                                title="Delete Student"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedReportStudent(student);
                                                        setIsReportModalOpen(true);
                                                    }}
                                                    className="px-3 py-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-all text-sm font-bold"
                                                >
                                                    Report Card
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredStudents.length === 0 && !loading && (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">No records found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredStudents.length > 0 && (
                    <div className="bg-slate-50/50 px-6 py-4 flex items-center justify-between border-t border-slate-100">
                        <p className="text-xs text-slate-500 font-medium">Page {currentPage} of {totalPages}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border bg-white border-slate-200 disabled:opacity-50">Prev</button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border bg-white border-slate-200 disabled:opacity-50">Next</button>
                        </div>
                    </div>
                )}
            </div>
            {isModalOpen && <StudentModal studentData={editingStudent} onClose={() => setIsModalOpen(false)} />}
            {isReportModalOpen && selectedReportStudent && (
                <ReportCardModal
                    student={selectedReportStudent}
                    onClose={() => setIsReportModalOpen(false)}
                />
            )}
            {isImportModalOpen && <ImportResultsModal results={importResults} onClose={() => setIsImportModalOpen(false)} />}
            <ConfirmModal 
                isOpen={isConfirmDeleteOpen} 
                onClose={() => setIsConfirmDeleteOpen(false)} 
                onConfirm={() => handleDelete(studentToDelete?.id)}
                title="Delete Student"
                message={`Are you sure you want to delete ${studentToDelete?.name}? This action cannot be undone.`}
            />
            {isBulkDeleteModalOpen && (
                <ConfirmModal
                    isOpen={isBulkDeleteModalOpen}
                    onClose={() => setIsBulkDeleteModalOpen(false)}
                    onConfirm={handleBulkDelete}
                    title="Delete Selected Students"
                    message={`Are you sure you want to permanently delete ${selectedStudentIds.size} selected students? This will also remove their enrollments, attendance, and grades.`}
                    confirmText={`Delete ${selectedStudentIds.size} Students`}
                    confirmColor="red"
                />
            )}
        </div>
    );
};

export default StudentsPage;
