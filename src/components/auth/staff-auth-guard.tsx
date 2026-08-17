'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Lock, ShieldAlert, LogOut, UserCheck, Users, Shield } from 'lucide-react';
import { StaffMember } from '@/lib/types';
import { logStaffActivity, getStaffRoster } from '@/app/actions/audit-actions';

interface StaffAuthGuardProps {
    children: React.ReactNode;
    pageTitle?: string;
}

// Fallback Default Staff Roster
const DEFAULT_STAFF_MEMBERS: StaffMember[] = [
];

export function StaffAuthGuard({ children, pageTitle = 'Staff Portal' }: StaffAuthGuardProps) {
    const [activeStaff, setActiveStaff] = useState<StaffMember | null>(null);
    const [staffRoster, setStaffRoster] = useState<StaffMember[]>(DEFAULT_STAFF_MEMBERS);
    const [pinInput, setPinInput] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        const storedStaff = sessionStorage.getItem('skylight_staff_member');
        if (storedStaff) {
            try {
                const parsed = JSON.parse(storedStaff);
                if (pageTitle.toLowerCase().includes('admin') && parsed.role !== 'Manager') {
                    sessionStorage.removeItem('skylight_staff_member');
                    setActiveStaff(null);
                    setErrorMsg('Manager PIN required to access Admin Portal');
                } else {
                    setActiveStaff(parsed);
                }
            } catch (e) {
                sessionStorage.removeItem('skylight_staff_member');
            }
        }

        getStaffRoster().then((roster) => {
            if (roster && roster.length > 0) {
                setStaffRoster(roster);
            }
        }).catch(() => { });
    }, []);

    const handlePinSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // 1. Check live database roster first
        // 2. Check fallback default roster
        // 3. Fallback admin 9999 PIN
        const matchedStaff = staffRoster.find((s) => s.pin === pinInput) ||
            DEFAULT_STAFF_MEMBERS.find((s) => s.pin === pinInput) ||
            (pinInput === '9999' ? { id: 'stf-admin', name: 'Admin Manager', pin: '9999', role: 'Manager' as const } : null);

        if (matchedStaff) {
            if (pageTitle.toLowerCase().includes('admin') && matchedStaff.role !== 'Manager') {
                setErrorMsg('Access Denied: Only Manager accounts can access the Admin Portal');
                setPinInput('');
                return;
            }

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
            setErrorMsg('Invalid PIN. Check staff roster in Admin');
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
            <div className="min-h-screen bg-[#fafbfa] text-[#1c271c] flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white border border-[#1c3a1e]/15 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
                    {/* Top Brand Decorative Gradient */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#d4af37] via-[#1c3a1e] to-[#d4af37]" />

                    {/* Logo */}
                    <div className="flex justify-center mb-4">
                        <Image
                            src="/images/Skylight-logo-icon.png"
                            alt="Skylight Village Logo"
                            width={48}
                            height={48}
                            style={{ width: 'auto', height: 'auto' }}
                            unoptimized
                            className="h-12 w-auto object-contain mb-2"
                        />
                    </div>

                    <div className="h-14 w-14 rounded-2xl bg-[#eaf2eb] border border-[#1c3a1e]/20 text-[#1c3a1e] flex items-center justify-center mx-auto mb-3 shadow-inner">
                        <Lock className="h-7 w-7" />
                    </div>

                    <h2 className="text-xl font-black text-[#1c3a1e] tracking-tight">Staff PIN Access</h2>
                    <p className="text-xs text-gray-600 mt-1 mb-6 font-medium">
                        Enter your personal PIN code for <strong className="text-[#1c3a1e]">{pageTitle}</strong>
                    </p>

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
                                className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 focus:border-[#1c3a1e] rounded-2xl px-4 py-3.5 text-center text-2xl font-mono tracking-widest text-[#1c3a1e] focus:outline-none transition-colors"
                                autoFocus
                            />
                        </div>

                        {errorMsg && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-700 text-xs font-semibold px-3 py-2 rounded-xl mb-4 flex items-center justify-center gap-1.5">
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
                                    className="bg-[#fafbfa] hover:bg-[#eaf2eb] text-[#1c3a1e] font-extrabold text-xl py-3.5 rounded-2xl border border-[#1c3a1e]/15 transition-all active:scale-95 shadow-sm"
                                >
                                    {num}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={handleClear}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-700 font-extrabold text-xs py-3.5 rounded-2xl border border-red-500/20 transition-all uppercase tracking-wider"
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={() => handleKeyClick('0')}
                                className="bg-[#fafbfa] hover:bg-[#eaf2eb] text-[#1c3a1e] font-extrabold text-xl py-3.5 rounded-2xl border border-[#1c3a1e]/15 transition-all active:scale-95 shadow-sm"
                            >
                                0
                            </button>
                            <button
                                type="submit"
                                className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black text-xs py-3.5 rounded-2xl shadow-lg transition-all uppercase tracking-wider"
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
            <div className="bg-white border-b border-[#1c3a1e]/15 px-4 py-2 flex items-center justify-between text-xs text-[#1c3a1e] shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-[#eaf2eb] border border-[#1c3a1e]/20 text-[#1c3a1e] px-3 py-1 rounded-xl">
                        <UserCheck className="h-4 w-4 text-[#1c3a1e]" />
                        <span className="font-bold">
                            {activeStaff.name} ({activeStaff.role})
                        </span>
                    </div>
                    <span className="text-gray-500 hidden sm:inline">• Logged into {pageTitle}</span>
                </div>

                <button
                    onClick={handleLogout}
                    className="text-[#1c3a1e] hover:text-[#d4af37] text-xs font-bold flex items-center gap-1.5 bg-[#fafbfa] px-3 py-1.5 rounded-xl border border-[#1c3a1e]/15 transition-colors shadow-sm"
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
