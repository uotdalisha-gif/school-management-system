import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { StudentStatus, UserRole } from '../types';
import { AdminDashboard, TeacherDashboard, OfficeWorkerDashboard, GuardDashboard } from '../components/dashboards/RoleDashboards';
import PerformanceChart from '../components/charts/PerformanceChart';
import { CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';

// --- 1. IMPORTS & ICONS ---
const TrendUpIcon = () => <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>;
const TrendDownIcon = () => <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>;
const StaffIcon = () => <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2" /></svg>;
const ClassIcon = () => <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;

// --- 2. REUSABLE COMPONENTS ---

/**
 * A reusable KPI card component for displaying key metrics.
 */
const KpiCard = ({ title, value, trend, subValue, badge, icon }) => (
    <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-card hover:shadow-md transition-shadow duration-300 relative overflow-hidden group">
        <div className="flex justify-between items-start mb-1.5 sm:mb-2">
            <h3 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
            {icon}
        </div>
        <div className="flex items-baseline space-x-2">
            <p className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">{value}</p>
        </div>
        <div className="mt-3 flex items-center justify-between">
            {subValue && <p className="text-xs text-slate-400 font-medium">{subValue}</p>}
            {trend !== undefined && (
                <div className={`flex items-center space-x-1 text-xs font-bold ${trend >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'} px-2 py-1 rounded-full`}>
                    {trend >= 0 ? <TrendUpIcon /> : <TrendDownIcon />}
                    <span>{Math.abs(trend)}%</span>
                </div>
            )}
        </div>
    </div>
);

/**
 * A simple mini-calendar widget for the dashboard.
 */
const MiniCalendar = () => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const startDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
    const currentDay = today.getDate();

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const padding = Array.from({ length: startDay }, (_, i) => i);
    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-card h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700">Calendar</h3>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">{today.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                {weekDays.map(d => <div key={d} className="text-slate-400 font-medium">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {padding.map(i => <div key={`pad-${i}`} />)}
                {days.map(d => (
                    <div
                        key={d}
                        className={`
                            h-8 w-8 flex items-center justify-center rounded-full text-xs font-medium cursor-pointer transition-colors
                            ${d === currentDay ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}
                        `}
                    >
                        {d}
                    </div>
                ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 font-medium mb-2 uppercase">Today's Focus</p>
                <div className="space-y-2">
                    <div className="flex items-center text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></div>
                        <span className="text-slate-600 font-medium flex-1">Staff Meeting</span>
                        <span className="text-slate-400">14:00</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Displays the gender distribution of students using a pie chart.
 */
const GenderDistributionChart = ({ students }) => {
    const data = useMemo(() => {
        const males = students.filter(s => s.sex === 'Male').length;
        const females = students.filter(s => s.sex === 'Female').length;

        return [
            { name: 'Boys', value: males, color: '#3b82f6' },
            { name: 'Girls', value: females, color: '#ec4899' }
        ];
    }, [students]);

    return (
        <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

// --- 3. MAIN PAGE COMPONENT ---
const DashboardPage = ({ navigate }) => {
    // --- 3.1. STATE & DATA ---
    const { students, subjects, classes, staff, enrollments, currentUser } = useData();
    const [subjectFilter, setSubjectFilter] = useState('All');

    // --- 3.2. MEMOIZED DATA ---
    const activeStudents = useMemo(() => students.filter(s => s.status === StudentStatus.Active), [students]);

    const uniqueSubjects = useMemo(() => ['All', ...subjects], [subjects]);

    // --- 3.3. RENDER LOGIC ---
    const renderDashboard = () => {
        switch (currentUser?.role) {
            case UserRole.Admin:
                return <AdminDashboard navigate={navigate} />;
            case UserRole.Teacher:
                return <TeacherDashboard />;
            case UserRole.OfficeWorker:
                return <OfficeWorkerDashboard />;
            case UserRole.Guard:
                return <GuardDashboard />;

            default:
                return <AdminDashboard navigate={navigate} />;
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                        {currentUser?.role} Dashboard
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Welcome back, <span className="font-bold text-primary-600">{currentUser?.name}</span>.
                    </p>
                </div>
                <div className="text-sm font-medium text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>

            {renderDashboard()}
        </div>
    );
};

export default DashboardPage;
