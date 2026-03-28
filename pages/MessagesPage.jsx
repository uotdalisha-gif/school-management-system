import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { MessageType, UserRole } from '../types';
import {
    fetchMessages, sendMessage, markAsRead,
    updateLeaveStatus, subscribeToMessages,
    deleteOldMessages, deleteMessage, updateMessage, uploadAttachment, ADMIN_KEY
} from '../services/messageService';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const formatTime = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const daysBetween = (start, end) => {
    const a = new Date(start), b = new Date(end);
    return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
};

const formatDate = (iso) =>
    new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

const statusColors = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
};
const statusIcon = {
    pending: '⏳', approved: '✅', rejected: '❌',
};

// ─────────────────────────────────────────────
// Rich card for leave_request messages
// ─────────────────────────────────────────────
const LeaveCard = ({ msg, isMine }) => {
    const m = msg.metadata || {};
    const days = m.startDate && m.endDate ? daysBetween(m.startDate, m.endDate) : 1;
    const status = m.status || 'pending';

    return (
        <div className={`rounded-2xl overflow-hidden shadow-sm border ${isMine ? 'border-primary-300' : 'border-amber-200'}`}
            style={{ maxWidth: 300 }}>
            {/* Header strip */}
            <div className={`px-4 py-2.5 flex items-center gap-2 ${isMine ? 'bg-primary-500' : 'bg-amber-50'}`}>
                <span className="text-lg">📅</span>
                <span className={`font-bold text-sm ${isMine ? 'text-white' : 'text-amber-800'}`}>
                    Leave Request
                </span>
            </div>
            {/* Body */}
            <div className="bg-white px-4 py-3 space-y-2">
                {m.leaveType && (
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">Type:</span>
                        <span className="text-xs font-bold text-slate-700">{m.leaveType}</span>
                    </div>
                )}
                {m.startDate && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <div className="text-xs text-slate-500 font-medium">
                            📆 {formatDate(m.startDate)}
                            {m.endDate && m.endDate !== m.startDate && ` → ${formatDate(m.endDate)}`}
                        </div>
                        <div className="text-xs font-bold text-slate-700 mt-0.5">
                            {days} {days === 1 ? 'day' : 'days'} off
                        </div>
                    </div>
                )}
                {msg.content && (
                    <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2">
                        {/* strip the auto-generated prefix, show just the reason */}
                        {msg.content.includes('Reason:')
                            ? msg.content.split('Reason:')[1]?.trim()
                            : msg.content}
                    </p>
                )}
                <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${statusColors[status]}`}>
                    <span>{statusIcon[status]}</span>
                    <span className="uppercase tracking-wide">{status}</span>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Rich card for incident messages
// ─────────────────────────────────────────────
const IncidentCard = ({ msg, isMine }) => {
    const severity = msg.metadata?.severity || 'Low';
    const severityColor = severity === 'High'
        ? 'bg-red-500 text-white'
        : severity === 'Medium'
            ? 'bg-orange-400 text-white'
            : 'bg-yellow-400 text-slate-800';

    return (
        <div className={`rounded-2xl overflow-hidden shadow-sm border ${isMine ? 'border-primary-300' : 'border-red-200'}`}
            style={{ maxWidth: 300 }}>
            <div className={`px-4 py-2.5 flex items-center justify-between ${isMine ? 'bg-primary-500' : 'bg-red-50'}`}>
                <div className="flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    <span className={`font-bold text-sm ${isMine ? 'text-white' : 'text-red-800'}`}>
                        Incident Report
                    </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityColor}`}>
                    {severity.toUpperCase()}
                </span>
            </div>
            <div className="bg-white px-4 py-3">
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {msg.content.includes(']')
                        ? msg.content.split(']')[1]?.trim()
                        : msg.content}
                </p>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Message Bubble
