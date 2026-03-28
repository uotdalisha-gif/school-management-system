import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { UserRole, AttendanceStatus, Page } from '../../types';
import PerformanceChart from '../charts/PerformanceChart';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { AttendanceModal, GradesModal } from '../TeacherActionsModals';

// --- Shared Components ---
const Card = ({ title, children, className = "" }) => (
    <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm ${className}`}>
        <h3 className="text-lg font-bold text-slate-800 mb-4">{title}</h3>
        {children}
    </div>
);

// --- Admin Dashboard ---
export const AdminDashboard = ({ navigate }) => {
    const { students, staff, classes, enrollments, attendance, events, staffPermissions, dailyLogs, grades } = useData();

    // 1. Student Lifecycle & Attendance
    const today = new Date().toLocaleDateString('en-CA');
    const studentIds = new Set(students.map(s => s.id));
    const todaysAttendance = attendance.filter(a => a.date === today && studentIds.has(a.studentId));
    const uniquePresentStudents = new Set(todaysAttendance.filter(a => a.status === AttendanceStatus.Present).map(a => a.studentId));
    const totalMarkedToday = new Set(todaysAttendance.map(a => a.studentId)).size;
    const attendanceRate = totalMarkedToday > 0 ? Math.round((uniquePresentStudents.size / totalMarkedToday) * 100) : 0;

    const currentMonth = new Date().getMonth();
    const newAdmissions = students.filter(s => new Date(s.enrollmentDate).getMonth() === currentMonth).length;

    const enrollmentTrends = [
        { month: 'Oct', count: Math.max(0, students.length - 8) },
        { month: 'Nov', count: Math.max(0, students.length - 5) },
        { month: 'Dec', count: Math.max(0, students.length - 4) },
        { month: 'Jan', count: Math.max(0, students.length - 2) },
        { month: 'Feb', count: students.length },
        { month: 'Mar', count: students.length + newAdmissions }
    ];

    // 4. Staff Attendance
    const [pendingLeaves, setPendingLeaves] = useState(0);

    useEffect(() => {
        import('../../services/messageService').then(m => {
            m.fetchMessages('admin', true).then(msgs => {
                const count = msgs.filter(msg => msg.type === 'leave_request' && msg.metadata?.status === 'pending').length;
                setPendingLeaves(count);
            });
        });
    }, []);

    // Get unique ids of staff who are strictly on leave today
    const absentStaffIds = new Set(
        staffPermissions
            .filter(p => p.startDate <= today && p.endDate >= today)
            .map(p => p.staffId)
    );

    const absentTeachersCount = absentStaffIds.size;

    const staffStatuses = staff.map(s => {
        const leave = staffPermissions.find(p => p.staffId === s.id && p.startDate <= today && p.endDate >= today);
        return {
            ...s,
            status: leave ? 'On Leave' : 'Available',
            leaveDetails: leave ? leave.type : ''
        };
    });

    // 3. Operational Shortcuts
    const recentActivity = dailyLogs.slice(-5).reverse();
    const upcomingEvents = events.filter(e => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 3);

    // 4. Enhanced Analytics
    const classPerformance = classes.map(c => {
        const classStudents = enrollments.filter(e => e.classId === c.id).map(e => e.studentId);
        const classGrades = grades.filter(g => classStudents.includes(g.studentId));
        const avg = classGrades.length ? classGrades.reduce((sum, g) => sum + g.score, 0) / classGrades.length : 0;
        return { name: c.name, avg: avg.toFixed(1) };
    }).sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg)).slice(0, 3);

    const atRiskStudents = students.map(s => {
        const studentGrades = grades.filter(g => g.studentId === s.id);
        const avg = studentGrades.length ? studentGrades.reduce((sum, g) => sum + g.score, 0) / studentGrades.length : 10;
        return { name: s.name, avg: avg.toFixed(1) };
    }).filter(s => parseFloat(s.avg) < 5.0 && parseFloat(s.avg) > 0).slice(0, 5);

    return (
        <div className="space-y-6">
            {/* Top Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <Card className="!p-5 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0" title="">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Total Students</p>
                            <h3 className="text-3xl font-extrabold">{students.length}</h3>
                            <p className="text-blue-100 text-xs mt-2 font-medium">+{newAdmissions} this month</p>
                        </div>
                        <div className="p-3 bg-white/20 rounded-xl">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2" /></svg>
                        </div>
                    </div>
                </Card>
                <Card className="!p-5" title="">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Daily Attendance</p>
                            <h3 className="text-3xl font-extrabold text-slate-800">{attendanceRate}%</h3>
                            <p className="text-emerald-600 text-xs mt-2 font-semibold flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                2% vs yesterday
                            </p>
                        </div>
                        <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                </Card>
                <Card className="!p-5" title="">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Staff Availability</p>
                            <h3 className="text-3xl font-extrabold text-slate-800">{staff.length - absentTeachersCount} <span className="text-lg text-slate-400 font-medium">/ {staff.length}</span></h3>
                            <p className="text-amber-600 text-xs mt-2 font-semibold">{pendingLeaves} Leave requests pending</p>
                        </div>
                        <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" /></svg>
                        </div>
                    </div>
                </Card>
                <Card className="!p-5" title="">
                    <div className="flex justify-between items-start">
                        <div className="w-full">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Enrollment Trend</p>
                            <div className="h-16 w-[110%] -ml-2 -mb-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={enrollmentTrends}>
                                        <Area type="monotone" dataKey="count" stroke="#0ea5e9" fill="#e0f2fe" strokeWidth={3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <button onClick={() => navigate && navigate(Page.Students)} className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow hover:border-emerald-300 text-sm font-semibold text-slate-700 transition-all">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Add Student
                </button>
                <button onClick={() => navigate && navigate(Page.Messages)} className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow hover:border-purple-300 text-sm font-semibold text-slate-700 transition-all">
                    <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    Announcement
                </button>
                <button onClick={() => navigate && navigate(Page.Schedule)} className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow hover:border-orange-300 text-sm font-semibold text-slate-700 transition-all">
                    <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Schedule Event
                </button>
                <button onClick={() => {
                    sessionStorage.setItem('reports_initial_tab', 'export');
                    if (navigate) navigate(Page.Reports);
                }} className="flex items-center justify-center gap-2 p-3 bg-slate-900 text-white rounded-xl shadow-sm hover:bg-slate-800 text-sm font-semibold transition-all">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export Student Data
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card title="Average Performance by Level">
                        <PerformanceChart subjectFilter="All" />
                    </Card>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Top Performing Classes">
                            <div className="space-y-4">
                                {classPerformance.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">#{i + 1}</div>
                                            <span className="font-semibold text-slate-700">{c.name}</span>
                                        </div>
                                        <span className="font-bold text-slate-800">{c.avg} <span className="text-xs text-slate-400">Avg</span></span>
                                    </div>
                                ))}
                                {classPerformance.length === 0 && <p className="text-sm text-slate-400 italic">No grade data available</p>}
                            </div>
                        </Card>
                        <Card title="At-Risk Students (Avg < 5.0)">
                            <div className="space-y-3">
                                {atRiskStudents.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                            <span className="font-semibold text-slate-700 text-sm">{s.name}</span>
                                        </div>
                                        <span className="font-bold text-rose-600 text-sm">{s.avg}</span>
                                    </div>
                                ))}
                                {atRiskStudents.length === 0 && (
                                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600 text-sm font-medium flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                        No students currently at risk!
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>

                <div className="space-y-6">
                    <Card title="Upcoming Events">
                        <div className="space-y-4">
                            {upcomingEvents.map(e => (
                                <div key={e.id} className="flex gap-4">
                                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100 shrink-0">
                                        <span className="text-[10px] font-bold uppercase">{new Date(e.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                                        <span className="text-lg font-black leading-none">{new Date(e.date).getDate()}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">{e.title}</h4>
                                        <p className="text-xs text-slate-500 line-clamp-1">{e.description}</p>
                                    </div>
                                </div>
                            ))}
                            {upcomingEvents.length === 0 && (
                                <div className="flex gap-4 opacity-50 grayscale hover:grayscale-0 transition-all cursor-default" title="Example Event Placeholder">
                                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-100 rounded-xl text-slate-500 border border-slate-200 shrink-0">
                                        <span className="text-[10px] font-bold uppercase">Oct</span>
                                        <span className="text-lg font-black leading-none">15</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-600 text-sm">Staff Meeting (Example)</h4>
                                        <p className="text-xs text-slate-400 line-clamp-1">Discussing Q4 curriculum changes in the main hall.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card title="Recent Activity">
                        <div className="space-y-4">
                            {recentActivity.map(log => (
                                <div key={log.id} className="flex items-start gap-3">
                                    <div className={`mt-1 flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${log.type === 'Entry' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d={log.type === 'Entry' ? "M5 13l4 4L19 7" : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"} /></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-700"><span className="font-bold">{log.personName}</span> {log.type === 'Entry' ? 'checked in' : 'logged an issue'}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-slate-400 font-medium">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            {log.purpose && <span className="text-[10px] text-slate-500 font-medium truncate max-w-[150px]">— {log.purpose}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {recentActivity.length === 0 && (
                                <div className="flex items-start gap-3 opacity-50 grayscale cursor-default transition-all hover:grayscale-0" title="Example Activity Placeholder">
                                    <div className="mt-1 flex items-center justify-center w-6 h-6 rounded-full shrink-0 bg-slate-200 text-slate-500">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500"><span className="font-bold">System Admin</span> updated settings</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-slate-400 font-medium">08:00 AM</span>
                                            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">— Example activity log</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card title="Today's Staff Status">
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {staffStatuses.sort((a, b) => a.status === 'On Leave' ? -1 : 1).map(s => (
                                <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                                            {s.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-700 text-sm truncate">{s.name}</p>
                                            <p className="text-xs text-slate-400 truncate">{s.role}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.status === 'Available' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                                            {s.status}
                                        </span>
                                        {s.leaveDetails && <p className="text-[10px] text-amber-600 mt-1.5 font-semibold">{s.leaveDetails}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

// --- Teacher Dashboard ---
export const TeacherDashboard = () => {
    const { currentUser, classes, enrollments, students } = useData();
    const myClasses = classes.filter(c => c.teacherId === currentUser?.id);

    const [actionState, setActionState] = useState(null);

    const getStudentsForClass = (classId) => {
        const classEnrolls = enrollments.filter(e => e.classId === classId);
        return classEnrolls.map(e => students.find(s => s.id === e.studentId)).filter(Boolean);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800">My Classes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myClasses.map(c => {
                    const classEnrollments = enrollments.filter(e => e.classId === c.id);
                    return (
                        <Card key={c.id} title={c.name} className="hover:border-primary-300 transition-colors cursor-pointer">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-slate-500 mb-1">{c.schedule}</p>
                                    <p className="text-sm font-bold text-slate-700">{classEnrollments.length} Students Enrolled</p>
                                </div>
                                {classEnrollments.length > 0 && (
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 max-h-40 overflow-y-auto">
                                        <ul className="space-y-1">
                                            {classEnrollments.map(e => {
                                                const s = students.find(st => st.id === e.studentId);
                                                return s ? (
                                                    <li key={e.id} className="text-sm text-slate-600 flex items-center">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary-400 mr-2"></span>
                                                        {s.name}
                                                    </li>
                                                ) : null;
                                            })}
                                        </ul>
                                    </div>
                                )}
                                <div className="pt-2 flex space-x-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActionState({ type: 'attendance', classId: c.id }); }}
                                        className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-bold shadow hover:bg-primary-700 transition"
                                    >
                                        Attendance
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActionState({ type: 'grades', classId: c.id }); }}
                                        className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-bold shadow-sm border border-slate-200 hover:bg-slate-200 transition"
                                    >
                                        Grades
                                    </button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
                {myClasses.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400">You are not assigned to any classes yet.</p>
                    </div>
                )}
            </div>

            {actionState?.type === 'attendance' && (
                <AttendanceModal
                    classData={classes.find(c => c.id === actionState.classId)}
                    students={getStudentsForClass(actionState.classId)}
                    onClose={() => setActionState(null)}
                />
            )}

            {actionState?.type === 'grades' && (
                <GradesModal
                    classData={classes.find(c => c.id === actionState.classId)}
                    students={getStudentsForClass(actionState.classId)}
                    onClose={() => setActionState(null)}
                />
            )}
        </div>
    );
};

// --- Office Worker Dashboard ---
export const OfficeWorkerDashboard = () => {
    const { students } = useData();

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
                <Card title="Recent Registrations">
                    <div className="space-y-3">
                        {students.slice(-5).reverse().map(s => (
                            <div key={s.id} className="p-3 border border-slate-100 rounded-xl flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-bold text-slate-800">{s.name}</p>
                                    <p className="text-xs text-slate-500">Joined: {new Date(s.enrollmentDate).toLocaleDateString()}</p>
                                </div>
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase">New</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

// --- Guard Dashboard ---
export const GuardDashboard = () => {
    const { dailyLogs, addDailyLog, addIncidentReport, currentUser } = useData();
    const [logType, setLogType] = useState('Entry');
    const [personName, setPersonName] = useState('');
    const [purpose, setPurpose] = useState('');

    const handleLogSubmit = (e) => {
        e.preventDefault();
        if (!personName || !currentUser) return;
        addDailyLog({
            staffId: currentUser.id,
            type: logType,
            personName,
            purpose,
            timestamp: new Date().toISOString()
        });
        setPersonName('');
        setPurpose('');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
                <Card title="Daily Log Entry">
                    <form onSubmit={handleLogSubmit} className="space-y-4">
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setLogType('Entry')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${logType === 'Entry' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                Entry
                            </button>
                            <button
                                type="button"
                                onClick={() => setLogType('Exit')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${logType === 'Exit' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                Exit
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Person Name"
                            value={personName}
                            onChange={(e) => setPersonName(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all text-black"
                            required
                        />
                        <textarea
                            placeholder="Purpose of visit"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all min-h-[80px] text-black"
                        />
                        <button type="submit" className="w-full bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 transition-all">
                            Submit Log
                        </button>
                    </form>
                </Card>
                <button
                    onClick={() => {
                        const title = window.prompt('Incident Title:');
                        if (title && currentUser) {
                            addIncidentReport({
                                staffId: currentUser.id,
                                title,
                                description: window.prompt('Description:') || '',
                                severity: 'Medium',
                                timestamp: new Date().toISOString()
                            });
                        }
                    }}
                    className="w-full bg-red-50 text-red-600 border border-red-100 py-4 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center justify-center space-x-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Report Incident</span>
                </button>
            </div>
            <div className="lg:col-span-8">
                <Card title="Recent Activity Log">
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {dailyLogs.slice().reverse().map(log => (
                            <div key={log.id} className="flex items-start space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className={`p-2 rounded-xl ${log.type === 'Entry' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                    {log.type === 'Entry' ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-slate-800">{log.personName}</h4>
                                        <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-sm text-slate-500">{log.purpose}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

