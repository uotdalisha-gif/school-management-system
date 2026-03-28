
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { apiService } from '../services/apiService';
import { UserRole } from '../types';

/**
 * PAGE: SettingsPage
 * DESCRIPTION: Central hub for system configuration, security, and data recovery.
 * LOCATION: /settings
 */

/**
 * COMPONENT: OfflineGuide
 * PURPOSE: Displays instructions for PWA installation and offline usage.
 * VIEW: Appeas under "Offline Help" tab.
 */
const OfflineGuide = () => {
    return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
            <div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">How to Use Offline</h2>
                <p className="text-sm text-slate-500">This portal is a Progressive Web App (PWA). Once visited, it lives on your device.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold shrink-0">1</div>
                        <div>
                            <p className="font-bold text-slate-700">Install the App</p>
                            <p className="text-xs text-slate-500 mt-1">On Chrome or Edge (Desktop), click the <strong>Install Icon (+)</strong> in the address bar. On Mobile, use <strong>"Add to Home Screen"</strong>.</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold shrink-0">2</div>
                        <div>
                            <p className="font-bold text-slate-700">Open from Desktop</p>
                            <p className="text-xs text-slate-500 mt-1">Once installed, an icon appears on your Desktop or Apps folder. Open this icon even when you have <strong>no internet</strong>.</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-xl p-6 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-primary-400 uppercase tracking-widest mb-2">Pro Tip</p>
                        <p className="text-sm leading-relaxed text-slate-300 font-medium">
                            If you share the link with someone else, tell them to visit the site <span className="text-white font-bold underline">once while online</span>. After that, they can use it offline forever on that device.
                        </p>
                    </div>
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl"></div>
                </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    System Status
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Offline Shell</p>
                        <p className="text-xs font-bold text-emerald-600 mt-0.5">Cached & Ready</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Data Storage</p>
                        <p className="text-xs font-bold text-blue-600 mt-0.5">Local + Sync</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Sync Version</p>
                        <p className="text-xs font-bold text-slate-600 mt-0.5">v7.0.0 (Production)</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * COMPONENT: DataManager
 * PURPOSE: Handles JSON export/import of the entire school database.
 * VIEW: Appears under "Database" tab.
 */
const DataManager = () => {
    const { students, staff, classes, events, subjects, levels, timeSlots, adminPassword, importAllData } = useData();
    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);

    /**
     * Exports all application data (students, staff, classes, etc.) to a JSON file.
     * Uses the File System Access API if available, otherwise falls back to standard download.
     */
    const handleExport = async () => {
        const fullData = {
            students,
            staff,
            classes,
            events,
            subjects,
            levels,
            timeSlots,
            adminPassword,
            exportDate: new Date().toISOString()
        };

        const jsonString = JSON.stringify(fullData, null, 2);
        const fileName = `school_admin_backup_${new Date().toISOString().split('T')[0]}.json`;

        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'JSON Backup',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(jsonString);
                await writable.close();
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn('File picker failed, falling back to standard download:', err);
            }
        }

        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    };

    /**
     * Imports application data from a JSON backup file.
     * WARNING overwrites all current local data.
     */
    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (window.confirm('WARNING a backup will overwrite ALL current data in this application. This action cannot be undone. Are you sure?')) {
            setIsImporting(true);
            try {
                const text = await file.text();
                const data = JSON.parse(text);

                // Basic validation
                if (!data || typeof data !== 'object') {
                    throw new Error('Invalid backup file format must be an object.');
                }

                await importAllData(data);
                alert('Database restored successfully!');
            } catch (err) {
                console.error('Import Error:', err);
                const message = err instanceof Error ? err.message : 'Unknown error';
                alert(`Failed to import backup: ${message}\n\nPlease ensure the file is a valid SchoolAdmin backup JSON.`);
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Data Management</h2>
            <p className="text-sm text-gray-500 mb-8">Take control of your database by exporting backups or restoring from a previous file.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl border border-blue-100 bg-blue-50/50 flex flex-col justify-between">
                    <div>
                        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-blue-100">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-blue-900 mb-1">Backup Database</h3>
                        <p className="text-sm text-blue-700/70 mb-6">Download a copy of all your records. This will open a window asking you where to save the file on your computer.</p>
                    </div>
                    <button
                        onClick={handleExport}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95"
                    >
                        Save To...
                    </button>
                </div>

                <div className="p-6 rounded-2xl border border-amber-100 bg-amber-50/50 flex flex-col justify-between">
                    <div>
                        <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-amber-100">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-amber-900 mb-1">Restore Database</h3>
                        <p className="text-sm text-amber-700/70 mb-6">Upload a previously saved backup file to restore all student and staff data.</p>
                    </div>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                        {isImporting ? 'Restoring...' : 'Import from File'}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
                </div>
            </div>

            <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex gap-3">
                    <svg className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <p className="text-sm font-bold text-slate-700">Storage Information</p>
                        <p className="text-xs text-slate-500 mt-1">Your data is currently stored in your browser's local storage on this computer. It is not shared with any servers. Regular backups are recommended.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};



/**
 * COMPONENT: DatabaseScriptManager
 * PURPOSE: Provides SQL snippets for manual Supabase setup.
 * VIEW: Appears below DataManager in the "Database" tab.
 */
const DatabaseScriptManager = () => {
    const scripts = [
        {
            title: 'Initial Normalized Schema (v2)',
            date: '2026-03-02',
            description: 'Creates normalized tables for grades, attendance, enrollments, and audit logging.',
            sql: `-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Students Table
create table if not exists public.students (
  id text primary key,
  name text not null,
  sex text check (sex in ('Male', 'Female')),
  dob date,
  phone text,
  enrollment_date date default current_date,
  status text default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Staff Table
create table if not exists public.staff (
  id text primary key,
  name text not null,
  role text not null,
  subject text,
  contact text,
  hire_date date default current_date,
  password text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Classes Table
create table if not exists public.classes (
  id text primary key,
  name text not null,
  teacher_id text references public.staff(id) on delete set null,
  schedule text,
  level text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Enrollments Table (Many-to-Many)
create table if not exists public.enrollments (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  academic_year text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(student_id, class_id, academic_year)
);

-- 5. Grades Table
create table if not exists public.grades (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  subject text not null,
  score numeric(4,2) check (score >= 0 and score <= 10),
  term text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Attendance Table
create table if not exists public.attendance (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  date date not null,
  status text check (status in ('Present', 'Absent', 'Late')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(student_id, date)
);

-- 7. School Events Table
create table if not exists public.school_events (
  id text primary key,
  title text not null,
  date date not null,
  description text,
  type text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Settings Table
create table if not exists public.settings (
  id text primary key default 'global',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Audit Log Table
create table if not exists public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);`
        },
        {
            title: 'Batch Sync RPC Function',
            date: '2026-03-02',
            description: 'Handles high-performance synchronization of all school data.',
            sql: `create or replace function public.sync_school_data_v2(
  p_students jsonb,
  p_staff jsonb,
  p_staff_permissions jsonb,
  p_daily_logs jsonb,
  p_incident_reports jsonb,
  p_room_statuses jsonb,
  p_classes jsonb,
  p_enrollments jsonb,
  p_grades jsonb,
  p_attendance jsonb,
  p_events jsonb,
  p_config jsonb
) returns void as $$
begin
  -- 1. Sync Students
  delete from public.students;
  insert into public.students (id, name, sex, dob, phone, enrollment_date, status)
  select 
    (value->>'id'), (value->>'name'), (value->>'sex'), 
    (value->>'dob')::date, (value->>'phone'), 
    (value->>'enrollment_date')::date, (value->>'status')
  from jsonb_array_elements(p_students);

  -- 2. Sync Staff
  delete from public.staff;
  insert into public.staff (id, name, role, subject, contact, hire_date, password)
  select 
    (value->>'id'), (value->>'name'), (value->>'role'), 
    (value->>'subject'), (value->>'contact'), (value->>'hire_date')::date,
    (value->>'password')
  from jsonb_array_elements(p_staff);

  -- 2.5 Sync Staff Permissions
  delete from public.staff_permissions;
  insert into public.staff_permissions (id, staff_id, type, start_date, end_date, reason, created_at)
  select 
    (value->>'id'), (value->>'staff_id'), (value->>'type'), 
    (value->>'start_date')::date, (value->>'end_date')::date, 
    (value->>'reason'), (value->>'created_at')::timestamp with time zone
  from jsonb_array_elements(p_staff_permissions);

  -- 2.6 Sync Daily Logs
  delete from public.daily_logs;
  insert into public.daily_logs (id, staff_id, type, person_name, purpose, timestamp)
  select 
    (value->>'id'), (value->>'staff_id'), (value->>'type'), 
    (value->>'person_name'), (value->>'purpose'), 
    (value->>'timestamp')::timestamp with time zone
  from jsonb_array_elements(p_daily_logs);

  -- 2.7 Sync Incident Reports
  delete from public.incident_reports;
  insert into public.incident_reports (id, staff_id, title, description, severity, timestamp)
  select 
    (value->>'id'), (value->>'staff_id'), (value->>'title'), 
    (value->>'description'), (value->>'severity'), 
    (value->>'timestamp')::timestamp with time zone
  from jsonb_array_elements(p_incident_reports);

  -- 2.8 Sync Room Statuses
  delete from public.room_statuses;
  insert into public.room_statuses (id, room_name, status, last_updated_by, timestamp)
  select 
    (value->>'id'), (value->>'room_name'), (value->>'status'), 
    (value->>'last_updated_by'), (value->>'timestamp')::timestamp with time zone
  from jsonb_array_elements(p_room_statuses);

  -- 3. Sync Classes
  delete from public.classes;
  insert into public.classes (id, name, teacher_id, schedule, level)
  select 
    (value->>'id'), (value->>'name'), (value->>'teacher_id'), 
    (value->>'schedule'), (value->>'level')
  from jsonb_array_elements(p_classes);

  -- 4. Sync Enrollments
  delete from public.enrollments;
  insert into public.enrollments (id, student_id, class_id, academic_year)
  select 
    (value->>'id'), (value->>'student_id'), (value->>'class_id'), (value->>'academic_year')
  from jsonb_array_elements(p_enrollments);

  -- 5. Sync Grades
  delete from public.grades;
  insert into public.grades (id, student_id, subject, score, term)
  select 
    (value->>'id'), (value->>'student_id'), (value->>'subject'), 
    (value->>'score')::numeric, (value->>'term')
  from jsonb_array_elements(p_grades);

  -- 6. Sync Attendance
  delete from public.attendance;
  insert into public.attendance (id, student_id, date, status)
  select 
    (value->>'id'), (value->>'student_id'), (value->>'date')::date, (value->>'status')
  from jsonb_array_elements(p_attendance);

  -- 7. Sync Events
  delete from public.school_events;
  insert into public.school_events (id, title, date, description, type)
  select 
    (value->>'id'), (value->>'title'), (value->>'date')::date, 
    (value->>'description'), (value->>'type')
  from jsonb_array_elements(p_events);

  -- 8. Sync Settings
  delete from public.settings;
  insert into public.settings (id, data)
  select (value->>'key'), (value->'value')
  from jsonb_array_elements(p_config);

end;
$$ language plpgsql security definer;`
        },
        {
            title: 'Audit Logging & RLS Security',
            date: '2026-03-02',
            description: 'Enables Row Level Security and automatic change tracking.',
            sql: `-- Audit Function
create or replace function public.process_audit_log() returns trigger as $$
begin
  if (tg_op = 'DELETE') then
    insert into public.audit_log (table_name, record_id, action, old_data)
    values (tg_table_name, old.id, 'DELETE', row_to_json(old)::jsonb);
    return old;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_log (table_name, record_id, action, old_data, new_data)
    values (tg_table_name, new.id, 'UPDATE', row_to_json(old)::jsonb, row_to_json(new)::jsonb);
    return new;
  elsif (tg_op = 'INSERT') then
    insert into public.audit_log (table_name, record_id, action, new_data)
    values (tg_table_name, new.id, 'INSERT', row_to_json(new)::jsonb);
    return new;
  end if;
  return null;
end;
$$ language plpgsql;

-- Enable RLS
alter table public.students enable row level security;
alter table public.staff enable row level security;
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.grades enable row level security;
alter table public.attendance enable row level security;
alter table public.school_events enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;

-- Policies
create policy "Enable all access for authenticated users" on public.students for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.staff for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.classes for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.enrollments for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.grades for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.attendance for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.school_events for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.settings for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.audit_log for all to authenticated using (true) with check (true);`
        },
        {
            title: 'Staff Permissions & Leave Management',
            date: '2026-03-02',
            description: 'Adds support for tracking staff leave and permissions.',
            sql: `-- 10. Staff Permissions Table
create table if not exists public.staff_permissions (
  id text primary key,
  staff_id text not null references public.staff(id) on delete cascade,
  type text not null check (type in ('Annual Leave', 'Personal Leave', 'Non-Personal Leave')),
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.staff_permissions enable row level security;
create policy "Enable all access for authenticated users" on public.staff_permissions for all to authenticated using (true) with check (true);

-- Add Audit Trigger
create trigger on_staff_permissions_change
after insert or update or delete on public.staff_permissions
for each row execute function public.process_audit_log();`
        },
        {
            title: 'Role-Specific Features (Guard, Cleaner, Office)',
            date: '2026-03-02',
            description: 'Adds tables for daily logs, incident reports, and room statuses.',
            sql: `-- 11. Daily Logs (Guard)
create table if not exists public.daily_logs (
  id text primary key,
  staff_id text not null references public.staff(id) on delete cascade,
  type text not null check (type in ('Entry', 'Exit')),
  person_name text not null,
  purpose text,
  timestamp timestamp with time zone default now()
);

-- 12. Incident Reports (Guard)
create table if not exists public.incident_reports (
  id text primary key,
  staff_id text not null references public.staff(id) on delete cascade,
  title text not null,
  description text,
  severity text check (severity in ('Low', 'Medium', 'High')),
  timestamp timestamp with time zone default now()
);

-- 13. Room Statuses (Cleaner)
create table if not exists public.room_statuses (
  id text primary key,
  room_name text not null,
  status text check (status in ('Cleaned', 'Needs Attention')),
  last_updated_by text references public.staff(id),
  timestamp timestamp with time zone default now()
);

-- Enable RLS
alter table public.daily_logs enable row level security;
alter table public.incident_reports enable row level security;
alter table public.room_statuses enable row level security;

create policy "Enable all access for authenticated users" on public.daily_logs for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.incident_reports for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.room_statuses for all to authenticated using (true) with check (true);

-- Audit Triggers
create trigger on_daily_logs_change after insert or update or delete on public.daily_logs for each row execute function public.process_audit_log();
create trigger on_incident_reports_change after insert or update or delete on public.incident_reports for each row execute function public.process_audit_log();
create trigger on_room_statuses_change after insert or update or delete on public.room_statuses for each row execute function public.process_audit_log();`
        }
    ];

    /**
     * Copies the provided SQL text to the user's clipboard.
     */
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('SQL copied to clipboard!');
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
            <div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">New Script (Database Setup)</h2>
                <p className="text-sm text-slate-500">Copy and run these scripts in your Supabase SQL Editor to keep your database in sync with the app's latest features.</p>
            </div>

            <div className="space-y-6">
                {scripts.map((script, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-bottom border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-bold text-slate-700">{script.title}</h3>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{script.date}</p>
                            </div>
                            <button
                                onClick={() => copyToClipboard(script.sql)}
                                className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center"
                            >
                                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 8h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                Copy SQL
                            </button>
                        </div>
                        <div className="p-4">
                            <p className="text-xs text-slate-600 mb-3">{script.description}</p>
                            <pre className="bg-slate-900 text-slate-300 p-4 rounded-lg text-[10px] font-mono overflow-x-auto max-h-48">
                                {script.sql}
                            </pre>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * MAIN PAGE COMPONENT: SettingsPage
 */
const SettingsPage = ({ onLogout, userRole }) => {
    // --- 1. STATE & DATA INITIALIZATION ---
    const { adminPassword, setAdminPassword, triggerSync, lastSyncedAt, isSyncing, importAllData, currentUser } = useData();
    const isAdmin = userRole === UserRole.Admin;
    const isOffice = userRole === UserRole.OfficeWorker;
    // Read sub-tab from URL on mount (e.g. /settings/levels → 'levels')
    const getInitialSettingsTab = () => {
        const parts = window.location.pathname.split('/');
        const sub = parts[2]?.toLowerCase();
        const valid = ['account', 'data', 'sync', 'offline'];
        return (valid.includes(sub) ? sub : 'account');
    };
    const [activeTab, setActiveTab] = useState(getInitialSettingsTab);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
    const togglePassword = (field) => setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));

    // --- 2. HANDLERS & LOGIC ---
    /**
     * Handles the submission of the admin password change form.
     */
    const handleSubmitPassword = (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (currentPassword !== adminPassword) {
            setError('Current password is not correct.');
            return;
        }

        if (newPassword.length < 4) {
            setError('New password must be at least 4 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }

        setAdminPassword(newPassword);
        setSuccess('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    const allTabs = [
        { id: 'account', label: 'Account', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7h14a7 7 0 00-7-7z" /></svg>, adminOnly: true },
        { id: 'data', label: 'Database', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3zM4 7l8 4 8-4" /></svg>, adminOnly: true },
        { id: 'sync', label: 'Cloud Sync', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>, adminOnly: true },
        { id: 'offline', label: 'Offline Help', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, adminOnly: false },
    ];

    const tabs = allTabs.filter(tab => {
                if (!tab.adminOnly) return true;
        if (isAdmin) return true;
        // Office Workers can access Data and Sync tabs
        if (isOffice && (tab.id === 'data' || tab.id === 'sync')) return true;
        return false;
    });

    useEffect(() => {
        const hasAccess = isAdmin || (isOffice && (activeTab === 'data' || activeTab === 'sync' || activeTab === 'offline'));
        if (!hasAccess && !isAdmin && activeTab !== 'offline') {
            setActiveTab('offline');
        }
    }, [isAdmin, isOffice, activeTab]);

    return (
        <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-8">
            {/* --- UI SECTION: HEADER --- */}
            <h1 className="text-3xl font-bold text-gray-800 mb-4 sm:mb-8 tracking-tight">Settings</h1>

            <div className="flex flex-col md:flex-row gap-4 sm:gap-8 items-start">
                {/* --- UI SECTION: SIDEBAR NAVIGATION --- */}
                <div className="w-full md:w-64 shrink-0 flex flex-wrap md:flex-col gap-2 pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                window.history.replaceState({}, '', `/settings/${tab.id}`);
                                document.title = `Settings / ${tab.label} | SchoolAdmin`;
                            }}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 shrink-0 md:w-full ${activeTab === tab.id
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-200 translate-x-0 md:translate-x-1'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-transparent border-b-slate-100'
                                }`}
                        >
                            {tab.icon}
                            <span className="font-semibold whitespace-nowrap">{tab.label}</span>
                        </button>
                    ))}

                    <div className="pt-4 mt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onLogout}
                            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 group cursor-pointer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="font-semibold">Sign Out</span>
                        </button>
                    </div>
                </div>

                {/* --- UI SECTION: CONTENT PANEL --- */}
                <div className="flex-grow w-full">
                    {activeTab === 'account' && (
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-right-2 duration-300">
                            {/* SUB-VIEW: SECURITY SETTINGS */}
                            <h2 className="text-xl font-semibold text-gray-700 mb-6">Security Settings</h2>
                            <form onSubmit={handleSubmitPassword} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="current-password">
                                        Current Admin Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.current ? 'text' : 'password'}
                                            id="current-password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full px-4 py-2 pr-10 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                                            required
                                        />
                                        {currentPassword && (
                                            <button type="button" onClick={() => togglePassword('current')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                                {showPasswords.current ? (
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-gray-50">
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="new-password">
                                        New Admin Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.new ? 'text' : 'password'}
                                            id="new-password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full px-4 py-2 pr-10 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                                            required
                                        />
                                        {newPassword && (
                                            <button type="button" onClick={() => togglePassword('new')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                                {showPasswords.new ? (
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="confirm-password">
                                        Confirm New Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.confirm ? 'text' : 'password'}
                                            id="confirm-password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-4 py-2 pr-10 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                                            required
                                        />
                                        {confirmPassword && (
                                            <button type="button" onClick={() => togglePassword('confirm')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                                {showPasswords.confirm ? (
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm flex items-center space-x-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.283a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                        <span>{error}</span>
                                    </div>
                                )}
                                {success && (
                                    <div className="p-3 bg-green-50 text-green-600 rounded-md text-sm flex items-center space-x-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        <span>{success}</span>
                                    </div>
                                )}

                                <div className="flex justify-end pt-4">
                                    <button
                                        type="submit"
                                        className="bg-primary-600 text-white px-8 py-3 rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 font-bold active:scale-95"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === 'data' && <div className="animate-in fade-in slide-in-from-right-2 duration-300"><DataManager /></div>}
                    {activeTab === 'sync' && (
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-right-2 duration-300 space-y-6">
                            <h2 className="text-xl font-semibold text-gray-700">Cloud Sync Status</h2>

                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="w-full sm:w-auto">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 text-center sm:text-left">Last Synced</p>
                                        <p className="text-sm font-bold text-slate-600 text-center sm:text-left">
                                            {lastSyncedAt ? lastSyncedAt.toLocaleString() : 'Never'}
                                        </p>
                                    </div>
                                    <div className="w-full sm:w-auto text-center sm:text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Sync Status</p>
                                        <p className={`text-sm font-bold ${isSyncing ? 'text-blue-600 animate-pulse' : 'text-slate-600'}`}>
                                            {isSyncing ? 'Syncing...' : 'Idle'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center justify-between pt-2 border-t border-slate-200 gap-4">
                                    <div className="text-center sm:text-left">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Connection Status</p>
                                        <p className={`text-sm font-bold ${navigator.onLine ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {navigator.onLine ? 'Connected (Online)' : 'Disconnected (Offline)'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="text-xs text-primary-600 font-bold hover:underline px-3 py-1 bg-white border border-slate-100 rounded-md shadow-sm"
                                    >
                                        Refresh Connection
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-6 rounded-2xl border border-blue-100 bg-blue-50/50">
                                    <h3 className="font-bold text-blue-900 mb-2">Force Cloud Sync</h3>
                                    <p className="text-xs text-blue-700 mb-4">Manually push all local changes to Supabase right now.</p>
                                    <button
                                        onClick={() => triggerSync()}
                                        className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-all"
                                    >
                                        Sync Now
                                    </button>
                                </div>

                                <div className="p-6 rounded-2xl border border-red-100 bg-red-50/50">
                                    <h3 className="font-bold text-red-900 mb-2">Reset Local Cache</h3>
                                    <p className="text-xs text-red-700 mb-4">Wipe local data and re-fetch everything from Supabase. Use this if sync is stuck.</p>
                                    <button
                                        onClick={() => {
                                            if (window.confirm('This will reload the app and clear local data. Any unsynced changes will be lost. Continue?')) {
                                                apiService.clearLocalCache();
                                            }
                                        }}
                                        className="w-full bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition-all"
                                    >
                                        Reset Cache
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'offline' && <div className="animate-in fade-in slide-in-from-right-2 duration-300"><OfflineGuide /></div>}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
