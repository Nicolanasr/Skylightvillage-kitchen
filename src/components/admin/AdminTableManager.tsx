'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Table } from '@/lib/types';
import { addTableAction, updateTableAction, deleteTableAction } from '@/app/actions/admin-actions';
import { QRCodeSVG } from 'qrcode.react';
import { LayoutGrid, Printer, Globe, Edit3, Trash2 } from 'lucide-react';

interface AdminTableManagerProps {
    tables: Table[];
    refreshPOSData: () => void;
}

export const AdminTableManager: React.FC<AdminTableManagerProps> = ({
    tables,
    refreshPOSData,
}) => {
    const [isClient, setIsClient] = useState(false);
    const [qrBaseUrl, setQrBaseUrl] = useState('https://menu.skylightvillagelb.com');
    const [customTableNumInput, setCustomTableNumInput] = useState('');
    const [editingTableId, setEditingTableId] = useState<string | null>(null);
    const [editingTableNumInput, setEditingTableNumInput] = useState('');
    const [selectedPrintTable, setSelectedPrintTable] = useState<number | null>(null);

    useEffect(() => {
        setIsClient(true);
        if (typeof window !== 'undefined') {
            setQrBaseUrl(window.location.origin);
        }
    }, []);

    const handlePrintAllQRCodes = () => {
        setSelectedPrintTable(null);
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const handlePrintSingleTableQR = (tableNum: number) => {
        setSelectedPrintTable(tableNum);
        setTimeout(() => {
            window.print();
            setTimeout(() => setSelectedPrintTable(null), 500);
        }, 150);
    };

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
                <div>
                    <h2 className="text-xl font-black text-[#1c3a1e] flex items-center gap-2">
                        <LayoutGrid className="h-5 w-5 text-[#d4af37]" />
                        <span>Table Management & Live Vector QR Codes</span>
                    </h2>
                    <p className="text-xs text-gray-600 font-medium mt-0.5">
                        Add or edit tables in your database, manage QR codes, and print high-contrast ordering cards.
                    </p>
                </div>

                <button
                    onClick={handlePrintAllQRCodes}
                    className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-6 py-3.5 rounded-2xl text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                    <Printer className="h-4 w-4" />
                    <span>Print All Table QR Codes ({tables.length})</span>
                </button>
            </div>

            {/* Domain Configurator & Add Table Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
                <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[#1c3a1e]">
                    <div>
                        <h3 className="text-sm font-extrabold text-[#1c3a1e] mb-0.5 flex items-center gap-2">
                            <Globe className="h-4 w-4 text-[#d4af37]" />
                            <span>Target Ordering Base Domain</span>
                        </h3>
                        <p className="text-xs text-gray-600 font-medium">
                            QR codes append <code className="text-[#1c3a1e] font-bold">/order?table=[N]&token=...</code>
                        </p>
                    </div>
                    <input
                        type="text"
                        value={qrBaseUrl}
                        onChange={(e) => setQrBaseUrl(e.target.value)}
                        placeholder="https://menu.skylightvillagelb.com"
                        className="w-full sm:w-80 bg-[#fafbfa] border border-[#1c3a1e]/20 focus:border-[#1c3a1e] rounded-2xl px-4 py-2.5 text-xs text-[#1c3a1e] font-mono font-bold focus:outline-none"
                    />
                </div>

                <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-6 shadow-xs flex flex-col justify-between text-[#1c3a1e]">
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const tblNum = parseInt(customTableNumInput, 10);
                            if (tblNum > 0) {
                                const res = await addTableAction(tblNum);
                                if (res.success) {
                                    setCustomTableNumInput('');
                                    refreshPOSData();
                                } else {
                                    alert(res.error);
                                }
                            }
                        }}
                        className="flex gap-3"
                    >
                        <input
                            type="number"
                            value={customTableNumInput}
                            onChange={(e) => setCustomTableNumInput(e.target.value)}
                            placeholder="Table Number (e.g. 13)"
                            className="flex-1 bg-[#fafbfa] border border-[#1c3a1e]/20 focus:border-[#1c3a1e] rounded-2xl px-4 py-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none"
                        />
                        <button
                            type="submit"
                            className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-5 py-3 rounded-2xl text-xs transition-all whitespace-nowrap cursor-pointer shadow-xs"
                        >
                            + Add Table
                        </button>
                    </form>
                </div>
            </div>

            {/* Table QR Cards Grid */}
            <div className="print-qr-container">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
                    {tables.map((tbl) => {
                        const qrTargetUrl = `${qrBaseUrl}/order?table=${tbl.table_number}&token=${tbl.qr_code_token}`;

                        if (selectedPrintTable !== null && selectedPrintTable !== tbl.table_number) {
                            return <div key={tbl.id} className="hidden print:hidden" />;
                        }

                        return (
                            <div
                                key={tbl.id}
                                className="bg-white border-2 border-[#1c3a1e]/15 rounded-3xl p-5 text-center flex flex-col items-center justify-between shadow-xs relative overflow-hidden transition-all hover:shadow-md print:bg-transparent print:text-black print:border-none print:shadow-none print:break-inside-avoid print:p-0 print:m-0 print:w-auto print:mx-auto"
                            >
                                {/* Header */}
                                <div className="w-full flex justify-between items-center mb-3 pb-3 border-b border-[#1c3a1e]/15 print:pb-0 print:border-none">
                                    {editingTableId === tbl.id ? (
                                        <form
                                            onSubmit={async (e) => {
                                                e.preventDefault();
                                                const newNum = parseInt(editingTableNumInput, 10);
                                                if (newNum > 0) {
                                                    const res = await updateTableAction(tbl.id, newNum);
                                                    if (res.success) {
                                                        setEditingTableId(null);
                                                        refreshPOSData();
                                                    } else {
                                                        alert(res.error);
                                                    }
                                                }
                                            }}
                                            className="flex items-center gap-1.5 w-full justify-between"
                                        >
                                            <input
                                                type="number"
                                                value={editingTableNumInput}
                                                onChange={(e) => setEditingTableNumInput(e.target.value)}
                                                className="w-24 bg-[#fafbfa] border border-[#1c3a1e] rounded-xl px-2.5 py-1 text-xs text-[#1c3a1e] font-extrabold focus:outline-none"
                                                autoFocus
                                            />
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="submit"
                                                    className="bg-[#1c3a1e] text-white text-[10px] font-black px-2.5 py-1 rounded-lg cursor-pointer"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingTableId(null)}
                                                    className="bg-[#eaf2eb] text-[#1c3a1e] text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            <div className="m-auto flex items-center gap-2">
                                                <span className="bg-[#1c3a1e] text-white font-black text-sm px-3.5 py-1 rounded-xl print:bg-black print:text-white print:px-5 print:py-1 print:text-lg">
                                                    TABLE #{tbl.table_number}
                                                </span>
                                                <span
                                                    className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border print:hidden ${tbl.status === 'occupied'
                                                            ? 'bg-blue-500/10 text-blue-900 border-blue-500/30'
                                                            : 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                                                        }`}
                                                >
                                                    {tbl.status}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1 print:hidden">
                                                <button
                                                    onClick={() => {
                                                        setEditingTableId(tbl.id);
                                                        setEditingTableNumInput(String(tbl.table_number));
                                                    }}
                                                    className="text-gray-500 hover:text-[#1c3a1e] p-1.5 rounded-lg hover:bg-[#eaf2eb] transition-colors cursor-pointer"
                                                    title="Edit Table Number"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                </button>

                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`Delete Table #${tbl.table_number}?`)) {
                                                            await deleteTableAction(tbl.id);
                                                            refreshPOSData();
                                                        }
                                                    }}
                                                    className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                                    title="Delete Table"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Low-Density High-Contrast Clean QR Code */}
                                <div className="relative inline-block bg-white p-3 rounded-2xl shadow-inner mb-3 border-2 border-gray-200 print:border-none print:shadow-none print:p-0">
                                    {isClient && (
                                        <QRCodeSVG
                                            value={qrTargetUrl}
                                            size={180}
                                            level="L"
                                            includeMargin={true}
                                            fgColor="#000000"
                                            bgColor="#ffffff"
                                        />
                                    )}

                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="bg-[#fff] p-1 rounded-xl flex items-center justify-center h-10 w-10 border border-slate-300">
                                            <img
                                                src="/images/Skylight-logo-white.png"
                                                alt="Skylight Logo"
                                                className="h-5 w-auto object-contain filter invert"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Card Action Buttons */}
                                <div className="w-full flex flex-col gap-2 print:hidden">
                                    <button
                                        onClick={() => handlePrintSingleTableQR(tbl.table_number)}
                                        className="w-full bg-[#eaf2eb] hover:bg-[#d8e6da] text-[#1c3a1e] border border-[#1c3a1e]/15 font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                    >
                                        <Printer className="h-3.5 w-3.5 text-[#1c3a1e]" />
                                        <span>Print Table QR Code</span>
                                    </button>

                                    <a
                                        href={qrTargetUrl}
                                        target="_blank"
                                        className="w-full bg-[#fafbfa] hover:bg-[#eaf2eb] border border-[#1c3a1e]/10 text-gray-700 font-bold py-1.5 rounded-xl text-[11px] block transition-all"
                                    >
                                        Test Customer QR Link
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Dedicated Print Portal attached directly to document.body for @media print */}
            {isClient && typeof document !== 'undefined' && createPortal(
                <div className="print-qr-container hidden print:block bg-white text-black p-4">
                    <div className="grid grid-cols-2 gap-8 p-4">
                        {tables.map((tbl) => {
                            if (selectedPrintTable !== null && selectedPrintTable !== tbl.table_number) return null;
                            const qrTargetUrl = `${qrBaseUrl}/order?table=${tbl.table_number}&token=${tbl.qr_code_token}`;
                            return (
                                <div
                                    key={tbl.id}
                                    className="border-4 border-black rounded-3xl p-8 text-center flex flex-col items-center justify-between bg-white shadow-none break-inside-avoid min-h-[350px]"
                                >
                                    <div className="text-2xl font-black text-black tracking-wider uppercase mb-3">
                                        SKYLIGHT VILLAGE • TABLE #{tbl.table_number}
                                    </div>
                                    <div className="p-4 bg-white border-2 border-black rounded-2xl mb-3">
                                        <QRCodeSVG
                                            value={qrTargetUrl}
                                            size={220}
                                            level="L"
                                            includeMargin={true}
                                            fgColor="#000000"
                                            bgColor="#ffffff"
                                        />
                                    </div>
                                    <div className="text-sm font-black text-black uppercase tracking-widest">
                                        SCAN QR CODE TO VIEW MENU & ORDER
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
