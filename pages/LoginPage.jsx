// --- 1. IMPORTS & DEPENDENCIES ---
import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { useData } from '../context/DataContext';

// --- 2. MAIN COMPONENT ---
/**
 * PAGE: LoginPage
 * DESCRIPTION: Handles user authentication for all roles.
 */
const LoginPage = ({ onLogin }) => {
    // --- 2.1. GLOBAL STATE & DATA ---
    const { adminPassword, staff, setCurrentUser } = useData();

    // --- 2.2. LOCAL UI STATE ---
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState(UserRole.Admin);
    const [error, setError] = useState('');
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // --- 2.3. SIDE EFFECTS ---
    // Handle PWA installation prompt
    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);

        window.addEventListener('appinstalled', () => {
            setDeferredPrompt(null);
            setIsInstalled(true);
        });

        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    // --- 2.4. ACTION HANDLERS ---
    /**
     * Triggers the PWA installation prompt.
     */
    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const processLogin = () => {
        if (selectedRole === UserRole.Admin) {
            if (password === adminPassword) {
                setCurrentUser({ id: 'admin_1', name: 'Administrator', role: selectedRole });
                onLogin(UserRole.Admin);
            } else {
                setError('Incorrect admin password.');
                setIsLoggingIn(false);
            }
        } else {
            // Check if staff exists with this identifier (case-insensitive name OR contact) and password
            const searchId = identifier.trim().toLowerCase();
            const foundStaff = staff.find(s =>
                ((s.name || '').toLowerCase() === searchId || (s.contact || '').toLowerCase() === searchId)
                && s.role === selectedRole
            );

            if (foundStaff) {
                if (foundStaff.password) {
                    if (foundStaff.password === password) {
                        setCurrentUser({ id: foundStaff.id, name: foundStaff.name, role: selectedRole });
                        onLogin(selectedRole);
                    } else {
                        setError('Incorrect password for this staff account.');
                        setIsLoggingIn(false);
                    }
                } else {
                    // If no password set, allow demo login (or we could require setting one)
                    setCurrentUser({ id: foundStaff.id, name: foundStaff.name, role: selectedRole });
                    onLogin(selectedRole);
                }
            } else {
                // If no staff found with that identifier, but role matches, show error
                if (staff.some(s => s.role === selectedRole)) {
                    setError(`No account found for "${identifier}" under the role: ${selectedRole}. Please check spelling or contact number.`);
                } else {
                    // Demo fallback for roles without staff data
                    setCurrentUser({ id: 'demo_1', name: `Demo ${selectedRole}`, role: selectedRole });
                    onLogin(selectedRole);
                }
                setIsLoggingIn(false);
            }
        }
    };

    /**
     * Handles the login submission.
     */
    const handleAdminLogin = (e) => {
        e.preventDefault();
        setError('');
        setIsLoggingIn(true);
        setTimeout(() => {
            processLogin();
        }, 1200); // 1.2s artificial loading delay
    };

    // --- 2.5. RENDER LOGIC ---
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-2xl relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-primary-50 rounded-full opacity-50"></div>

                <div className="relative z-10 text-center">
                    <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-primary-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-9.998 12.078 12.078 0 01.665-6.479L12 14z" />
                        </svg>
                    </div>
                    <h1 className="mt-6 text-3xl font-extrabold text-slate-900 tracking-tight">School Admin</h1>
                    <p className="mt-2 text-sm text-slate-500 font-medium">Management Information System</p>
                </div>

                {!isInstalled && deferredPrompt && (
                    <div className="relative z-10 bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-xl">
                                💻
                            </div>
                            <div>
                                <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Desktop App Available</p>
                                <p className="text-[11px] text-emerald-700 font-medium">Install for a standalone experience</p>
                            </div>
                        </div>
                        <button
                            onClick={handleInstall}
                            className="text-[11px] font-bold text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-all active:scale-95 shadow-sm"
                        >
                            INSTALL
                        </button>
                    </div>
                )}

                <form onSubmit={handleAdminLogin} className="relative z-10 mt-8 space-y-6">
                    <div className="space-y-1">
                        <label htmlFor="role" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Select Role</label>
                        <select
                            id="role"
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="w-full px-4 py-3 text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        >
                            {Object.values(UserRole).map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>

                    {selectedRole !== UserRole.Admin && (
                        <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                            <label htmlFor="identifier" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Staff Name or Contact</label>
                            <input
                                id="identifier"
                                type="text"
                                required
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="w-full px-4 py-3 text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                                placeholder="e.g. John Doe"
                            />
                        </div>
                    )}

                    <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                        <label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                            {selectedRole === UserRole.Admin ? 'Admin Password' : 'Staff Password'}
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                required={selectedRole === UserRole.Admin || staff.some(s => ((s.name || '').toLowerCase() === identifier.trim().toLowerCase() || (s.contact || '').toLowerCase() === identifier.trim().toLowerCase()) && s.password)}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setError('');
                                }}
                                className="w-full px-4 py-3 pr-12 text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                placeholder="••••••••"
                            />
                            {password && (
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors rounded-md"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-1">
                            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p className="text-xs font-semibold text-red-600">{error}</p>
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoggingIn}
                            className={`w-full relative px-4 py-3 font-bold text-white bg-primary-600 rounded-xl shadow-lg shadow-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all active:scale-95 overflow-hidden group ${
                                isLoggingIn ? 'opacity-90 cursor-wait' : 'hover:bg-primary-700'
                            }`}
                        >
                            {isLoggingIn ? (
                                <div className="flex items-center justify-center space-x-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Authenticating...</span>
                                </div>
                            ) : (
                                <span>Log in to Dashboard</span>
                            )}
                            
                            {/* Ambient light effect on button */}
                            {!isLoggingIn && (
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:-translate-y-0 transition-transform duration-300 ease-out z-[1] rounded-xl mix-blend-overlay pointer-events-none"></div>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
