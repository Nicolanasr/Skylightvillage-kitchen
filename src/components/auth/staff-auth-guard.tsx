'use client';

import { useState, useEffect } from 'react';
import { Lock, ShieldAlert, LogOut, UserCheck, Users, Shield } from 'lucide-react';
import { StaffMember } from '@/lib/types';
import { logStaffActivity } from '@/app/actions/audit-actions';

interface StaffAuthGuardProps {
    children: React.ReactNode;
    pageTitle?: string;
}

// Pre-seeded Staff PIN Registry
const DEFAULT_STAFF_MEMBERS: StaffMember[] = [
    { id: 'stf-1', name: 'John', pin: '1001', role: 'Waiter' },
    { id: 'stf-2', name: 'Sarah', pin: '1002', role: 'Waiter' },
    { id: 'stf-3', name: 'Charbel', pin: '1003', role: 'Cashier' },
    { id: 'stf-4', name: 'Chef Antoine', pin: '2001', role: 'Chef' },
    { id: 'stf-5', name: 'Manager Admin', pin: '1234', role: 'Manager' },
];

export function StaffAuthGuard({ children, pageTitle = 'Staff Portal' }: StaffAuthGuardProps) {
    const [activeStaff, setActiveStaff] = useState<StaffMember | null>(null);
    const [pinInput, setPinInput] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        const storedStaff = sessionStorage.getItem('skylight_staff_member');
        if (storedStaff) {
            try {
                setActiveStaff(JSON.parse(storedStaff));
            } catch (e) {
                sessionStorage.removeItem('skylight_staff_member');
            }
        }
    }, []);

    const handlePinSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const matchedStaff = DEFAULT_STAFF_MEMBERS.find((s) => s.pin === pinInput) ||
            (pinInput === '9999' ? { id: 'stf-admin', name: 'Admin Manager', pin: '9999', role: 'Manager' as const } : null);

        if (matchedStaff) {
            sessionStorage.setItem('skylight_staff_member', JSON.stringify(matchedStaff));
            setActiveStaff(matchedStaff);
            setErrorMsg(null);

            // Audit Log Staff Login
            await logStaffActivity({
                staffName: matchedStaff.name,
                staffRole: matchedStaff.role,
                actionType: 'staff_login',
                details: `Logged into ${pageTitle}`,
            });
        } else {
            setErrorMsg('Invalid PIN. Check staff roster or use 1234 for Manager');
            setPinInput('');
        }
    };

    const handleKeyClick = (num: string) => {
        if (pinInput.length < 8) {
            const newPin = pinInput + num;
            setPinInput(newPin);
            setErrorMsg(null);
        }
    };

    const handleClear = () => {
        setPinInput('');
        setErrorMsg(null);
    };

    const handleLogout = async () => {
        if (activeStaff) {
            await logStaffActivity({
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                actionType: 'staff_logout',
                details: `Logged out / Locked terminal (${pageTitle})`,
            });
        }
        sessionStorage.removeItem('skylight_staff_member');
        setActiveStaff(null);
        setPinInput('');
    };

    if (!activeStaff) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
                    {/* Top Brand Decorative Gradient */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-emerald-500 to-amber-500" />

                    {/* Logo */}
                    <div className="flex justify-center mb-4">
                        <img
                            src="/images/Skylight-logo-white.png"
                            alt="Skylight Village Logo"
                            className="h-12 w-auto object-contain mb-2"
                        />
                    </div>

                    <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                        <Lock className="h-7 w-7" />
                    </div>

                    <h2 className="text-xl font-black text-slate-100 tracking-tight">Staff PIN Access</h2>
                    <p className="text-xs text-slate-400 mt-1 mb-6 font-medium">
                        Enter your personal PIN code for <strong className="text-slate-200">{pageTitle}</strong>
                    </p>

                    {/* Staff Roster Quick Reference */}
                    <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3 mb-6 text-left">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block mb-2 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>Staff PIN Roster:</span>
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-300">
                            <div>• John (Waiter): <code className="text-amber-300 font-bold">1001</code></div>
                            <div>• Sarah (Waiter): <code className="text-amber-300 font-bold">1002</code></div>
                            <div>• Charbel (Cashier): <code className="text-amber-300 font-bold">1003</code></div>
                            <div>• Chef Antoine: <code className="text-amber-300 font-bold">2001</code></div>
                            <div className="col-span-2 text-center pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                                Manager Admin PIN: <code className="text-emerald-400 font-bold">1234</code>
                            </div>
                        </div>
                    </div>

                    {/* PIN Input Form */}
                    <form onSubmit={handlePinSubmit} className="mb-4">
                        <div className="relative mb-4">
                            <input
                                type="password"
                                value={pinInput}
                                onChange={(e) => {
                                    setPinInput(e.target.value);
                                    setErrorMsg(null);
                                }}
                                placeholder="Enter 4-Digit Staff PIN"
                                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-2xl px-4 py-3.5 text-center text-2xl font-mono tracking-widest text-amber-300 focus:outline-none transition-colors"
                                autoFocus
                            />
                        </div>

                        {errorMsg && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold px-3 py-2 rounded-xl mb-4 flex items-center justify-center gap-1.5">
                                <ShieldAlert className="h-4 w-4" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        {/* Touchscreen Numeric Keypad */}
                        <div className="grid grid-cols-3 gap-2.5 mb-4">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => handleKeyClick(num)}
                                    className="bg-slate-950 hover:bg-slate-800 active:bg-amber-500/20 text-slate-100 font-extrabold text-xl py-3.5 rounded-2xl border border-slate-800/80 transition-all active:scale-95"
                                >
                                    {num}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={handleClear}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-extrabold text-xs py-3.5 rounded-2xl border border-red-500/20 transition-all uppercase tracking-wider"
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={() => handleKeyClick('0')}
                                className="bg-slate-950 hover:bg-slate-800 active:bg-amber-500/20 text-slate-100 font-extrabold text-xl py-3.5 rounded-2xl border border-slate-800/80 transition-all active:scale-95"
                            >
                                0
                            </button>
                            <button
                                type="submit"
                                className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs py-3.5 rounded-2xl shadow-lg shadow-amber-500/20 transition-all uppercase tracking-wider"
                            >
                                Unlock
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Top Active Staff Member Header Bar */}
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-xl">
                        <UserCheck className="h-4 w-4" />
                        <span className="font-bold">
                            {activeStaff.name} ({activeStaff.role})
                        </span>
                    </div>
                    <span className="text-slate-500 hidden sm:inline">• Logged into {pageTitle}</span>
                </div>

                <button
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-amber-400 text-xs font-bold flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 transition-colors"
                    title="Lock Staff Session"
                >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Lock / Switch Staff</span>
                </button>
            </div>

            {children}
        </div>
    );
}
