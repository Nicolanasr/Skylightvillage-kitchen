import Link from 'next/link';
import {
  Utensils,
  ChefHat,
  Monitor,
  FileSpreadsheet,
  QrCode,
  Sparkles,
  ArrowRight,
  Ticket,
  ShoppingBag,
  Shield,
} from 'lucide-react';

export default function StaffHubPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8 antialiased">
      {/* Top Navigation Header */}
      <header className="max-w-6xl mx-auto w-full flex flex-col sm:flex-row justify-between items-start sm:items-center py-6 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Utensils className="h-6 w-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
              Skylight Village Staff Hub
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Restaurant POS, KDS, Takeout & Live Event Voucher Control Center
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-full text-xs font-semibold text-amber-400">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>Dual Currency Active (89,500 LBP/USD)</span>
        </div>
      </header>

      {/* Main Grid Navigation Cards */}
      <main className="max-w-6xl mx-auto w-full my-auto py-10 space-y-8">
        <div className="text-center space-y-3">
          <h2 className="text-3xl md:text-5xl font-black text-slate-100 tracking-tight">
            Staff System Control Hub
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-xs md:text-sm">
            Select an operational interface below to manage dine-in tables, takeout orders, live event food vouchers, kitchen tickets, or admin settings.
          </p>
        </div>

        {/* 4 Primary Operational Hub Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Waiter & Cashier POS */}
          <div className="glass-card rounded-3xl p-5 flex flex-col justify-between border border-slate-800 hover:border-blue-500/50 transition-all duration-300 group">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                <Monitor className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-1.5">Waiter & Cashier POS</h3>
              <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                Floor plan layout, active table carts, waiter service bell calls, invoice billing, and split checkout.
              </p>
            </div>
            <Link
              href="/pos"
              className="w-full bg-blue-500 hover:bg-blue-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl flex items-center justify-between text-xs transition-all shadow-md"
            >
              <span>Open Floor Plan POS</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Card 2: Takeout & Camping Workbench */}
          <div className="glass-card rounded-3xl p-5 flex flex-col justify-between border border-slate-800 hover:border-amber-500/50 transition-all duration-300 group">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-1.5">Takeout & Camping</h3>
              <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                Dedicated customer self-ordering PWA for pick-up orders, phone orders, and outdoor camping guests.
              </p>
            </div>
            <Link
              href="/takeout"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl flex items-center justify-between text-xs transition-all shadow-md"
            >
              <span>Launch Takeout Menu</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Card 3: High-Speed Event Voucher Terminal */}
          <div className="glass-card rounded-3xl p-5 flex flex-col justify-between border border-slate-800 hover:border-purple-500/50 transition-all duration-300 group">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                <Ticket className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-1.5">Event Vouchers Terminal</h3>
              <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                High-speed event pop-up sales desk. Bypasses KDS screens to auto-print individual tear-off food claim slips.
              </p>
            </div>
            <Link
              href="/events"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-between text-xs transition-all shadow-md"
            >
              <span>Open Event Terminal</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Card 4: Kitchen Display System (KDS) */}
          <div className="glass-card rounded-3xl p-5 flex flex-col justify-between border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 group">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                <ChefHat className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-1.5">Kitchen Display (KDS)</h3>
              <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                Station-filtered ticket feeds (*Sajj, BBQ, Mezza, Bar, Shisha*), audio alerts, and kitchen ticket printing.
              </p>
            </div>
            <Link
              href="/kds"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl flex items-center justify-between text-xs transition-all shadow-md"
            >
              <span>Open KDS Screen</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Secondary Quick Action Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            href="/admin"
            className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-200 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-amber-400" />
              <span>Admin Manager</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          </Link>

          <Link
            href="/pos/reports"
            className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-200 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span>Shift Sales Reports</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          </Link>

          <Link
            href="/qr"
            className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-200 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <QrCode className="h-4 w-4 text-blue-400" />
              <span>Table QR Generator</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          </Link>

          <Link
            href="/"
            className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-200 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <Utensils className="h-4 w-4 text-purple-400" />
              <span>Public View-Only Menu</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full py-4 border-t border-slate-900 text-center text-xs text-slate-500">
        Skylight Village Staff Hub &bull; Built with Next.js & Neon Postgres
      </footer>
    </div>
  );
}