// ─────────────────────────────────────────────
const MessageBubble = ({ msg, isMine, isAdmin, onStatusChange, onDelete, onEdit }) => {
    const [hover, setHover] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState(msg.content);
    const isCard = msg.type === 'leave_request' || msg.type === 'incident';
    const isPending = msg.metadata?.status === 'pending';
    const isEdited = msg.metadata?.edited;

    const handleSaveEdit = () => {
        if (editText.trim() && editText !== msg.content) onEdit(msg.id, editText.trim());
        setEditing(false);
    };

    return (
        <div
            className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-3`}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            {!isMine && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0 mt-1">
                    {msg.senderName.charAt(0).toUpperCase()}
                </div>
            )}

            <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[80%]`}>
                {!isMine && (
                    <span className="text-[11px] text-slate-400 font-medium mb-1 ml-1">{msg.senderName}</span>
                )}

                {/* Card or plain bubble */}
                {isCard ? (
                    msg.type === 'leave_request'
                        ? <LeaveCard msg={msg} isMine={isMine} />
                        : <IncidentCard msg={msg} isMine={isMine} />
                ) : editing ? (
                    // Inline edit mode
                    <div className="flex flex-col gap-2 w-[75vw] sm:w-[320px] md:w-[400px] max-w-full">
                        <textarea
                            autoFocus
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); } if (e.key === 'Escape') setEditing(false); }}
                            rows={4}
                            className="w-full px-3 py-2.5 border-2 border-primary-400 rounded-xl text-sm resize-none focus:outline-none bg-white text-slate-800 shadow-sm leading-relaxed"
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditing(false)} className="px-4 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                            <button onClick={handleSaveEdit} className="px-4 py-1.5 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm">Save</button>
                        </div>
                    </div>
                ) : (
                    <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${isMine
                        ? 'bg-primary-600 text-white rounded-tr-sm'
                        : msg.type === 'announcement'
                            ? 'bg-blue-50 border border-blue-200 text-blue-900 rounded-tl-sm'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                        }`}>
                        {msg.type === 'announcement' && (
                            <div className="flex items-center gap-1 mb-1">
                                <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6" />
                                </svg>
                                <span className="text-[10px] font-bold uppercase text-blue-500 tracking-wider">Announcement</span>
                            </div>
                        )}
                        {/* Image attachment */}
                        {msg.metadata?.imageUrl && (
                            <a href={msg.metadata.imageUrl} target="_blank" rel="noreferrer" className="block mb-2">
                                <img src={msg.metadata.imageUrl} alt="attachment" className="max-w-[220px] rounded-xl border border-white/20 object-cover" />
                            </a>
                        )}
                        {/* File attachment */}
                        {msg.metadata?.fileUrl && !msg.metadata?.imageUrl && (
                            <a href={msg.metadata.fileUrl} target="_blank" rel="noreferrer"
                                className={`flex items-center gap-3 mb-2 px-4 py-3 rounded-xl transition-all shadow-sm ${isMine ? 'bg-primary-500/30 hover:bg-primary-500/50' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'}`}>
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${isMine ? 'bg-primary-400 text-white' : 'bg-white text-rose-500 border border-slate-200'}`}>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 7v4h4" /></svg>
                                </div>
                                <div className="min-w-0">
                                    <p className={`text-sm font-bold truncate ${isMine ? 'text-white' : 'text-slate-700'}`}>{msg.metadata.fileName || 'Document File'}</p>
                                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isMine ? 'text-primary-100' : 'text-slate-400'}`}>Download</p>
                                </div>
                                <div className={`ml-auto pl-2 ${isMine ? 'text-primary-100' : 'text-slate-400'}`}>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                </div>
                            </a>
                        )}
                        {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                        {isEdited && <span className="text-[10px] opacity-60 mt-0.5 block">edited</span>}
                    </div>
                )}

                {/* Admin approve/reject for pending requests */}
                {isAdmin && !isMine && isCard && msg.type === 'leave_request' && isPending && (
                    <div className="flex gap-2 mt-1.5 ml-1">
                        <button onClick={() => onStatusChange(msg.id, 'approved')}
                            className="px-3 py-1 text-xs font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm">
                            ✓ Approve
                        </button>
                        <button onClick={() => onStatusChange(msg.id, 'rejected')}
                            className="px-3 py-1 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm">
                            ✗ Reject
                        </button>
                    </div>
                )}

                {/* Time + actions row */}
                <div className={`flex items-center gap-2 mt-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-[10px] text-slate-400">{formatTime(msg.createdAt)}</span>
                    {isMine && (
                        <span className="text-[10px] text-slate-400">{msg.isRead ? '✓✓' : '✓'}</span>
                    )}
                    {/* Edit button — own plain-text messages only */}
                    {isMine && !isCard && !editing && (
                        <button
                            onClick={() => { setEditText(msg.content); setEditing(true); }}
                            className={`transition-all text-slate-400 hover:text-blue-500 ${hover ? 'opacity-100' : 'opacity-0'}`}
                            title="Edit"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                    )}
                    {/* Delete / unsend button */}
                    {isMine && !editing && (
                        <button
                            onClick={() => onDelete(msg.id)}
                            className={`transition-all text-slate-400 hover:text-red-500 ${hover ? 'opacity-100' : 'opacity-0'}`}
                            title="Unsend"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Leave Request Modal (compact)
// ─────────────────────────────────────────────
const LeaveModal = ({ onSend, onClose }) => {
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [leaveType, setLeaveType] = useState('Annual Leave');
    const [reason, setReason] = useState('');

    const days = daysBetween(startDate, endDate);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!reason.trim()) return;
        const content = `Leave Request: ${leaveType}\nDate: ${startDate}${endDate !== startDate ? ' to ' + endDate : ''}\nReason: ${reason}`;
        onSend(content, { startDate, endDate, leaveType, status: 'pending' });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">📅</span>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Request Leave</h3>
                            <p className="text-xs text-slate-400">Submit to school administrator</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Leave Type</label>
                        <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-slate-50">
                            <option>Annual Leave</option>
                            <option>Personal Leave</option>
                            <option>Non-Personal Leave</option>
                            <option>Emergency Leave</option>
                            <option>Maternity / Paternity Leave</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Start Date</label>
                            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }}
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-slate-50" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">End Date</label>
                            <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-slate-50" />
                        </div>
                    </div>
                    {/* Duration badge */}
                    <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-2 flex items-center gap-2">
                        <span className="text-primary-600 text-sm font-bold">{days} {days === 1 ? 'day' : 'days'} off</span>
                        <span className="text-xs text-primary-400">· {formatDate(startDate)}{startDate !== endDate ? ` → ${formatDate(endDate)}` : ''}</span>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Reason / Details</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} required
                            placeholder="Explain the reason for your leave..." rows={3}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none bg-slate-50" />
                    </div>
                    <div className="flex gap-3 pb-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit"
                            className="flex-1 py-2.5 text-sm font-bold bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200">
                            Send Request
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Incident Report Modal (compact)
// ─────────────────────────────────────────────
const IncidentModal = ({ onSend, onClose }) => {
    const [severity, setSeverity] = useState('Low');
    const [description, setDescription] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!description.trim()) return;
        const content = `Incident Report [${severity}]\n${description}`;
        onSend(content, { severity });
        onClose();
    };

    const severityStyles = {
        Low: 'border-yellow-400 bg-yellow-50 text-yellow-800',
        Medium: 'border-orange-400 bg-orange-50 text-orange-800',
        High: 'border-red-500 bg-red-50 text-red-800',
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">⚠️</span>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Incident Report</h3>
                            <p className="text-xs text-slate-400">Report to school administrator</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Severity Level</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['Low', 'Medium', 'High']).map(s => (
                                <button key={s} type="button" onClick={() => setSeverity(s)}
                                    className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${severity === s ? severityStyles[s] + ' scale-[1.02]' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                                    {s === 'Low' ? '🟡' : s === 'Medium' ? '🟠' : '🔴'} {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">What Happened?</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} required
                            placeholder="Describe the incident clearly and in detail..." rows={4}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:outline-none resize-none bg-slate-50" />
                    </div>
                    <div className="flex gap-3 pb-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit"
                            className="flex-1 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200">
                            File Report
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Main MessagesPage
// ─────────────────────────────────────────────
const MessagesPage = () => {
    const { currentUser, staff, addStaffPermission } = useData();
    const isAdmin = currentUser?.role === UserRole.Admin;
    const myDbId = isAdmin ? ADMIN_KEY : (currentUser?.id || '');
    const myName = currentUser?.name || 'Administrator';

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeConversation, setActiveConversation] = useState('');
    const [mobileShowChat, setMobileShowChat] = useState(false); // Initially show sidebar for everyone
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [modal, setModal] = useState(null);
    const [attachment, setAttachment] = useState(null);
    const fileInputRef = useRef(null);
    const [announcementMode, setAnnouncementMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const bottomRef = useRef(null);
    const initRef = useRef(false);

    // Load messages
    const load = useCallback(async () => {
        const data = await fetchMessages(myDbId, isAdmin);
        setMessages(data);

        // Initialize active conversation
        if (!initRef.current) {
            if (isAdmin) {
                if (staff.length > 0) {
                    const staffIdSet = new Set(staff.map(s => s.id));
                    const ids = [...new Set(data
                        .map(m => staffIdSet.has(m.senderId) ? m.senderId : m.recipientId)
                        .filter(id => id !== 'all' && staffIdSet.has(id))
                    )];
                    const defaultId = ids[0] || staff[0]?.id || '';
                    setActiveConversation(defaultId);
                    initRef.current = true;
                }
            } else {
                setActiveConversation(ADMIN_KEY);
                // Non-teachers go straight to chat
                if (currentUser?.role !== UserRole.Teacher) {
                    setMobileShowChat(true);
                }
                initRef.current = true;
            }
        }

        setLoading(false);
    }, [myDbId, isAdmin, staff, currentUser?.role]);

    useEffect(() => {
        load();
        deleteOldMessages();
        const interval = setInterval(load, 8000);
        const channel = subscribeToMessages(myDbId, isAdmin, (newMsg) => {
            if (newMsg.content === '__DELETED__') {
                // Realtime delete — remove from state immediately
                setMessages(prev => prev.filter(m => m.id !== newMsg.id));
                return;
            }
            setMessages(prev => {
                const exists = prev.find(m => m.id === newMsg.id);
                if (exists) return prev.map(m => m.id === newMsg.id ? newMsg : m);
                return [...prev, newMsg];
            });
        });
        return () => { clearInterval(interval); channel?.unsubscribe(); };
    }, [myDbId, isAdmin]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, activeConversation]);

    useEffect(() => {
        if (!activeConversation) return;
        const unread = conversationMessages
            .filter(m => !m.isRead && m.recipientId === myDbId)
            .map(m => m.id);
        if (unread.length > 0) markAsRead(unread);
    }, [activeConversation, messages]);

    // ── Build staff list / contacts
    const staffConversations = useMemo(() => {
        // Staff filter
        const filteredStaff = staff.filter(s => {
            if (isAdmin) return true;
            if (s.id === currentUser?.id) return false;
            // Teachers and Office Workers see each other
            if (currentUser?.role === UserRole.Teacher || currentUser?.role === UserRole.OfficeWorker) {
                return s.role === UserRole.Teacher || s.role === 'Assistant Teacher' || s.role === UserRole.OfficeWorker;
            }
            return false;
        });

        const contacts = filteredStaff.map(s => {
            const msgs = messages.filter(m => m.senderId === s.id || m.recipientId === s.id);
            const lastMsg = msgs[msgs.length - 1];
            const unread = msgs.filter(m => !m.isRead && m.senderId === s.id).length;
            return { id: s.id, name: s.name, role: s.role, lastMsg, unread };
        });

        // Add Admin to the top for everyone else
        if (!isAdmin) {
            const adminMsgs = messages.filter(m => m.senderId === ADMIN_KEY || m.recipientId === ADMIN_KEY);
            const lastMsg = adminMsgs[adminMsgs.length - 1];
            const unread = adminMsgs.filter(m => !m.isRead && m.senderId === ADMIN_KEY).length;
            contacts.unshift({ id: ADMIN_KEY, name: 'Administrator', role: 'Support', lastMsg, unread });
        }

        return contacts.sort((a, b) => {
            if (a.id === ADMIN_KEY) return -1;
            if (b.id === ADMIN_KEY) return 1;
            if (!a.lastMsg && !b.lastMsg) return 0;
            if (!a.lastMsg) return 1;
            if (!b.lastMsg) return -1;
            return new Date(b.lastMsg.createdAt).getTime() - new Date(a.lastMsg.createdAt).getTime();
        }).filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [isAdmin, staff, messages, currentUser?.role, currentUser?.id, searchQuery]);

    const filteredStaffConversations = staffConversations;
    const isMultiRecipient = isAdmin || currentUser?.role === UserRole.Teacher || currentUser?.role === UserRole.OfficeWorker;

    // Build a set of known staff IDs for role checks
    const staffIdSet = new Set(staff.map(s => s.id));

    // ── Filter conversation messages
    const conversationMessages = messages.filter(m => {
        if (isAdmin) {
            if (activeConversation === 'all') return m.type === 'announcement';
            return m.senderId === activeConversation || m.recipientId === activeConversation;
        }
        // General Announcement logic
        if (m.recipientId === 'all') return true;
        // Personal logic
        if (activeConversation === ADMIN_KEY) {
            return (m.senderId === myDbId && m.recipientId === ADMIN_KEY) ||
                   (m.senderId === ADMIN_KEY && m.recipientId === myDbId);
        }
        // Private chat with another teacher
        return (m.senderId === myDbId && m.recipientId === activeConversation) ||
               (m.senderId === activeConversation && m.recipientId === myDbId);
    });

    const totalUnread = messages.filter(m => !m.isRead && m.recipientId === myDbId).length;

    // isMine: admin's own messages include any message NOT sent by a staff member
    // (handles old messages saved with 'admin_1' or similar before the fix)
    const isMine = (msg) => {
        if (isAdmin) return !staffIdSet.has(msg.senderId); // not staff → must be admin
        return msg.senderId === myDbId;
    };

    // ── Send message
    const handleSend = async (e) => {
        e?.preventDefault();
        if ((!text.trim() && !attachment) || sending) return;

        setSending(true);
        const recipient = announcementMode ? 'all' : activeConversation;

        let metadata = undefined;
        if (attachment) {
            const fileUrl = await uploadAttachment(attachment);
            if (fileUrl) {
                const isImage = attachment.type.startsWith('image/');
                metadata = isImage
                    ? { imageUrl: fileUrl, fileName: attachment.name }
                    : { fileUrl, fileName: attachment.name };
            }
        }

        const newMsg = await sendMessage({
            senderId: myDbId, senderName: myName, recipientId: recipient,
            type: announcementMode ? 'announcement' : 'text',
            content: text.trim(), metadata, isAdmin,
        });

        if (newMsg) {
            setMessages(prev => [...prev, newMsg]);
            setText('');
            setAttachment(null);
        }
        setSending(false);
    };

    const handleEdit = async (id, newContent) => {
        await updateMessage(id, newContent);
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content: newContent, metadata: { ...m.metadata, edited: true } } : m));
    };

    // ── Quick send (leave / incident)
    const handleQuickSend = async (content, metadata, type) => {
        const recipient = activeConversation || ADMIN_KEY;
        const newMsg = await sendMessage({
            senderId: myDbId, senderName: myName, recipientId: recipient,
            type, content, metadata, isAdmin,
        });
        if (newMsg) setMessages(prev => [...prev, newMsg]);
    };

    // ── Approve / Reject
    const handleStatusChange = async (id, status) => {
        await updateLeaveStatus(id, status);
        setMessages(prev => prev.map(m => m.id === id ? { ...m, metadata: { ...m.metadata, status } } : m));

        if (status === 'approved') {
            const msg = messages.find(m => m.id === id);
            if (msg && msg.metadata) {
                await addStaffPermission({
                    staffId: msg.senderId,
                    type: (msg.metadata.leaveType) || 'Personal Leave',
                    startDate: msg.metadata.startDate || new Date().toISOString().split('T')[0],
                    endDate: msg.metadata.endDate || new Date().toISOString().split('T')[0],
                    reason: msg.content.includes('Reason:') ? msg.content.split('Reason:')[1]?.trim() : msg.content,
                    createdAt: new Date().toISOString()
                });
            }
        }
    };

    // ── Delete / unsend
    const handleDelete = async (id) => {
        await deleteMessage(id);
        setMessages(prev => prev.filter(m => m.id !== id));
    };

    const activeStaff = isAdmin ? staff.find(s => s.id === activeConversation) : null;

    return (
        <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden">

            {/* ══ LEFT conversation list ══ */}
            {isMultiRecipient && (
                <div className={`w-full md:w-72 shrink-0 border-r border-slate-200 flex flex-col bg-slate-50 ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-200 shadow-sm z-10 space-y-3">
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Messages</h2>
                            <p className="text-xs text-slate-400 mt-0.5">{totalUnread > 0 ? `${totalUnread} unread` : '✨ All caught up'}</p>
                        </div>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                            </span>
                            <input 
                                type="text" 
                                placeholder={isAdmin ? "Search staff..." : "Search contacts..."} 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all placeholder-slate-400 text-slate-700 shadow-sm"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {/* Announce to all */}
                        {isAdmin && (
                            <button
                                onClick={() => { setActiveConversation('all'); setAnnouncementMode(true); setMobileShowChat(true); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 transition-colors ${activeConversation === 'all' ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-white'}`}>
                                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                    </svg>
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="text-sm font-semibold text-slate-700">Announce to All</p>
                                    <p className="text-xs text-slate-400 truncate">Broadcast to all staff</p>
                                </div>
                            </button>
                        )}

                        {filteredStaffConversations.map(conv => (
                            <button key={conv.id}
                                onClick={() => { setActiveConversation(conv.id); setAnnouncementMode(false); setMobileShowChat(true); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 transition-colors ${activeConversation === conv.id ? 'bg-primary-50 border-l-2 border-l-primary-500' : 'hover:bg-white'}`}>
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm ${conv.id === ADMIN_KEY ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-slate-600 to-slate-900'}`}>
                                    {conv.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold text-slate-700 truncate">{conv.name}</p>
                                        {conv.unread > 0 && (
                                            <span className="ml-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                                {conv.unread}
                                            </span>
                                        )}
                                    </div>
                                {conv.lastMsg ? (
                                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                                        {conv.lastMsg.type === 'leave_request' ? '📅 Leave request'
                                            : conv.lastMsg.type === 'incident' ? '⚠️ Incident report'
                                                : conv.lastMsg.content.slice(0, 30) + (conv.lastMsg.content.length > 30 ? '…' : '')}
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400/80 italic truncate mt-0.5">No messages yet</p>
                                )}
                            </div>
                        </button>
                    ))}
                    </div>
                </div>
            )}

            {/* ══ RIGHT panel ══ */}
            <div className={`flex-1 flex flex-col min-w-0 w-full ${isMultiRecipient && !mobileShowChat ? 'hidden md:flex' : 'flex'}`}>

                {/* ── Chat Header ── */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white/90 backdrop-blur-sm shadow-sm relative z-50">
                    {/* Back button (mobile only) */}
                    {isMultiRecipient && (
                        <button onClick={() => setMobileShowChat(false)}
                            className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors mr-1 shrink-0">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}

                    {/* Determine active contact info once */}
                    {(() => {
                        const isAll = activeConversation === 'all';
                        const activeContact = !isAll ? filteredStaffConversations.find(c => c.id === activeConversation) : null;
                        
                        // Default to Administrator if we can't find them (fallback)
                        const displayName = isAll ? 'All Staff Announcement' : (activeContact?.name || 'Administrator');
                        const displayRole = isAll ? `${staff.length} staff members` : (activeContact?.role || '● School Admin');
                        const displayInitial = isAll ? null : (activeContact ? activeContact.name.charAt(0).toUpperCase() : 'A');

                        return (
                            <>
                                {/* Contact avatar */}
                                {isAll ? (
                                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6" />
                                        </svg>
                                    </div>
                                ) : (
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${activeConversation === ADMIN_KEY ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-slate-600 to-slate-900'}`}>
                                        {displayInitial}
                                    </div>
                                )}

                                {/* Contact name */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm leading-tight">
                                        {displayName}
                                    </p>
                                    <p className="text-xs text-slate-400 leading-tight">
                                        {displayRole}
                                    </p>
                                </div>
                            </>
                        );
                    })()}

                    {/* Staff quick-action buttons — compact pills in header */}
                    {!isAdmin && activeConversation === ADMIN_KEY && (
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => setModal('leave')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors"
                                title="Request Leave"
                            >
                                <span>📅</span>
                                <span className="hidden sm:inline">Leave</span>
                            </button>
                            <button
                                onClick={() => setModal('incident')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
                                title="File Incident Report"
                            >
                                <span>⚠️</span>
                                <span className="hidden sm:inline">Incident</span>
                            </button>
                        </div>
                    )}

                    {/* Admin: announcement mode badge */}
                    {isAdmin && activeConversation === 'all' && (
                        <span className="text-[10px] font-bold px-2 py-1 bg-blue-100 text-blue-600 rounded-lg border border-blue-200">
                            BROADCAST
                        </span>
                    )}
                </div>

                {/* Floating New Message button for mobile (only if currently in chat) */}
                {!isAdmin && isMultiRecipient && mobileShowChat && (
                    <button 
                        onClick={() => setMobileShowChat(false)}
                        className="md:hidden fixed bottom-24 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 animate-bounce transition-transform active:scale-95"
                    >
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                )}

                {/* ── Messages ── */}
                <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50/40">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : conversationMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                                <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-400 text-sm">No messages yet</p>
                                {!isAdmin && <p className="text-xs text-slate-300 mt-1">Send a message or request below</p>}
                            </div>
                        </div>
                    ) : (
                        <>
                            {conversationMessages.map(msg => (
                                <MessageBubble key={msg.id} msg={msg}
                                    isMine={isMine(msg)} isAdmin={isAdmin}
                                    onStatusChange={handleStatusChange}
                                    onDelete={handleDelete}
                                    onEdit={handleEdit}
                                />
                            ))}
                            <div ref={bottomRef} />
                        </>
                    )}
                </div>

                {/* ── Input ── */}
                <form onSubmit={handleSend} className="px-3 py-3 border-t border-slate-100 bg-white">
                    {announcementMode && (
                        <div className="mb-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span className="text-xs font-medium text-blue-700">Broadcast to all staff</span>
                        </div>
                    )}

                    {/* Attachment Preview */}
                    {attachment && (
                        <div className="mb-2 relative inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg">
                            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="text-xs font-medium text-slate-700 max-w-[200px] truncate">{attachment.name}</span>
                            <button type="button" onClick={() => setAttachment(null)} className="ml-1 text-slate-400 hover:text-red-500">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    )}

                    <div className="flex items-end gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={e => {
                                if (e.target.files?.[0]) setAttachment(e.target.files[0]);
                                e.target.value = ''; // reset so you can select the same file again if needed
                            }}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
                            title="Attach file or image"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                        </button>
                        <textarea
                            value={text}
                            onChange={e => setText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Type a message…"
                            rows={1}
                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none max-h-28 bg-slate-50"
                        />
                        <button type="submit" disabled={(!text.trim() && !attachment) || sending}
                            className="w-10 h-10 bg-primary-600 text-white rounded-2xl flex items-center justify-center hover:bg-primary-700 transition-colors disabled:opacity-40 shadow-lg shadow-primary-200 shrink-0">
                            {sending
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            }
                        </button>
                    </div>
                </form>
            </div>

            {/* ── Modals ── */}
            {modal === 'leave' && (
                <LeaveModal
                    onClose={() => setModal(null)}
                    onSend={(content, metadata) => handleQuickSend(content, metadata, 'leave_request')}
                />
            )}
            {modal === 'incident' && (
                <IncidentModal
                    onClose={() => setModal(null)}
                    onSend={(content, metadata) => handleQuickSend(content, metadata, 'incident')}
                />
            )}
        </div>
    );
};

export default MessagesPage;
