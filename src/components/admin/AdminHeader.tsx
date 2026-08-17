'use client';

import React from 'react';
import {
    Shield,
    UtensilsCrossed,
    Layers,
    Grid,
    Lock,
    Receipt,
    BarChart3,
    RefreshCw,
    Trash2,
    Monitor,
    ChefHat,
    Package,
    Sparkles,
    Users,
} from 'lucide-react';

interface AdminHeaderProps {
    activeTab: 'menu' | 'categories' | 'crm' | 'inventory' | 'loyalty' | 'tables' | 'staff' | 'invoices' | 'reports';
    setActiveTab: (tab: 'menu' | 'categories' | 'crm' | 'inventory' | 'loyalty' | 'tables' | 'staff' | 'invoices' | 'reports') => void;
    isSeeding: boolean;
    isWiping: boolean;
    seedStatus: string | null;
    handleSyncClick: () => void;
    handleWipeClick: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
    activeTab,
    setActiveTab,
    isSeeding,
    isWiping,
    seedStatus,
    handleSyncClick,
    handleWipeClick,
}) => {
    return (
        <div className="space-y-6">
            {/* Top Header Bar */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-[#1c3a1e]/15 gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-[#1c3a1e] tracking-tight flex items-center gap-2">
                            <Shield className="h-6 w-6 text-[#d4af37]" />
                            <span>Skylight Village Admin Portal</span>
                        </h1>
                        <p className="text-xs text-gray-600 font-medium">
                            Manage menu catalog, tables, staff PINs, invoice references & detailed analytics
                        </p>
                    </div>
                </div>

                {/* Navigation & Database Quick Actions */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    <a
                        href="/pos"
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-black text-xs px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                    >
                        <Monitor className="h-4 w-4 text-[#1c3a1e]" />
                        <span>POS Waiter Terminal</span>
                    </a>

                    <a
                        href="/kds"
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-black text-xs px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                    >
                        <ChefHat className="h-4 w-4 text-[#1c3a1e]" />
                        <span>Kitchen KDS</span>
                    </a>
                </div>
            </header>

            {/* Sync / Seed Status Notification Banner */}
            {seedStatus && (
                <div className="bg-[#1c3a1e] text-white px-5 py-3 rounded-2xl text-xs font-black shadow-md flex items-center justify-between animate-fade-in">
                    <span>⚡ {seedStatus}</span>
                </div>
            )}

            {/* Navigation Tab Bar */}
            <div className="flex flex-wrap gap-2 border-b border-[#1c3a1e]/15 pb-4">
                {[
                    { id: 'menu', label: 'Menu Items Catalog', icon: UtensilsCrossed },
                    { id: 'categories', label: 'Menu Categories', icon: Layers },
                    { id: 'crm', label: 'Guests & CRM', icon: Users },
                    { id: 'inventory', label: 'Recipe & Inventory BOM', icon: Package },
                    { id: 'loyalty', label: 'Loyalty & VIP Rewards', icon: Sparkles },
                    { id: 'tables', label: 'Tables & QR Manager', icon: Grid },
                    { id: 'staff', label: 'Staff Accounts & PINs', icon: Lock },
                    { id: 'invoices', label: 'Order History & Invoices', icon: Receipt },
                    { id: 'reports', label: 'Odoo Analytics & Reports', icon: BarChart3 },
                ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <a
                            key={tab.id}
                            href={`/admin/${tab.id}`}
                            onClick={(e) => {
                                if (setActiveTab) {
                                    setActiveTab(tab.id as any);
                                }
                            }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border ${isActive
                                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md scale-[1.02]'
                                : 'bg-white text-gray-700 border-[#1c3a1e]/15 hover:bg-[#eaf2eb] hover:text-[#1c3a1e]'
                                }`}
                        >
                            <Icon className="h-4 w-4" />
                            <span>{tab.label}</span>
                        </a>
                    );
                })}
            </div>
        </div>
    );
};
