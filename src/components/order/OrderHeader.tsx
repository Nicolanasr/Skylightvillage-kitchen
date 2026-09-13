'use client';

import React from 'react';
import Image from 'next/image';
import { HelpCircle, Star, Receipt, Lock } from 'lucide-react';
import { Table } from '@/lib/types';
import { formatUsd } from '@/lib/currency';

interface OrderHeaderProps {
    table: Table | null;
    isBillRequested: boolean;
    liveBillTotalUsd: number;
    onOpenGuide: () => void;
    onOpenBill: () => void;
}

export const OrderHeader: React.FC<OrderHeaderProps> = ({
    table,
    isBillRequested,
    liveBillTotalUsd,
    onOpenGuide,
    onOpenBill,
}) => {
    return (
        <>
            {/* Locked Screen Overlay if Pre-Bill Requested */}
            {isBillRequested && (
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-amber-800 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Pre-Bill requested. Cart submissions are temporarily locked.</span>
                    </div>
                    <button
                        onClick={onOpenBill}
                        className="underline font-bold text-amber-700 hover:text-amber-900 cursor-pointer"
                    >
                        View Check
                    </button>
                </div>
            )}

            {/* Header with Official Skylight Logo */}
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#1c3a1e]/10 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <Image
                        src="/images/Skylight-logo-icon.png"
                        alt="Skylight Village Logo"
                        width={40}
                        height={40}
                        style={{ width: '40px', height: '40px' }}
                        className="h-10 w-auto object-contain filter invert"
                    />
                    <div>
                        <h1 className="text-base font-black text-[#1c3a1e] leading-tight tracking-tight">
                            Skylight Village
                        </h1>
                        <p className="text-xs text-[#d4af37] font-bold">
                            Table #{table?.table_number || 1}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Interactive Ordering Guide Button */}
                    <button
                        onClick={onOpenGuide}
                        className="flex items-center gap-1.5 bg-[#eaf2eb] border border-[#1c3a1e]/15 hover:border-[#1c3a1e]/30 text-[#1c3a1e] text-xs px-2.5 py-2 rounded-xl font-bold transition-all cursor-pointer"
                        title="View Ordering Guide"
                    >
                        <HelpCircle className="h-4 w-4 text-[#1c3a1e]" />
                        <span className="hidden sm:inline">Guide</span>
                    </button>

                    {/* Google Review Button */}
                    <a
                        href="https://g.page/r/CVjTZaAHNiz0EAI/review"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:flex items-center gap-1.5 bg-[#faf5e6] border border-[#d4af37]/40 hover:border-[#d4af37] text-[#997a15] text-xs px-3 py-2 rounded-xl font-bold transition-all"
                        title="Leave us a Google Review!"
                    >
                        <Star className="h-4 w-4 fill-[#d4af37] text-[#d4af37]" />
                        <span>Review Us</span>
                    </a>

                    {/* Running Bill Button */}
                    <button
                        onClick={onOpenBill}
                        className="flex items-center gap-1.5 bg-[#eaf2eb] border border-[#1c3a1e]/15 hover:border-[#1c3a1e]/30 text-[#1c3a1e] text-xs px-3 py-2 rounded-xl font-bold transition-all cursor-pointer"
                    >
                        <Receipt className="h-4 w-4 text-[#1c3a1e]" />
                        <span>{formatUsd(liveBillTotalUsd)}</span>
                    </button>
                </div>
            </header>
        </>
    );
};
