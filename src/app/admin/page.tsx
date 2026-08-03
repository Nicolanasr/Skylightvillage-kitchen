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
    testDatabaseConnectionAction,
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
    const [menuSearchTerm, setMenuSearchTerm] = useState('');
    const [dbTestResult, setDbTestResult] = useState<any>(null);
    const [isTestingDb, setIsTestingDb] = useState(false);

    const handleRunDbTest = async () => {
        setIsTestingDb(true);
        try {
            const res = await testDatabaseConnectionAction();
            setDbTestResult(res);
        } catch (e: any) {
            setDbTestResult({ connected: false, reason: e.message });
        } finally {
            setIsTestingDb(false);
        }
    };

    // New Category State
    const [newCatName, setNewCatName] = useState('');

    // New Menu Item State
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
    const [newItemCatId, setNewItemCatId] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [newItemDesc, setNewItemDesc] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('5.00');
    const [newItemStation, setNewItemStation] = useState<StationType>('mezza');
    const [newItemImage, setNewItemImage] = useState('');
    const [newItemIsStaffOnly, setNewItemIsStaffOnly] = useState(false);
    const [newItemSortOrder, setNewItemSortOrder] = useState('0');
    const [newItemIsBestseller, setNewItemIsBestseller] = useState(false);

    // Full Item Edit Modal State
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editCatId, setEditCatId] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [editStation, setEditStation] = useState<StationType>('mezza');
    const [editImageUrl, setEditImageUrl] = useState('');
    const [editIsStaffOnly, setEditIsStaffOnly] = useState(false);
    const [editSortOrder, setEditSortOrder] = useState('0');
    const [editIsBestseller, setEditIsBestseller] = useState(false);

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
            isStaffOnly: newItemIsStaffOnly,
            sortOrder: parseInt(newItemSortOrder) || 0,
            isBestseller: newItemIsBestseller,
        });

        if (res.success) {
            setNewItemName('');
            setNewItemDesc('');
            setNewItemPrice('5.00');
            setNewItemImage('');
            setNewItemIsStaffOnly(false);
            setNewItemSortOrder('0');
            setNewItemIsBestseller(false);
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
        setEditIsStaffOnly(!!item.is_staff_only);
        setEditSortOrder(String(item.sort_order ?? 0));
        setEditIsBestseller(!!item.is_bestseller);
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
            isStaffOnly: editIsStaffOnly,
            sortOrder: parseInt(editSortOrder) || 0,
            isBestseller: editIsBestseller,
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
                    setSeedStatus(res.message || 'Wiped test data successfully!');
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
        <div className="min-h-screen bg-[#fafbfa] text-[#1c271c] p-4 md:p-8">
            {/* Admin Top Header Bar */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 mb-8 border-b border-[#1c3a1e]/15 gap-4">
                <div className="flex items-center gap-4">
                    <img
                        src="/images/Skylight-logo-icon.png"
                        alt="Skylight Village Logo"
                        className="h-12 w-auto object-contain"
                    />
                    <div>
                        <h1 className="text-2xl font-black text-[#1c3a1e] tracking-tight flex items-center gap-2">
                            <Shield className="h-6 w-6 text-[#d4af37]" />
                            <span>Skylight Village Admin Portal</span>
                        </h1>
                        <p className="text-xs text-gray-600 font-medium">
                            Manage Menu, Categories, Google Drive Images, Prices, Invoice Trackers & Staff User Access
                        </p>
                    </div>
                </div>

                {/* Quick Nav Links, DB Test, Seed & Wipe Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleRunDbTest}
                        disabled={isTestingDb}
                        className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm"
                    >
                        <Globe className="h-4 w-4" />
                        <span>{isTestingDb ? 'Testing DB Connection...' : '⚡ Test Vercel DB Connection'}</span>
                    </button>
                    <a
                        href="/pos"
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm"
                    >
                        <Monitor className="h-4 w-4 text-[#1c3a1e]" />
                        <span>POS Waiter Terminal</span>
                    </a>
                    <a
                        href="/kds"
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm"
                    >
                        <ChefHat className="h-4 w-4 text-[#1c3a1e]" />
                        <span>Kitchen KDS</span>
                    </a>
                </div>
            </header>

            {/* DB Test Diagnostic Card */}
            {dbTestResult && (
                <div className={`mb-6 p-5 rounded-2xl border text-xs shadow-md animate-in fade-in ${dbTestResult.connected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800'
                    : 'bg-red-500/10 border-red-500/30 text-red-800'
                    }`}>
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2 font-black text-sm">
                            <span className={`h-3 w-3 rounded-full ${dbTestResult.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                            <span>{dbTestResult.connected ? 'CONNECTED TO NEON POSTGRESQL (LIVE)' : 'DATABASE DISCONNECTED / MEMORY FALLBACK'}</span>
                        </div>
                        <button
                            onClick={() => setDbTestResult(null)}
                            className="text-gray-500 hover:text-black text-xs font-bold"
                        >
                            ✕ Close
                        </button>
                    </div>

                    {dbTestResult.connected ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-[#1c3a1e]/15 font-mono text-[11px]">
                            <div>
                                <span className="text-gray-500 block text-[10px]">Database Name</span>
                                <span className="font-bold text-[#1c3a1e]">{dbTestResult.databaseName}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[10px]">Tables Count</span>
                                <span className="font-bold text-[#1c3a1e]">{dbTestResult.tablesCount} Tables</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[10px]">Menu Items</span>
                                <span className="font-bold text-[#1c3a1e]">{dbTestResult.menuItemsCount} Items</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[10px]">Order Items</span>
                                <span className="font-bold text-[#1c3a1e]">{dbTestResult.orderItemsCount} Items</span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2 bg-white p-4 rounded-xl border border-red-500/30 font-sans">
                            <p className="font-bold text-red-800">Diagnostic Details: {dbTestResult.reason}</p>
                        </div>
                    )}
                </div>
            )}

            {seedStatus && (
                <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs font-bold p-4 rounded-2xl animate-in fade-in">
                    {seedStatus}
                </div>
            )}

            {/* Admin Tabs Bar */}
            <div className="flex flex-wrap gap-3 mb-8 border-b border-[#1c3a1e]/15 pb-4">
                <button
                    onClick={() => setActiveTab('menu')}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'menu'
                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                        : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                        }`}
                >
                    <Utensils className="h-4 w-4" />
                    <span>Menu & Items ({menuItems.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('categories')}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'categories'
                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                        : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                        }`}
                >
                    <PlusCircle className="h-4 w-4" />
                    <span>Categories ({categories.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('tables')}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'tables'
                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                        : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                        }`}
                >
                    <LayoutGrid className="h-4 w-4" />
                    <span>Tables & Floor Plan ({tables.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('invoices')}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'invoices'
                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                        : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                        }`}
                >
                    <Receipt className="h-4 w-4" />
                    <span>Invoice & Order Reference Tracker ({sessions.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('staff')}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'staff'
                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                        : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                        }`}
                >
                    <Users className="h-4 w-4" />
                    <span>Staff PIN Users</span>
                </button>

                <button
                    onClick={() => setActiveTab('reports')}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'reports'
                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                        : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                        }`}
                >
                    <BarChart3 className="h-4 w-4" />
                    <span>Sales & Audit Reports</span>
                </button>
            </div>

            {/* TAB 1: MENU ITEMS & PRICES MANAGER */}
            {activeTab === 'menu' && (
                <div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-black text-[#1c3a1e]">Skylight Village Menu Items ({menuItems.length})</h2>
                            <p className="text-xs text-gray-600 mt-0.5">Edit full details, change prices, update Google Drive images, or add new items</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            {/* Menu Search Bar Input */}
                            <div className="relative flex-1 md:w-72">
                                <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search items by name, category..."
                                    value={menuSearchTerm}
                                    onChange={(e) => setMenuSearchTerm(e.target.value)}
                                    className="w-full bg-white border border-[#1c3a1e]/20 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#1c3a1e] placeholder-gray-400 focus:outline-none focus:border-[#1c3a1e] transition-all shadow-sm"
                                />
                            </div>

                            <button
                                onClick={() => {
                                    if (categories.length > 0) setNewItemCatId(categories[0].id);
                                    setIsAddItemModalOpen(true);
                                }}
                                className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-5 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-sm transition-all whitespace-nowrap cursor-pointer"
                            >
                                <PlusCircle className="h-4 w-4" />
                                <span>Add New Menu Item</span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {categories.map((cat) => {
                            const catItems = menuItems.filter((item) => {
                                if (item.category_id !== cat.id) return false;
                                const term = menuSearchTerm.toLowerCase().trim();
                                if (!term) return true;
                                return (
                                    item.name.toLowerCase().includes(term) ||
                                    (item.description && item.description.toLowerCase().includes(term)) ||
                                    cat.name.toLowerCase().includes(term)
                                );
                            });

                            if (catItems.length === 0 && menuSearchTerm) return null;

                            return (
                                <div key={cat.id} className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-sm">
                                    {/* Category Section Header */}
                                    <div className="flex items-center justify-between border-b border-[#1c3a1e]/15 pb-3 mb-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-3 w-3 rounded-full bg-[#d4af37] animate-pulse" />
                                            <h2 className="text-base font-black text-[#1c3a1e] tracking-tight">{cat.name}</h2>
                                        </div>
                                        <span className="text-xs font-extrabold text-[#1c3a1e] bg-[#eaf2eb] px-3 py-1 rounded-full border border-[#1c3a1e]/10">
                                            {catItems.length} {catItems.length === 1 ? 'dish' : 'dishes'}
                                        </span>
                                    </div>

                                    {/* Category Items Grid */}
                                    {catItems.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {catItems.map((item) => {
                                                const catName = cat.name;
                                                const displayImage = transformGoogleDriveUrl(item.image_url || '');

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all text-[#1c3a1e]"
                                                    >
                                                        <div>
                                                            <div className="flex gap-3 mb-3">
                                                                {displayImage ? (
                                                                    <img
                                                                        src={displayImage}
                                                                        alt={item.name}
                                                                        className="h-14 w-14 rounded-2xl object-cover border border-[#1c3a1e]/15 flex-shrink-0"
                                                                        onError={(e) => {
                                                                            (e.target as HTMLElement).style.display = 'none';
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div className="h-14 w-14 rounded-2xl bg-white border border-[#1c3a1e]/15 flex items-center justify-center flex-shrink-0">
                                                                        <ImageIcon className="h-6 w-6 text-[#1c3a1e]/40" />
                                                                    </div>
                                                                )}

                                                                <div className="flex-1">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <span className="text-[10px] font-black text-[#1c3a1e] uppercase tracking-widest bg-[#eaf2eb] px-2 py-0.5 rounded-lg border border-[#1c3a1e]/15">
                                                                                {catName}
                                                                            </span>
                                                                            {item.is_bestseller && (
                                                                                <span className="text-[9px] font-black text-amber-900 uppercase tracking-wider bg-amber-400/20 px-1.5 py-0.5 rounded-lg border border-amber-400/40">
                                                                                    ⭐ Bestseller
                                                                                </span>
                                                                            )}
                                                                            {item.is_staff_only && (
                                                                                <span className="text-[9px] font-black text-purple-800 uppercase tracking-wider bg-purple-500/10 px-1.5 py-0.5 rounded-lg border border-purple-500/30">
                                                                                    🔒 Staff-Only
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        <button
                                                                            onClick={async () => {
                                                                                await updateMenuItem(item.id, { available: !item.available });
                                                                                refreshPOSData();
                                                                            }}
                                                                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 border ${item.available
                                                                                ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                                                                                : 'bg-red-500/10 text-red-800 border-red-500/30'
                                                                                }`}
                                                                        >
                                                                            {item.available ? 'AVAILABLE' : 'SOLD OUT'}
                                                                        </button>
                                                                    </div>

                                                                    <h3 className="text-base font-black text-[#1c3a1e] mt-1 leading-tight">{item.name}</h3>
                                                                </div>
                                                            </div>

                                                            {item.description && (
                                                                <p className="text-xs text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                                                            )}

                                                            <div className="text-[11px] text-gray-500 font-semibold mb-2 flex items-center gap-3">
                                                                <span>Station: <strong className="text-[#1c3a1e] uppercase">{item.station.replace('_', ' ')}</strong></span>
                                                                <span>Sort #: <strong className="text-[#1c3a1e]">{item.sort_order ?? 0}</strong></span>
                                                            </div>
                                                        </div>

                                                        {/* Card Actions Footer */}
                                                        <div className="pt-3 border-t border-[#1c3a1e]/10 flex items-center justify-between mt-2">
                                                            <span className="text-base font-black text-[#1c3a1e]">
                                                                ${Number(item.price_usd).toFixed(2)}
                                                            </span>

                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleOpenFullEdit(item)}
                                                                    className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all"
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
                                                                    className="text-gray-400 hover:text-red-600 p-2 rounded-xl text-xs transition-colors"
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
                                    ) : (
                                        <p className="text-xs font-bold text-gray-400 italic py-2">No items in this category yet.</p>
                                    )}
                                </div>
                            );
                        })}

                        {/* Unassigned Category Section */}
                        {(() => {
                            const unassignedItems = menuItems.filter((item) => {
                                const hasCat = categories.some((c) => c.id === item.category_id);
                                if (hasCat) return false;
                                const term = menuSearchTerm.toLowerCase().trim();
                                if (!term) return true;
                                return (
                                    item.name.toLowerCase().includes(term) ||
                                    (item.description && item.description.toLowerCase().includes(term))
                                );
                            });

                            if (unassignedItems.length === 0) return null;

                            return (
                                <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-[#1c3a1e]/15 pb-3 mb-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-3 w-3 rounded-full bg-gray-400" />
                                            <h2 className="text-base font-black text-[#1c3a1e] tracking-tight">Unassigned Category</h2>
                                        </div>
                                        <span className="text-xs font-extrabold text-[#1c3a1e] bg-[#eaf2eb] px-3 py-1 rounded-full border border-[#1c3a1e]/10">
                                            {unassignedItems.length} {unassignedItems.length === 1 ? 'dish' : 'dishes'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {unassignedItems.map((item) => {
                                            const displayImage = transformGoogleDriveUrl(item.image_url || '');

                                            return (
                                                <div
                                                    key={item.id}
                                                    className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all text-[#1c3a1e]"
                                                >
                                                    <div>
                                                        <div className="flex gap-3 mb-3">
                                                            {displayImage ? (
                                                                <img
                                                                    src={displayImage}
                                                                    alt={item.name}
                                                                    className="h-14 w-14 rounded-2xl object-cover border border-[#1c3a1e]/15 flex-shrink-0"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLElement).style.display = 'none';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="h-14 w-14 rounded-2xl bg-white border border-[#1c3a1e]/15 flex items-center justify-center flex-shrink-0">
                                                                    <ImageIcon className="h-6 w-6 text-[#1c3a1e]/40" />
                                                                </div>
                                                            )}

                                                            <div className="flex-1">
                                                                <div className="flex justify-between items-start">
                                                                    <span className="text-[10px] font-black text-[#1c3a1e] uppercase tracking-widest bg-[#eaf2eb] px-2 py-0.5 rounded-lg border border-[#1c3a1e]/15">
                                                                        Unassigned
                                                                    </span>

                                                                    <button
                                                                        onClick={async () => {
                                                                            await updateMenuItem(item.id, { available: !item.available });
                                                                            refreshPOSData();
                                                                        }}
                                                                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 border ${item.available
                                                                            ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                                                                            : 'bg-red-500/10 text-red-800 border-red-500/30'
                                                                            }`}
                                                                    >
                                                                        {item.available ? 'AVAILABLE' : 'SOLD OUT'}
                                                                    </button>
                                                                </div>

                                                                <h3 className="text-base font-black text-[#1c3a1e] mt-1 leading-tight">{item.name}</h3>
                                                            </div>
                                                        </div>

                                                        {item.description && (
                                                            <p className="text-xs text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                                                        )}

                                                        <div className="text-[11px] text-gray-500 font-semibold mb-2 flex items-center gap-3">
                                                            <span>Station: <strong className="text-[#1c3a1e] uppercase">{item.station.replace('_', ' ')}</strong></span>
                                                            <span>Sort #: <strong className="text-[#1c3a1e]">{item.sort_order ?? 0}</strong></span>
                                                        </div>
                                                    </div>

                                                    <div className="pt-3 border-t border-[#1c3a1e]/10 flex items-center justify-between mt-2">
                                                        <span className="text-base font-black text-[#1c3a1e]">
                                                            ${Number(item.price_usd).toFixed(2)}
                                                        </span>

                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleOpenFullEdit(item)}
                                                                className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all"
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
                                                                className="text-gray-400 hover:text-red-600 p-2 rounded-xl text-xs transition-colors"
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
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* TAB 2: CATEGORIES MANAGER */}
            {activeTab === 'categories' && (
                <div className="max-w-2xl">
                    <h2 className="text-xl font-black text-[#1c3a1e] mb-1">Menu Categories</h2>
                    <p className="text-xs text-gray-600 font-medium mb-6">Create new menu categories or organize existing ones</p>

                    <form onSubmit={handleCreateCategorySubmit} className="flex gap-3 mb-8">
                        <input
                            type="text"
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            placeholder="Enter New Category Name..."
                            className="flex-1 bg-white border border-[#1c3a1e]/20 focus:border-[#1c3a1e] rounded-2xl px-4 py-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none transition-colors shadow-sm"
                        />
                        <button
                            type="submit"
                            className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-6 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
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
                                    className="bg-white border border-[#1c3a1e]/15 rounded-2xl p-4 flex items-center justify-between shadow-sm text-[#1c3a1e]"
                                >
                                    <div>
                                        <span className="font-extrabold text-sm text-[#1c3a1e]">{cat.name}</span>
                                        <span className="text-xs text-gray-600 font-semibold block mt-0.5">{itemCount} Menu Items</span>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            if (confirm(`Delete category "${cat.name}"?`)) {
                                                await deleteCategory(cat.id);
                                                refreshPOSData();
                                            }
                                        }}
                                        className="text-gray-400 hover:text-red-600 p-2 rounded-xl text-xs transition-colors"
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
                            <h2 className="text-xl font-black text-[#1c3a1e] flex items-center gap-2">
                                <LayoutGrid className="h-5 w-5 text-[#d4af37]" />
                                <span>Table Management & Live Vector QR Codes</span>
                            </h2>
                            <p className="text-xs text-gray-600 font-medium mt-0.5">
                                Add or edit tables in your PostgreSQL database, manage QR codes, and print high-contrast ordering cards.
                            </p>
                        </div>

                        <button
                            onClick={handlePrintAllQRCodes}
                            className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-6 py-3.5 rounded-2xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                        >
                            <Printer className="h-4 w-4" />
                            <span>Print All Table QR Codes ({tables.length})</span>
                        </button>
                    </div>

                    {/* Table Creation & Preset Toolbar */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 print:hidden">
                        {/* Domain Configurator Bar */}
                        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 print:hidden shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[#1c3a1e]">
                            <div>
                                <h3 className="text-sm font-extrabold text-[#1c3a1e] mb-0.5 flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-[#d4af37]" />
                                    <span>Target Ordering Base Domain</span>
                                </h3>
                                <p className="text-xs text-gray-600 font-medium">QR codes will append <code className="text-[#1c3a1e] font-bold">/order?table=[N]&token=token-table-[N]</code></p>
                            </div>
                            <input
                                type="text"
                                value={qrBaseUrl}
                                onChange={(e) => setQrBaseUrl(e.target.value)}
                                placeholder="https://menu.skylightvillagelb.com"
                                className="w-full sm:w-80 bg-[#fafbfa] border border-[#1c3a1e]/20 focus:border-[#1c3a1e] rounded-2xl px-4 py-2.5 text-xs text-[#1c3a1e] font-mono font-bold focus:outline-none"
                            />
                        </div>
                        {/* Add Single Custom Table */}
                        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-6 shadow-sm flex flex-col justify-between text-[#1c3a1e]">
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
                                    className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-5 py-3 rounded-2xl text-xs transition-all whitespace-nowrap cursor-pointer shadow-sm"
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
                                        className="bg-white border-2 border-[#1c3a1e]/15 rounded-3xl p-5 text-center flex flex-col items-center justify-between shadow-sm relative overflow-hidden transition-all hover:shadow-md print:bg-transparent print:text-black print:border-none print:shadow-none print:break-inside-avoid print:p-0 print:m-0 print:w-auto print:mx-auto"
                                    >
                                        {/* Card Header: Table Number & Status or Inline Edit */}
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
                                                            className="bg-[#1c3a1e] text-white text-[10px] font-black px-2.5 py-1 rounded-lg"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingTableId(null)}
                                                            className="bg-[#eaf2eb] text-[#1c3a1e] text-[10px] font-bold px-2 py-1 rounded-lg"
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
                                                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border print:hidden ${tbl.status === 'occupied'
                                                            ? 'bg-blue-500/10 text-blue-900 border-blue-500/30'
                                                            : 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
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
                                                            className="text-gray-500 hover:text-[#1c3a1e] p-1.5 rounded-lg hover:bg-[#eaf2eb] transition-colors"
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
                                                            className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                            title="Delete Table"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* High-Definition Vector QR Code */}
                                        <div className="relative inline-block bg-white p-3 rounded-2xl shadow-inner mb-3 border-2 border-gray-200 print:border-none print:shadow-none print:p-0">
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
                                                className="w-full bg-[#eaf2eb] hover:bg-[#d8e6da] text-[#1c3a1e] border border-[#1c3a1e]/15 font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
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
                </div>
            )}

            {/* TAB 3: INVOICE & SESSION REFERENCE TRACKER */}
            {activeTab === 'invoices' && (
                <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-black text-[#1c3a1e]">Invoice & Session Reference Tracker</h2>
                            <p className="text-xs text-gray-600 font-medium mt-0.5">Track invoice reference IDs, database session UUIDs, order items & payments</p>
                        </div>

                        <div className="relative w-full sm:w-80">
                            <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-3.5" />
                            <input
                                type="text"
                                value={invoiceSearchTerm}
                                onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                                placeholder="Search Invoice Ref, Dish Name, Guest or Table #..."
                                className="w-full bg-white border border-[#1c3a1e]/20 rounded-2xl pl-10 pr-4 py-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e] shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Order History Status Filter Pills */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        <button
                            onClick={() => setSessionStatusFilter('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${sessionStatusFilter === 'all'
                                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-sm'
                                : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                                }`}
                        >
                            All Order History ({sessions.length})
                        </button>
                        <button
                            onClick={() => setSessionStatusFilter('active')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${sessionStatusFilter === 'active'
                                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-sm'
                                : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                                }`}
                        >
                            Active Table Sessions ({sessions.filter((s) => s.status === 'active').length})
                        </button>
                        <button
                            onClick={() => setSessionStatusFilter('closed')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${sessionStatusFilter === 'closed'
                                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-sm'
                                : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                                }`}
                        >
                            Closed Paid Receipts ({sessions.filter((s) => s.status === 'closed').length})
                        </button>
                    </div>

                    <div className="space-y-4">
                        {filteredSessions.length === 0 ? (
                            <div className="text-center py-16 bg-white border border-[#1c3a1e]/15 rounded-3xl shadow-sm">
                                <Receipt className="h-12 w-12 text-[#1c3a1e] opacity-30 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-[#1c3a1e]">No matching invoice session references found</h3>
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
                                    <div key={sess.id} className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-sm text-[#1c3a1e]">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-[#1c3a1e]/15 gap-2 mb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-[#1c3a1e] text-base">{invoiceRef}</span>
                                                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border ${sess.status === 'closed'
                                                        ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                                                        : 'bg-amber-500/10 text-amber-800 border-amber-500/30'
                                                        }`}>
                                                        {sess.status === 'closed' ? 'SESSION CLOSED (PAID)' : 'ACTIVE TABLE SESSION'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-600 font-mono mt-1">
                                                    Database Session UUID: <strong className="text-[#1c3a1e]">{sess.id}</strong> | Table #{tblNum}
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className="text-sm font-black text-[#1c3a1e]">
                                                    Total Bill: ${bill.finalTotalUsd.toFixed(2)}
                                                </div>
                                                <div className="text-xs font-bold text-emerald-800">
                                                    Paid: ${bill.paidUsd.toFixed(2)} | Unpaid: ${bill.remainingUsd.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Itemized Breakdown */}
                                        <div className="space-y-1.5 my-3">
                                            <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                                                Ordered Items ({sessItems.length}):
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                {sessItems.map((item) => (
                                                    <div key={item.id} className="bg-[#fafbfa] border border-[#1c3a1e]/10 rounded-xl p-2.5 text-xs flex justify-between items-center">
                                                        <div>
                                                            <span className="font-bold text-[#1c3a1e]">1x {item.item_name}</span>
                                                            {item.guest_name && (
                                                                <span className="text-[10px] text-purple-900 font-bold block mt-0.5">Guest: {item.guest_name}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="font-extrabold text-[#1c3a1e]">${(Number(item.unit_price_usd) * item.quantity).toFixed(2)}</span>
                                                            <span className={`text-[9px] font-bold uppercase block ${item.is_paid ? 'text-emerald-800' : 'text-amber-800'}`}>
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
                    <h2 className="text-xl font-black text-[#1c3a1e] mb-1">Staff Roster & PIN Codes</h2>
                    <p className="text-xs text-gray-600 font-medium mb-6">Assign staff members individual PIN codes for login activity tracking</p>

                    <form onSubmit={handleAddStaffSubmit} className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-6 mb-8 shadow-sm text-[#1c3a1e]">
                        <h3 className="text-sm font-extrabold text-[#1c3a1e] mb-4">Add New Staff Member</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-700 mb-1">Staff Name</label>
                                <input
                                    type="text"
                                    value={newStaffName}
                                    onChange={(e) => setNewStaffName(e.target.value)}
                                    placeholder="e.g. Michel"
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-700 mb-1">4-Digit PIN Code</label>
                                <input
                                    type="text"
                                    maxLength={4}
                                    value={newStaffPin}
                                    onChange={(e) => setNewStaffPin(e.target.value)}
                                    placeholder="e.g. 1004"
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#1c3a1e] font-mono font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-700 mb-1">Staff Role</label>
                                <select
                                    value={newStaffRole}
                                    onChange={(e: any) => setNewStaffRole(e.target.value)}
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
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
                            className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                        >
                            <PlusCircle className="h-4 w-4" />
                            <span>Save Staff Member</span>
                        </button>
                    </form>
                </div>
            )}

            {/* TAB 5: REPORTS */}
            {activeTab === 'reports' && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-black text-[#1c3a1e]">Live Sales & Activity Reports</h2>
                            <p className="text-xs text-gray-600 font-medium mt-0.5">Realtime order counts and sales insights</p>
                        </div>
                        <a
                            href="/pos/reports"
                            className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm cursor-pointer"
                        >
                            <BarChart3 className="h-4 w-4" />
                            <span>Full Audit Trail Report</span>
                        </a>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-6 text-center shadow-sm">
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest block mb-1">
                                Total Orders Submitted
                            </span>
                            <span className="text-3xl font-black text-[#1c3a1e]">{orderItems.length}</span>
                        </div>

                        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-6 text-center shadow-sm">
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest block mb-1">
                                Active Menu Categories
                            </span>
                            <span className="text-3xl font-black text-emerald-800">{categories.length}</span>
                        </div>

                        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-6 text-center shadow-sm">
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest block mb-1">
                                Active Menu Items
                            </span>
                            <span className="text-3xl font-black text-purple-900">{menuItems.length}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL EDIT MENU ITEM MODAL */}
            {editingItem && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1c3a1e]/15">
                            <h3 className="text-lg font-black text-[#1c3a1e]">Edit Menu Item details</h3>
                            <button onClick={() => setEditingItem(null)} className="text-gray-500 hover:text-black font-bold text-base">
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveFullEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Item Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e] font-extrabold"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                                    <select
                                        value={editCatId}
                                        onChange={(e) => setEditCatId(e.target.value)}
                                        className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                                    >
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Price USD ($)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={editPrice}
                                        onChange={(e) => setEditPrice(e.target.value)}
                                        className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-black focus:outline-none focus:border-[#1c3a1e]"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Sort Order #</label>
                                    <input
                                        type="number"
                                        step="1"
                                        value={editSortOrder}
                                        onChange={(e) => setEditSortOrder(e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-black focus:outline-none focus:border-[#1c3a1e]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Kitchen Station Routing</label>
                                <select
                                    value={editStation}
                                    onChange={(e: any) => setEditStation(e.target.value)}
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                                >
                                    <option value="mezza">Mezza (Hot/Cold & Salads)</option>
                                    <option value="sajj">Sajj Station</option>
                                    <option value="grill">BBQ (Grill)</option>
                                    <option value="subs_sandwiches">Subs, Sandwiches & Kids Meals</option>
                                    <option value="bar">Bar & Refreshments</option>
                                    <option value="shisha">Shisha Lounge</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                                <input
                                    type="text"
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-bold focus:outline-none focus:border-[#1c3a1e]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Image URL (Direct or Google Drive share link)
                                </label>
                                <input
                                    type="text"
                                    value={editImageUrl}
                                    onChange={(e) => setEditImageUrl(e.target.value)}
                                    placeholder="Paste https://drive.google.com/... or image link"
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-bold focus:outline-none focus:border-[#1c3a1e]"
                                />
                            </div>

                            <div className="flex flex-col gap-2 pt-1">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="editIsBestseller"
                                        checked={editIsBestseller}
                                        onChange={(e) => setEditIsBestseller(e.target.checked)}
                                        className="h-4 w-4 rounded accent-[#d4af37] bg-[#fafbfa] border-[#1c3a1e]/20"
                                    />
                                    <label htmlFor="editIsBestseller" className="text-xs font-black text-[#1c3a1e] cursor-pointer flex items-center gap-1">
                                        ⭐ Mark as Bestseller / Chef's Special (Displays gold badge on menu)
                                    </label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="editIsStaffOnly"
                                        checked={editIsStaffOnly}
                                        onChange={(e) => setEditIsStaffOnly(e.target.checked)}
                                        className="h-4 w-4 rounded accent-[#1c3a1e] bg-[#fafbfa] border-[#1c3a1e]/20"
                                    />
                                    <label htmlFor="editIsStaffOnly" className="text-xs font-extrabold text-purple-900 cursor-pointer">
                                        🔒 Waiter / Staff-Only Item (Hidden from Customer QR menu)
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingItem(null)}
                                    className="w-1/2 bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-bold py-3.5 rounded-2xl text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="w-1/2 bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3.5 rounded-2xl text-xs shadow-sm transition-all"
                                >
                                    Save Dish Details
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CREATE NEW MENU ITEM MODAL */}
            {isAddItemModalOpen && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1c3a1e]/15">
                            <h3 className="text-lg font-black text-[#1c3a1e]">Add New Skylight Menu Item</h3>
                            <button onClick={() => setIsAddItemModalOpen(false)} className="text-gray-500 hover:text-black font-bold">
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateMenuItemSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                                <select
                                    value={newItemCatId}
                                    onChange={(e) => setNewItemCatId(e.target.value)}
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                                >
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Item Name</label>
                                <input
                                    type="text"
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    placeholder="e.g. Labneh b Toum or Event Charge"
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Price USD ($)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={newItemPrice}
                                        onChange={(e) => setNewItemPrice(e.target.value)}
                                        className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-black focus:outline-none focus:border-[#1c3a1e]"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Sort Order #</label>
                                    <input
                                        type="number"
                                        step="1"
                                        value={newItemSortOrder}
                                        onChange={(e) => setNewItemSortOrder(e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-black focus:outline-none focus:border-[#1c3a1e]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Kitchen Station</label>
                                    <select
                                        value={newItemStation}
                                        onChange={(e: any) => setNewItemStation(e.target.value)}
                                        className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                                    >
                                        <option value="mezza">Mezza (Hot/Cold & Salads)</option>
                                        <option value="sajj">Sajj Station</option>
                                        <option value="grill">BBQ (Grill)</option>
                                        <option value="subs_sandwiches">Subs, Sandwiches & Kids Meals</option>
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

                            <div className="flex flex-col gap-2 pt-1">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="newItemIsBestseller"
                                        checked={newItemIsBestseller}
                                        onChange={(e) => setNewItemIsBestseller(e.target.checked)}
                                        className="h-4 w-4 rounded accent-amber-500 bg-slate-950 border-slate-800"
                                    />
                                    <label htmlFor="newItemIsBestseller" className="text-xs font-black text-amber-400 cursor-pointer flex items-center gap-1">
                                        ⭐ Mark as Bestseller / Chef's Special (Displays gold badge on menu)
                                    </label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="newItemIsStaffOnly"
                                        checked={newItemIsStaffOnly}
                                        onChange={(e) => setNewItemIsStaffOnly(e.target.checked)}
                                        className="h-4 w-4 rounded accent-amber-500 bg-slate-950 border-slate-800"
                                    />
                                    <label htmlFor="newItemIsStaffOnly" className="text-xs font-bold text-amber-300 cursor-pointer">
                                        🔒 Waiter / Staff-Only Item (Hidden from Customer QR menu)
                                    </label>
                                </div>
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
