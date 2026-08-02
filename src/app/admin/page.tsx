'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { StaffAuthGuard } from '@/components/auth/staff-auth-guard';
import { useRealtimePOS } from '@/hooks/useRealtimePOS';
import {
    createCategory,
    deleteCategory,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    addStaffMember,
    deleteStaffMember,
    seedDatabaseMenu,
    wipeAllDatabaseTestDataAction,
    addTableAction,
    updateTableAction,
    deleteTableAction,
    setTotalTablesCountAction,
} from '../actions/admin-actions';
import { transformGoogleDriveUrl } from '@/lib/drive';
import {
    Utensils,
    PlusCircle,
    Trash2,
    Edit3,
    Save,
    Users,
    Shield,
    BarChart3,
    DollarSign,
    Image as ImageIcon,
    CheckCircle2,
    XCircle,
    Monitor,
    ChefHat,
    QrCode,
    Database,
    FileText,
    Search,
    Receipt,
    RotateCcw,
    LayoutGrid,
    Printer,
    Globe,
} from 'lucide-react';
import { MenuItem, StationType } from '@/lib/types';
import { calculateBillTotals, formatUsd, getInvoiceReference } from '@/lib/currency';

export default function AdminPage() {
    return (
        <StaffAuthGuard pageTitle="Skylight Village Admin Manager">
            <AdminContent />
        </StaffAuthGuard>
    );
}

