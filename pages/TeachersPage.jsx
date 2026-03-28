
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { StaffRole, UserRole } from '../types';
import { generateStaffCSV } from '../utils/reportGenerator';
import { parseStaffCSV } from '../utils/csvParser';
import { parseExcelFile } from '../utils/excelParser';
import ImportResultsModal from '../components/ImportResultsModal';
import StaffPermissionModal from '../components/StaffPermissionModal';
import InviteStaffModal from '../components/InviteStaffModal';
import AllStaffPermissionModal from '../components/AllStaffPermissionModal';
import ConfirmModal from '../components/ConfirmModal';

/**
 * COMPONENT: StaffModal
 * DESCRIPTION: Handles adding and editing staff records.
 */
const StaffModal = ({ staffData, onClose }) => {
    // --- 1. STATE & DATA ---
    const { addStaff, updateStaff, subjects } = useData();
    const [formData, setFormData] = useState({
        name: '',
        role: '',
        subject: '',
        email: '',
        phone: '',
        hireDate: new Date().toISOString().split('T')[0],
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (staffData) {
            let initialEmail = '';
            let initialPhone = '';
            if (staffData.contact) {
                if (staffData.contact.includes('|')) {
                    const parts = staffData.contact.split('|').map(s => s.trim());
                    initialPhone = parts[0] || '';
                    initialEmail = parts[1] || '';
                } else if (staffData.contact.includes('@')) {
                    initialEmail = staffData.contact;
                } else {
                    initialPhone = staffData.contact;
                }
            }
            setFormData({
                name: staffData.name,
                role: staffData.role,
                subject: staffData.subject || '',
                email: initialEmail,
                phone: initialPhone,
                hireDate: staffData.hireDate,
            });
        }
    }, [staffData]);

    /**
     * Handles changes to staff form input fields.
     */
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    /**
     * Validates and submits the staff form data.
     * Handles both creation and updates.
     */
    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        const isTeacherRole = formData.role === StaffRole.Teacher || formData.role === StaffRole.AssistantTeacher;
        if (!formData.name || (!formData.email && !formData.phone)) {
            setError('Please fill out all required fields (Name and at least one contact).');
            return;
        }

        let contactString = '';
        if (formData.phone && formData.email) {
            contactString = `${formData.phone} | ${formData.email}`;
        } else if (formData.phone) {
            contactString = formData.phone;
        } else if (formData.email) {
            contactString = formData.email;
        }

        const payload = {
            name: formData.name,
            role: formData.role,
            contact: contactString,
            hireDate: formData.hireDate,
            subject: isTeacherRole ? (formData.subject || undefined) : undefined,
        }

        if (staffData) {
            updateStaff({ ...staffData, ...payload });
        } else {
            addStaff(payload);
        }
        onClose();
    };

    const inputClasses = "mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
    const labelClasses = "block text-sm font-medium text-primary-900";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-2 sm:p-4">
            <div className="bg-white rounded-lg shadow-xl p-5 sm:p-8 w-full max-w-lg max-h-[95vh] overflow-y-auto">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">{staffData ? 'Edit Staff Member' : 'Add New Staff Member'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className={labelClasses}>Full Name</label>
                        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className={inputClasses} required />
                    </div>
                    <div>
                        <label htmlFor="role" className={labelClasses}>Role</label>
                        <select name="role" id="role" value={formData.role} onChange={handleChange} className={inputClasses}>
                            {Object.values(StaffRole).map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="phone" className={labelClasses}>Phone Number</label>
                            <input type="tel" name="phone" id="phone" value={formData.phone} onChange={handleChange} className={inputClasses} placeholder="012-345-678" />
                        </div>
                        <div>
                            <label htmlFor="email" className={labelClasses}>Email Address</label>
                            <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} className={inputClasses} placeholder="email@school.com" />
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <div className="flex justify-end pt-4 space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">{staffData ? 'Update Staff Member' : 'Add Staff Member'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ITEMS_PER_PAGE = 20;

/**
 * PAGE: StaffPage
 * DESCRIPTION: Main view for staff management.
 */
const StaffPage = () => {
    // --- 1. STATE & DATA ---
    const { staff, deleteStaff, highlightedStaffId, setHighlightedStaffId, addStaffBatch, staffPermissions, currentUser } = useData();
    const isAdmin = currentUser?.role === UserRole.Admin;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [permissionStaff, setPermissionStaff] = useState(null);
    const [inviteStaff, setInviteStaff] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const highlightedRowRef = useRef(null);

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importResults, setImportResults] = useState(null);
    const fileInputRef = useRef(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [staffToDelete, setStaffToDelete] = useState(null);
    const [isAllPermissionModalOpen, setIsAllPermissionModalOpen] = useState(false);

    // --- 2. MEMOIZED DATA ---
    // Filter staff logic
    const filteredStaff = useMemo(() => {
        return staff.filter(s => {
            const matchesSearch = (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.contact || '').toLowerCase().includes(searchQuery.toLowerCase());

            const isTeaching = s.role === StaffRole.Teacher || s.role === StaffRole.AssistantTeacher;
            const matchesTab = activeTab === 'all' || s.role === activeTab || (activeTab === 'teaching' && isTeaching) || (activeTab === 'support' && !isTeaching);
            return matchesSearch && matchesTab;
        });
    }, [staff, searchQuery, activeTab]);

    const stats = useMemo(() => {
        const teaching = staff.filter(s => s.role === StaffRole.Teacher || s.role === StaffRole.AssistantTeacher).length;
        const support = staff.length - teaching;
        return { total: staff.length, teaching, support };
    }, [staff]);

    // --- 3. SIDE EFFECTS ---
    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, activeTab]);

    // Handle highlighting and page jumps
    useEffect(() => {
        if (highlightedStaffId) {
            const index = filteredStaff.findIndex(s => s.id === highlightedStaffId);
            if (index !== -1) {
                const targetPage = Math.floor(index / ITEMS_PER_PAGE) + 1;
                if (currentPage !== targetPage) {
                    setCurrentPage(targetPage);
                }

                setTimeout(() => {
                    highlightedRowRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                    });
                }, 100);
            }

            const timer = setTimeout(() => {
                setHighlightedStaffId(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [highlightedStaffId, setHighlightedStaffId, filteredStaff, currentPage]);

    // --- 4. ACTION HANDLERS ---
    /**
     * Opens the staff creation/edit modal.
     */
    const handleOpenModal = (staffMember = null) => {
        setEditingStaff(staffMember);
        setIsModalOpen(true);
    };

    // --- 5. IMPORT / EXPORT HANDLERS ---

    /**
     * Exports the current staff list to a CSV file.
     */
    const handleDownloadReport = () => {
        const csvData = generateStaffCSV(staff);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'staff_list.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    /**
     * Generates and downloads a CSV template for staff imports.
     */
    const handleDownloadTemplate = () => {
        const headers = ['Name', 'Role', 'Contact', 'Hire Date', 'Subject'];
        const csvContent = headers.join(',');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'staff_import_template.csv';
        link.click();
    };

    /**
     * Processes a CSV file upload for importing staff members.
     * Checks for duplicates based on name and contact.
     */
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        let validStaff = [];
        let errors = [];

        if (file.name.endsWith('.csv')) {
            const result = parseStaffCSV(await file.text());
            validStaff = result.validStaff;
            errors = result.errors;
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            try {
                const excelResult = await parseExcelFile(file);
                
                // Extract unique teachers from classes/sheets metadata
                const teacherNames = new Set();
                if (excelResult.classes && excelResult.classes.length > 0) {
                    excelResult.classes.forEach(c => {
                        if (c.teacherName && c.teacherName.trim()) {
                            teacherNames.add(c.teacherName.trim());
                        }
                    });
                }
                
                teacherNames.forEach(name => {
                    validStaff.push({
                        name: name,
                        role: StaffRole.Teacher,
                        contact: '',
                        hireDate: new Date().toISOString().split('T')[0],
                        status: 'Active'
                    });
                });
            } catch (err) {
                console.error("Excel parse error:", err);
                alert("Failed to parse Excel file: " + err.message);
                return;
            }
        } else {
            alert("Please upload a CSV or Excel file.");
            return;
        }

        // --- Duplicate Checking ---
        // Identify uniqueness by Name + Contact
        const existingNames = new Set(staff.map(s => s.name.toLowerCase()));
        const existingFullIDs = new Set(staff.map(s => `${s.name.toLowerCase()}|${s.contact.toLowerCase()}`));

        const internalNewIdentifiers = new Set();
        const nonDuplicateStaff = [];
        const duplicateErrors = [];

        validStaff.forEach((s, idx) => {
            const id = `${s.name.toLowerCase()}|${s.contact.toLowerCase()}`;
            const alreadyExists = existingFullIDs.has(id) || (s.contact === '' && existingNames.has(s.name.toLowerCase()));
            
            if (alreadyExists || internalNewIdentifiers.has(id)) {
                duplicateErrors.push({
                    row: idx + 2,
                    message: `Staff member '${s.name}' ${s.contact ? `with contact '${s.contact}'` : ''} already exists and was skipped.`
                });
            } else {
                internalNewIdentifiers.add(id);
                nonDuplicateStaff.push(s);
            }
        });

        if (nonDuplicateStaff.length > 0) {
            await addStaffBatch(nonDuplicateStaff);
        }

        setImportResults({
            successCount: nonDuplicateStaff.length,
            errorCount: errors.length + duplicateErrors.length,
            errors: [...errors, ...duplicateErrors]
        });
        setIsImportModalOpen(true);
        e.target.value = ''; // Reset input
    };

    /**
     * Returns Tailwind classes for staff role badges based on their role.
     */
    const getRoleBadgeColor = (role) => {
        switch (role) {
            case StaffRole.Teacher: return 'bg-blue-100 text-blue-800';
            case StaffRole.AssistantTeacher: return 'bg-indigo-100 text-indigo-800';
            case StaffRole.OfficeWorker: return 'bg-orange-100 text-orange-800';
            case StaffRole.Guard: return 'bg-gray-100 text-gray-800';
            case StaffRole.Cleaner: return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    // Pagination calculations
    const totalPages = Math.ceil(filteredStaff.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedStaff = filteredStaff.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // --- 6. RENDER ---
    return (
        <div className="container mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Staff Management</h1>
                <div className="flex flex-wrap gap-2">
                    <button onClick={handleDownloadReport} className="bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold flex items-center transition-colors">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                        Export
                    </button>
                    <button onClick={handleDownloadTemplate} className="bg-white text-emerald-600 border border-emerald-100 px-4 py-2 rounded-lg hover:bg-emerald-50 text-sm font-semibold flex items-center transition-colors">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        Template
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold transition-all">Import CSV</button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv, .xlsx, .xls" className="hidden" />
                    <button onClick={() => handleOpenModal()} className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2 font-bold shadow-lg shadow-primary-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                        <span>Add Staff</span>
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Total Staff</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                    <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Teaching Staff</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.teaching}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                    <div className="p-3 bg-green-100 rounded-lg text-green-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Support Staff</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.support}</p>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row justify-between gap-4 overflow-hidden">
                <div className="flex flex-wrap bg-gray-100 p-1 rounded-lg w-full md:w-auto">
                    <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'all' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>All</button>
                    <button onClick={() => setActiveTab(StaffRole.Teacher)} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeTab === StaffRole.Teacher ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Teachers</button>
                    <button onClick={() => setActiveTab(StaffRole.AssistantTeacher)} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeTab === StaffRole.AssistantTeacher ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Assistants</button>
                    <button onClick={() => setActiveTab(StaffRole.OfficeWorker)} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeTab === StaffRole.OfficeWorker ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Office</button>
                    <button onClick={() => setActiveTab(StaffRole.Guard)} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeTab === StaffRole.Guard ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Guards</button>
                    <button onClick={() => setActiveTab(StaffRole.Cleaner)} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeTab === StaffRole.Cleaner ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Cleaners</button>


                    <div className="w-px bg-gray-300 mx-2 my-1"></div>

                    <button
                        onClick={() => setIsAllPermissionModalOpen(true)}
                        className="px-4 py-2 rounded-md text-sm font-semibold text-amber-600 hover:bg-white hover:shadow-sm transition-all flex items-center space-x-1"
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Permission History
                    </button>
                </div>
                <div className="relative flex-grow max-w-md">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                    </span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or contact..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    />
                </div>
            </div>

            {/* Staff Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedStaff.map(s => {
                                const isHighlighted = s.id === highlightedStaffId;
                                const todayDate = new Date().toISOString().split('T')[0];
                                const isOnLeave = staffPermissions?.some(p => p.staffId === s.id && p.startDate <= todayDate && p.endDate >= todayDate);

                                return (
                                    <tr
                                        key={s.id}
                                        ref={isHighlighted ? highlightedRowRef : null}
                                        className={`transition-colors duration-1000 ${isHighlighted ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
                                                    {s.name.charAt(0)}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                                        {s.name}
                                                        <span className={`w-2 h-2 rounded-full ${isOnLeave ? 'bg-amber-400' : 'bg-emerald-500'}`} title={isOnLeave ? 'On Leave' : 'Active'}></span>
                                                    </div>
                                                    <div className="text-xs text-slate-400 font-mono">
                                                        {s.id.length > 8 ? `CS-${s.id.slice(-6)}` : s.id}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(s.role)}`}>
                                                {s.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            <div className="flex flex-col gap-1">
                                                {(s.contact || '').includes('|') ? (
                                                    <>
                                                        <div className="flex items-center gap-1.5" title="Phone">
                                                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                            <span className="text-xs font-medium">{s.contact.split('|')[0].trim()}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5" title="Email">
                                                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                            <span className="text-xs font-medium">{s.contact.split('|')[1].trim()}</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-1.5">
                                                        {(s.contact || '').includes('@') ? (
                                                            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                        ) : (
                                                            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                        )}
                                                        <span>{s.contact || 'No contact'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(s.hireDate || s.joinedDate || new Date()).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end items-center gap-2">
                                                <button onClick={() => handleOpenModal(s)} className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg border border-transparent hover:bg-primary-50 transition-colors" title="Edit Staff">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                {isAdmin && (
                                                    <button onClick={() => { setStaffToDelete(s); setIsConfirmDeleteOpen(true); }} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg border border-transparent hover:bg-red-50 transition-colors" title="Delete Staff">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                )}

                                                {isAdmin && (
                                                    <details className="relative z-10 group" onBlur={(e) => {
                                                        // Close dropdown on blur
                                                        if (!e.currentTarget.contains(e.relatedTarget)) {
                                                            e.currentTarget.removeAttribute('open');
                                                        }
                                                    }}>
                                                        <summary className="cursor-pointer list-none ml-1">
                                                            <div className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-transparent transition-colors">
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                                                            </div>
                                                        </summary>
                                                        <div className="absolute right-0 bottom-full mb-2 w-48 bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-xl overflow-hidden py-1 z-[100] origin-bottom-right ring-1 ring-slate-900/5 transition-all">
                                                            {s.role !== StaffRole.Cleaner && (
                                                            <button onClick={() => setInviteStaff(s)} className="w-full flex items-center justify-start gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/80 transition-all">
                                                                <div className="bg-indigo-100/50 p-1.5 rounded-md text-indigo-500 shrink-0">
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                                                </div>
                                                                Invite User
                                                            </button>
                                                            )}
                                                            <div className="h-px bg-slate-100/80 mx-3 my-0.5"></div>
                                                            <button onClick={() => setPermissionStaff(s)} className="w-full flex items-center justify-start gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:text-amber-600 hover:bg-amber-50/80 transition-all">
                                                                <div className="bg-amber-100/50 p-1.5 rounded-md text-amber-500 shrink-0">
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                                                                </div>
                                                                Permissions
                                                            </button>
                                                        </div>
                                                    </details>
                                                )}
                                                </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredStaff.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                                        No staff members found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredStaff.length > 0 && (
                    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(startIndex + ITEMS_PER_PAGE, filteredStaff.length)}</span> of <span className="font-medium">{filteredStaff.length}</span> results
                                </p>
                            </div>
                            <div>
                                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="sr-only">Previous</span>
                                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="sr-only">Next</span>
                                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isModalOpen && <StaffModal staffData={editingStaff} onClose={() => setIsModalOpen(false)} />}
            {permissionStaff && <StaffPermissionModal staff={permissionStaff} onClose={() => setPermissionStaff(null)} />}
            {inviteStaff && <InviteStaffModal staff={inviteStaff} onClose={() => setInviteStaff(null)} />}
            {isImportModalOpen && <ImportResultsModal results={importResults} onClose={() => setIsImportModalOpen(false)} />}
            {isAllPermissionModalOpen && <AllStaffPermissionModal onClose={() => setIsAllPermissionModalOpen(false)} />}
            <ConfirmModal 
                isOpen={isConfirmDeleteOpen} 
                onClose={() => setIsConfirmDeleteOpen(false)} 
                onConfirm={() => { deleteStaff(staffToDelete?.id); setStaffToDelete(null); }}
                title="Remove Staff"
                message={`Are you sure you want to remove ${staffToDelete?.name} from the system? This will also remove their access to the system.`}
            />
        </div>
    );
};

export default StaffPage;