function AdminContent() {
    const { categories, menuItems, orderItems, tables, sessions, payments, refreshPOSData } = useRealtimePOS();
    const [activeTab, setActiveTab] = useState<'menu' | 'categories' | 'tables' | 'staff' | 'invoices' | 'reports'>('menu');

    // Tables Management State
    const [customTableNumInput, setCustomTableNumInput] = useState('');
    const [targetTotalTablesInput, setTargetTotalTablesInput] = useState('12');
    const [editingTableId, setEditingTableId] = useState<string | null>(null);
    const [editingTableNumInput, setEditingTableNumInput] = useState<string>('');

    // QR Generator State
    const [qrBaseUrl, setQrBaseUrl] = useState<string>('https://menu.skylightvillagelb.com');
    const [selectedPrintTable, setSelectedPrintTable] = useState<number | null>(null);
    const [isClient, setIsClient] = useState<boolean>(false);

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
        }, 200);
    };

    const handlePrintSingleTableQR = (tblNum: number) => {
        setSelectedPrintTable(tblNum);
        setTimeout(() => {
            window.print();
        }, 200);
    };

    // Search State
    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');

    // New Category State
    const [newCatName, setNewCatName] = useState('');

    // New Menu Item State
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
    const [newItemCatId, setNewItemCatId] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [newItemDesc, setNewItemDesc] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('5.00');
    const [newItemStation, setNewItemStation] = useState<StationType>('cold_mezza');
    const [newItemImage, setNewItemImage] = useState('');

    // Full Item Edit Modal State
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editCatId, setEditCatId] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [editStation, setEditStation] = useState<StationType>('cold_mezza');
    const [editImageUrl, setEditImageUrl] = useState('');

    // New Staff State
    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffPin, setNewStaffPin] = useState('');
    const [newStaffRole, setNewStaffRole] = useState<'Waiter' | 'Cashier' | 'Chef' | 'Manager'>('Waiter');

    const [seedStatus, setSeedStatus] = useState<string | null>(null);
    const [isSeeding, setIsSeeding] = useState(false);

    const handleCreateCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCatName.trim()) return;
        const res = await createCategory(newCatName);
        if (res.success) {
            setNewCatName('');
            refreshPOSData();
        }
    };

    const handleCreateMenuItemSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName.trim() || !newItemCatId) {
            alert('Please select category and enter dish name!');
            return;
        }

        const finalImage = transformGoogleDriveUrl(newItemImage);

        const res = await createMenuItem({
            categoryId: newItemCatId,
            name: newItemName,
            description: newItemDesc,
            priceUsd: parseFloat(newItemPrice) || 0,
            station: newItemStation,
            imageUrl: finalImage,
        });

        if (res.success) {
            setNewItemName('');
            setNewItemDesc('');
            setNewItemPrice('5.00');
            setNewItemImage('');
            setIsAddItemModalOpen(false);
            refreshPOSData();
        }
    };

    const handleOpenFullEdit = (item: MenuItem) => {
        setEditingItem(item);
        setEditName(item.name);
        setEditDesc(item.description || '');
        setEditCatId(item.category_id);
        setEditPrice(item.price_usd.toString());
        setEditStation(item.station);
        setEditImageUrl(item.image_url || '');
    };

    const handleSaveFullEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem || !editName.trim()) return;

        const finalImage = transformGoogleDriveUrl(editImageUrl);

        await updateMenuItem(editingItem.id, {
            name: editName,
            description: editDesc,
            priceUsd: parseFloat(editPrice) || 0,
            station: editStation,
            imageUrl: finalImage,
        });

        setEditingItem(null);
        refreshPOSData();
    };

    const handleAddStaffSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStaffName.trim() || !newStaffPin.trim()) return;
        const res = await addStaffMember(newStaffName, newStaffPin, newStaffRole);
        if (res.success) {
            setNewStaffName('');
            setNewStaffPin('');
            refreshPOSData();
        }
    };

    const handleSeedDatabaseClick = async () => {
        if (isSeeding) return;
        setIsSeeding(true);
        setSeedStatus('Syncing menu items & categories to database...');
        try {
            const res = await seedDatabaseMenu();
            if (res.success) {
                setSeedStatus(res.message || 'Database synced successfully!');
            } else {
                setSeedStatus(`Database sync error: ${res.error}`);
            }
        } finally {
            setIsSeeding(false);
            setTimeout(() => setSeedStatus(null), 5000);
        }
    };

    const [sessionStatusFilter, setSessionStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
    const [isWiping, setIsWiping] = useState(false);

    const handleWipeTestDataClick = async () => {
        if (isWiping) return;
        if (confirm('Are you sure you want to WIPE ALL test orders, active sessions, and payment history? This will reset your database completely clean for live operation.')) {
            setIsWiping(true);
            setSeedStatus('Wiping test data from database...');
            try {
                const res = await wipeAllDatabaseTestDataAction();
                if (res.success) {
                    setSeedStatus(res.message);
                    refreshPOSData();
                }
            } finally {
                setIsWiping(false);
                setTimeout(() => setSeedStatus(null), 5000);
            }
        }
    };

    const filteredSessions = sessions.filter((sess) => {
        const primaryTbl = tables.find((t) => t.id === sess.primary_table_id);
        const tblNum = primaryTbl?.table_number || 1;
        const invoiceRef = getInvoiceReference(tblNum, sess.id);
        const search = invoiceSearchTerm.toLowerCase().trim();

        if (sessionStatusFilter === 'active' && sess.status !== 'active') return false;
        if (sessionStatusFilter === 'closed' && sess.status !== 'closed') return false;

        if (!search) return true;

        const sessItems = orderItems.filter((i) => i.session_id === sess.id);
        const itemNamesStr = sessItems.map((i) => i.item_name.toLowerCase()).join(' ');
        const guestNamesStr = sessItems.map((i) => (i.guest_name || '').toLowerCase()).join(' ');

        return (
            invoiceRef.toLowerCase().includes(search) ||
            sess.id.toLowerCase().includes(search) ||
            tblNum.toString().includes(search) ||
            itemNamesStr.includes(search) ||
            guestNamesStr.includes(search)
        );
    });

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
            {/* Admin Top Header Bar */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 mb-8 border-b border-slate-800 gap-4">
                <div className="flex items-center gap-4">
                    <img
                        src="/images/Skylight-logo-icon.png"
                        alt="Skylight Village Logo"
                        className="h-12 w-auto object-contain"
                    />
                    <div>
                        <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
                            <Shield className="h-6 w-6 text-amber-400" />
                            <span>Skylight Village Admin Portal</span>
                        </h1>
                        <p className="text-xs text-slate-400 font-medium">
                            Manage Menu, Categories, Google Drive Images, Prices, Invoice Trackers & Staff User Access
                        </p>
                    </div>
                </div>

                {/* Quick Nav Links, DB Seed & Wipe Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleSeedDatabaseClick}
                        disabled={isSeeding}
                        className={`font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md ${isSeeding
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                            : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 active:scale-95'
                            }`}
                        title="Push all menu categories & items to Postgres Neon Database"
                    >
                        <Database className="h-4 w-4 text-emerald-400" />
                        <span>{isSeeding ? 'Syncing DB...' : 'Sync DB Menu'}</span>
                    </button>

                    <button
                        onClick={handleWipeTestDataClick}
                        disabled={isWiping}
                        className={`font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md ${isWiping
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                            : 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 active:scale-95'
                            }`}
                        title="Wipe all test orders, active sessions, and payment history"
                    >
                        <RotateCcw className="h-4 w-4 text-red-400" />
                        <span>{isWiping ? 'Wiping DB...' : 'Reset / Wipe Test Data'}</span>
                    </button>

                    <a
                        href="/pos"
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md"
                    >
                        <Monitor className="h-4 w-4" />
                        <span>POS Waiter Terminal</span>
                    </a>
                    <a
                        href="/kds"
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md"
                    >
                        <ChefHat className="h-4 w-4" />
                        <span>Kitchen KDS</span>
                    </a>
                </div>
            </header>

            {seedStatus && (
                <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold p-4 rounded-2xl animate-in fade-in">
                    {seedStatus}
                </div>
            )}

            {/* Admin Tabs Bar */}
            <div className="flex flex-wrap gap-3 mb-8 border-b border-slate-800 pb-4">
                <button
                    onClick={() => setActiveTab('menu')}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'menu'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                >
                    <Utensils className="h-4 w-4" />
                    <span>Menu & Items ({menuItems.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('categories')}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'categories'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                >
                    <PlusCircle className="h-4 w-4" />
                    <span>Categories ({categories.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('tables')}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'tables'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                >
                    <LayoutGrid className="h-4 w-4" />
                    <span>Tables & Floor Plan ({tables.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('invoices')}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'invoices'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                >
                    <Receipt className="h-4 w-4" />
                    <span>Invoice & Order Reference Tracker ({sessions.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('staff')}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'staff'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                >
                    <Users className="h-4 w-4" />
                    <span>Staff PIN Users</span>
                </button>

                <button
                    onClick={() => setActiveTab('reports')}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'reports'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                >
                    <BarChart3 className="h-4 w-4" />
                    <span>Sales & Audit Reports</span>
                </button>
            </div>

            {/* TAB 1: MENU ITEMS & PRICES MANAGER */}
            {activeTab === 'menu' && (
                <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-black text-slate-100">Skylight Village Menu Items</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Edit full details, change prices, update Google Drive images, or add new items</p>
                        </div>

                        <button
                            onClick={() => {
                                if (categories.length > 0) setNewItemCatId(categories[0].id);
                                setIsAddItemModalOpen(true);
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                        >
                            <PlusCircle className="h-4 w-4" />
                            <span>Add New Menu Item</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {menuItems.map((item) => {
                            const catName = categories.find((c) => c.id === item.category_id)?.name || 'Unassigned';
                            const displayImage = transformGoogleDriveUrl(item.image_url || '');

                            return (
                                <div
                                    key={item.id}
                                    className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl hover:border-slate-700 transition-all"
                                >
                                    <div>
                                        <div className="flex gap-3 mb-3">
                                            {displayImage ? (
                                                <img
                                                    src={displayImage}
                                                    alt={item.name}
                                                    className="h-14 w-14 rounded-2xl object-cover border border-slate-700 flex-shrink-0"
                                                    onError={(e) => {
                                                        (e.target as HTMLElement).style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <div className="h-14 w-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center flex-shrink-0">
                                                    <ImageIcon className="h-6 w-6 text-slate-600" />
                                                </div>
                                            )}

                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                                                        {catName}
                                                    </span>

                                                    <button
                                                        onClick={async () => {
                                                            await updateMenuItem(item.id, { available: !item.available });
                                                            refreshPOSData();
                                                        }}
                                                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 border ${item.available
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                                                            }`}
                                                    >
                                                        {item.available ? 'AVAILABLE' : 'SOLD OUT'}
                                                    </button>
                                                </div>

                                                <h3 className="text-base font-black text-slate-100 mt-1 leading-tight">{item.name}</h3>
                                            </div>
                                        </div>

                                        {item.description && (
                                            <p className="text-xs text-slate-400 mb-3 line-clamp-2">{item.description}</p>
                                        )}

                                        <div className="text-[11px] text-slate-500 font-semibold mb-2">
                                            Station: <strong className="text-slate-300 uppercase">{item.station.replace('_', ' ')}</strong>
                                        </div>
                                    </div>

                                    {/* Card Actions Footer */}
                                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between mt-2">
                                        <span className="text-base font-black text-amber-400">
                                            ${Number(item.price_usd).toFixed(2)}
                                        </span>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleOpenFullEdit(item)}
                                                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-400 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all"
                                            >
                                                <Edit3 className="h-3.5 w-3.5" />
                                                <span>Edit Dish</span>
                                            </button>

                                            <button
                                                onClick={async () => {
                                                    if (confirm(`Delete "${item.name}" from menu?`)) {
                                                        await deleteMenuItem(item.id);
                                                        refreshPOSData();
                                                    }
                                                }}
                                                className="text-slate-500 hover:text-red-400 p-2 rounded-xl text-xs transition-colors"
                                                title="Delete Item"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: CATEGORIES MANAGER */}
            {activeTab === 'categories' && (
                <div className="max-w-2xl">
                    <h2 className="text-xl font-black text-slate-100 mb-2">Menu Categories</h2>
                    <p className="text-xs text-slate-400 mb-6">Create new menu categories or organize existing ones</p>

                    <form onSubmit={handleCreateCategorySubmit} className="flex gap-3 mb-8">
                        <input
                            type="text"
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            placeholder="Enter New Category Name..."
                            className="flex-1 bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-2xl px-4 py-3 text-xs text-slate-100 focus:outline-none transition-colors"
                        />
                        <button
                            type="submit"
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                        >
                            <PlusCircle className="h-4 w-4" />
                            <span>Create Category</span>
                        </button>
                    </form>

                    <div className="space-y-3">
                        {categories.map((cat) => {
                            const itemCount = menuItems.filter((m) => m.category_id === cat.id).length;
                            return (
                                <div
                                    key={cat.id}
                                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between"
                                >
                                    <div>
                                        <span className="font-extrabold text-sm text-slate-100">{cat.name}</span>
                                        <span className="text-xs text-slate-400 block mt-0.5">{itemCount} Menu Items</span>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            if (confirm(`Delete category "${cat.name}"?`)) {
                                                await deleteCategory(cat.id);
                                                refreshPOSData();
                                            }
                                        }}
                                        className="text-slate-500 hover:text-red-400 p-2 rounded-xl text-xs transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 3: TABLES & QR CODE MANAGER */}
            {activeTab === 'tables' && (
                <div>
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 print:hidden">
                        <div>
                            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
                                <LayoutGrid className="h-5 w-5 text-amber-400" />
                                <span>Table Management & Live Vector QR Codes</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Add or edit tables in your PostgreSQL database, manage QR codes, and print high-contrast ordering cards.
                            </p>
                        </div>

                        <button
                            onClick={handlePrintAllQRCodes}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-3.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                        >
                            <Printer className="h-4 w-4" />
                            <span>Print All Table QR Codes ({tables.length})</span>
                        </button>
                    </div>

                    {/* Table Creation & Preset Toolbar */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 print:hidden">
                        {/* Domain Configurator Bar */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 print:hidden shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-200 mb-0.5 flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-amber-400" />
                                    <span>Target Ordering Base Domain</span>
                                </h3>
                                <p className="text-xs text-slate-400">QR codes will append <code className="text-amber-400">/order?table=[N]&token=token-table-[N]</code></p>
                            </div>
                            <input
                                type="text"
                                value={qrBaseUrl}
                                onChange={(e) => setQrBaseUrl(e.target.value)}
                                placeholder="https://menu.skylightvillagelb.com"
                                className="w-full sm:w-80 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-2xl px-4 py-2.5 text-xs text-amber-300 font-mono focus:outline-none"
                            />
                        </div>
                        {/* Add Single Custom Table */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
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
                                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-2xl px-4 py-3 text-xs text-slate-100 font-bold focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold px-5 py-3 rounded-2xl text-xs transition-all whitespace-nowrap"
                                >
                                    + Add Table
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Single Unified Table Cards Grid */}
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
                                        className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 text-center flex flex-col items-center justify-between shadow-2xl relative overflow-hidden transition-all hover:border-slate-700 print:bg-transparent print:text-black print:border-none print:shadow-none print:break-inside-avoid print:p-0 print:m-0 print:w-auto print:mx-auto"
                                    >
                                        {/* Card Header: Table Number & Status or Inline Edit */}
                                        <div className="w-full flex justify-between items-center mb-3 pb-3 border-b border-slate-800 print:pb-0 print:border-none">
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
                                                        className="w-24 bg-slate-950 border border-amber-400 rounded-xl px-2.5 py-1 text-xs text-amber-400 font-bold focus:outline-none"
                                                        autoFocus
                                                    />
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="submit"
                                                            className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-lg"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingTableId(null)}
                                                            className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-1 rounded-lg"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <>
                                                    <div className="m-auto flex items-center gap-2">
                                                        <span className="bg-amber-500 text-slate-950 font-black text-sm px-3.5 py-1 rounded-xl shadow-md print:bg-black print:text-white print:px-5 print:py-1 print:text-lg">
                                                            TABLE #{tbl.table_number}
                                                        </span>
                                                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border print:hidden ${tbl.status === 'occupied'
                                                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                            }`}>
                                                            {tbl.status}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1 print:hidden">
                                                        <button
                                                            onClick={() => {
                                                                setEditingTableId(tbl.id);
                                                                setEditingTableNumInput(String(tbl.table_number));
                                                            }}
                                                            className="text-slate-400 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
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
                                                            className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                                                            title="Delete Table"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* High-Definition Vector QR Code */}
                                        <div className="relative inline-block bg-white p-3 rounded-2xl shadow-inner mb-3 border-2 border-slate-300 print:border-none print:shadow-none print:p-0">
                                            {isClient && (
                                                <QRCodeSVG
                                                    value={qrTargetUrl}
                                                    size={180}
                                                    level="H"
                                                    includeMargin={false}
                                                    fgColor="#000000"
                                                    bgColor="#ffffff"
                                                />
                                            )}

                                            {/* Centered High-Contrast Emblem Overlay Badge */}
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="bg-[#fff] p-1 rounded-xl flex items-center justify-center shadow-md h-10 w-10 border border-slate-300">
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
                                                className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                                            >
                                                <Printer className="h-3.5 w-3.5 text-amber-400" />
                                                <span>Print Table QR Code</span>
                                            </button>

                                            <a
                                                href={qrTargetUrl}
                                                target="_blank"
                                                className="w-full bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-medium py-1.5 rounded-xl text-[11px] block transition-all"
                                            >
                                                Test Customer QR Link
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: INVOICE & SESSION REFERENCE TRACKER */}
            {activeTab === 'invoices' && (
                <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-black text-slate-100">Invoice & Session Reference Tracker</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Track invoice reference IDs, database session UUIDs, order items & payments</p>
                        </div>

                        <div className="relative w-full sm:w-80">
                            <Search className="h-4 w-4 text-slate-500 absolute left-3.5 top-3.5" />
                            <input
                                type="text"
                                value={invoiceSearchTerm}
                                onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                                placeholder="Search Invoice Ref, Dish Name, Guest or Table #..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                            />
                        </div>
                    </div>

                    {/* Order History Status Filter Pills */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        <button
                            onClick={() => setSessionStatusFilter('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${sessionStatusFilter === 'all'
                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                                }`}
                        >
                            All Order History ({sessions.length})
                        </button>
                        <button
                            onClick={() => setSessionStatusFilter('active')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${sessionStatusFilter === 'active'
                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                                }`}
                        >
                            Active Table Sessions ({sessions.filter((s) => s.status === 'active').length})
                        </button>
                        <button
                            onClick={() => setSessionStatusFilter('closed')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${sessionStatusFilter === 'closed'
                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                                }`}
                        >
                            Closed Paid Receipts ({sessions.filter((s) => s.status === 'closed').length})
                        </button>
                    </div>

                    <div className="space-y-4">
                        {filteredSessions.length === 0 ? (
                            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl">
                                <Receipt className="h-12 w-12 text-slate-600 opacity-40 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-slate-300">No matching invoice session references found</h3>
                            </div>
                        ) : (
                            filteredSessions.map((sess) => {
                                const primaryTbl = tables.find((t) => t.id === sess.primary_table_id);
                                const tblNum = primaryTbl?.table_number || 1;
                                const sessItems = orderItems.filter((i) => i.session_id === sess.id);
                                const sessPayments = payments.filter((p) => p.session_id === sess.id);
                                const bill = calculateBillTotals(sessItems, [], sessPayments, 89500);

                                const invoiceRef = getInvoiceReference(tblNum, sess.id);

                                return (
                                    <div key={sess.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-800 gap-2 mb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-amber-400 text-base">{invoiceRef}</span>
                                                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border ${sess.status === 'closed'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                        }`}>
                                                        {sess.status === 'closed' ? 'SESSION CLOSED (PAID)' : 'ACTIVE TABLE SESSION'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-400 font-mono mt-1">
                                                    Database Session UUID: <strong className="text-slate-200">{sess.id}</strong> | Table #{tblNum}
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className="text-sm font-black text-slate-100">
                                                    Total Bill: ${bill.finalTotalUsd.toFixed(2)}
                                                </div>
                                                <div className="text-xs font-bold text-emerald-400">
                                                    Paid: ${bill.paidUsd.toFixed(2)} | Unpaid: ${bill.remainingUsd.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Itemized Breakdown */}
                                        <div className="space-y-1.5 my-3">
                                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                Ordered Items ({sessItems.length}):
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                {sessItems.map((item) => (
                                                    <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs flex justify-between items-center">
                                                        <div>
                                                            <span className="font-bold text-slate-100">1x {item.item_name}</span>
                                                            {item.guest_name && (
                                                                <span className="text-[10px] text-purple-400 font-bold block mt-0.5">Guest: {item.guest_name}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="font-extrabold text-amber-400">${(Number(item.unit_price_usd) * item.quantity).toFixed(2)}</span>
                                                            <span className={`text-[9px] font-bold uppercase block ${item.is_paid ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                                {item.is_paid ? 'PAID' : item.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* TAB 4: STAFF USER MANAGER */}
            {activeTab === 'staff' && (
                <div className="max-w-3xl">
                    <h2 className="text-xl font-black text-slate-100 mb-2">Staff Roster & PIN Codes</h2>
                    <p className="text-xs text-slate-400 mb-6">Assign staff members individual PIN codes for login activity tracking</p>

                    <form onSubmit={handleAddStaffSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8">
                        <h3 className="text-sm font-extrabold text-slate-200 mb-4">Add New Staff Member</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Staff Name</label>
                                <input
                                    type="text"
                                    value={newStaffName}
                                    onChange={(e) => setNewStaffName(e.target.value)}
                                    placeholder="e.g. Michel"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">4-Digit PIN Code</label>
                                <input
                                    type="text"
                                    maxLength={4}
                                    value={newStaffPin}
                                    onChange={(e) => setNewStaffPin(e.target.value)}
                                    placeholder="e.g. 1004"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Staff Role</label>
                                <select
                                    value={newStaffRole}
                                    onChange={(e: any) => setNewStaffRole(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                                >
                                    <option value="Waiter">Waiter</option>
                                    <option value="Cashier">Cashier</option>
                                    <option value="Chef">Chef</option>
                                    <option value="Manager">Manager</option>
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md transition-all"
                        >
                            <PlusCircle className="h-4 w-4" />
                            <span>Save Staff Member</span>
                        </button>
                    </form>

                    {/* Active Staff List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { name: 'John', pin: '1001', role: 'Waiter' },
                            { name: 'Sarah', pin: '1002', role: 'Waiter' },
                            { name: 'Charbel', pin: '1003', role: 'Cashier' },
                            { name: 'Chef Antoine', pin: '2001', role: 'Chef' },
                            { name: 'Manager Admin', pin: '1234', role: 'Manager' },
                        ].map((st, sIdx) => (
                            <div
                                key={sIdx}
                                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-sm text-slate-100">{st.name}</span>
                                        <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                            {st.role}
                                        </span>
                                    </div>
                                    <span className="text-xs font-mono text-slate-400 block mt-1">
                                        PIN Code: <strong className="text-amber-400">{st.pin}</strong>
                                    </span>
                                </div>

                                <button className="text-slate-600 hover:text-red-400 p-2 rounded-xl text-xs transition-colors">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 5: REPORTS */}
            {activeTab === 'reports' && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-black text-slate-100">Live Sales & Activity Reports</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Realtime order counts and sales insights</p>
                        </div>
                        <a
                            href="/pos/reports"
                            className="bg-amber-500 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md"
                        >
                            <BarChart3 className="h-4 w-4" />
                            <span>Full Audit Trail Report</span>
                        </a>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                Total Orders Submitted
                            </span>
                            <span className="text-3xl font-black text-amber-400">{orderItems.length}</span>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                Active Menu Categories
                            </span>
                            <span className="text-3xl font-black text-emerald-400">{categories.length}</span>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                Active Menu Items
                            </span>
                            <span className="text-3xl font-black text-purple-400">{menuItems.length}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL EDIT MENU ITEM MODAL */}
            {editingItem && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                            <h3 className="text-lg font-black text-slate-100">Edit Menu Item details</h3>
                            <button onClick={() => setEditingItem(null)} className="text-slate-400 font-bold text-base">
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveFullEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Item Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-bold"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Category</label>
                                    <select
                                        value={editCatId}
                                        onChange={(e) => setEditCatId(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                                    >
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Price USD ($)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={editPrice}
                                        onChange={(e) => setEditPrice(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Kitchen Station Routing</label>
                                <select
                                    value={editStation}
                                    onChange={(e: any) => setEditStation(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                                >
                                    <option value="cold_mezza">Cold Mezza Station</option>
                                    <option value="hot_mezza">Hot Mezza Station</option>
                                    <option value="grill">Grill & Charcoal Station</option>
                                    <option value="bar">Bar & Refreshments</option>
                                    <option value="shisha">Shisha Lounge</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Description</label>
                                <input
                                    type="text"
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">
                                    Image URL (Direct or Google Drive share link)
                                </label>
                                <input
                                    type="text"
                                    value={editImageUrl}
                                    onChange={(e) => setEditImageUrl(e.target.value)}
                                    placeholder="Paste https://drive.google.com/... or image link"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingItem(null)}
                                    className="w-1/2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold py-3.5 rounded-2xl text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="w-1/2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3.5 rounded-2xl text-xs shadow-lg shadow-amber-500/20"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CREATE NEW MENU ITEM MODAL */}
            {isAddItemModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                            <h3 className="text-lg font-black text-slate-100">Add New Skylight Menu Item</h3>
                            <button onClick={() => setIsAddItemModalOpen(false)} className="text-slate-400">
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateMenuItemSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Category</label>
                                <select
                                    value={newItemCatId}
                                    onChange={(e) => setNewItemCatId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                                >
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Item Name</label>
                                <input
                                    type="text"
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    placeholder="e.g. Labneh b Toum"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Price USD ($)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={newItemPrice}
                                        onChange={(e) => setNewItemPrice(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Kitchen Station</label>
                                    <select
                                        value={newItemStation}
                                        onChange={(e: any) => setNewItemStation(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                                    >
                                        <option value="cold_mezza">Cold Mezza</option>
                                        <option value="hot_mezza">Hot Mezza</option>
                                        <option value="grill">Grill & Charcoal</option>
                                        <option value="bar">Bar & Refreshments</option>
                                        <option value="shisha">Shisha Lounge</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Description (Optional)</label>
                                <input
                                    type="text"
                                    value={newItemDesc}
                                    onChange={(e) => setNewItemDesc(e.target.value)}
                                    placeholder="Short description..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Image URL / Drive Link (Optional)</label>
                                <input
                                    type="text"
                                    value={newItemImage}
                                    onChange={(e) => setNewItemImage(e.target.value)}
                                    placeholder="https://drive.google.com/... or https://..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3.5 rounded-2xl text-xs shadow-lg shadow-amber-500/20 transition-all mt-4"
                            >
                                Create Menu Item
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
