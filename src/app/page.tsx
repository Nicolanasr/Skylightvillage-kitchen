import Link from 'next/link';
import { Utensils, ChefHat, Monitor, FileSpreadsheet, QrCode, Sparkles, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto w-full flex justify-between items-center py-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Utensils className="h-6 w-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
              Skylight Village
            </h1>
            <p className="text-xs text-slate-400 font-medium">Continuous QR Self-Ordering, KDS & POS Platform</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-semibold text-amber-400">
          <Sparkles className="h-4 w-4" />
          <span>Dual Currency Active (89,500 LBP/USD)</span>
        </div>
      </header>

      {/* Main Grid Navigation */}
      <main className="max-w-6xl mx-auto w-full my-auto py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-slate-100 mb-4 tracking-tight">
            Restaurant Control Hub
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base">
            Select an operational terminal interface below to access live table sessions, kitchen tickets, or guest QR self-ordering.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Customer Ordering PWA */}
          <div className="glass-card rounded-3xl p-6 flex flex-col justify-between hover:border-amber-500/50 transition-all duration-300 group">
            <div>
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                <QrCode className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Customer QR Ordering</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Guest mobile PWA featuring continuous add-to-cart, item modifiers (Shisha, meat temperature), floating service bell, and live dual-currency bill tracking.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href="/order?table=1&token=token-table-1"
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl flex items-center justify-between text-sm transition-all"
              >
                <span>Launch Table 1 Demo</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/order?table=2&token=token-table-2"
                className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between text-xs border border-slate-800 transition-all"
              >
                <span>Launch Table 2 (Bill Requested)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: Kitchen Display System (KDS) */}
          <div className="glass-card rounded-3xl p-6 flex flex-col justify-between hover:border-amber-500/50 transition-all duration-300 group">
            <div>
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                <ChefHat className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Kitchen Display (KDS)</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Station-filtered ticket feeds (*Cold Mezza, Hot Mezza, Grill, Bar, Shisha*), audio alerts, one-tap item status progression, and kitchen item 86ing.
              </p>
            </div>
            <Link
              href="/kds"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 px-4 rounded-xl flex items-center justify-between text-sm transition-all"
            >
              <span>Open KDS Screen</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Card 3: Waiter / Cashier POS */}
          <div className="glass-card rounded-3xl p-6 flex flex-col justify-between hover:border-amber-500/50 transition-all duration-300 group">
            <div>
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                <Monitor className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Waiter & Cashier POS</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Live floor table matrix, waiter service call tray, table merging, discount manager, 80mm thermal receipt printing, and split payments.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href="/pos"
                className="w-full bg-blue-500 hover:bg-blue-600 text-slate-950 font-bold py-3 px-4 rounded-xl flex items-center justify-between text-sm transition-all"
              >
                <span>Open POS Terminal</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pos/reports"
                className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between text-xs border border-slate-800 transition-all"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-amber-400" />
                  <span>Z-Report Shift Summary</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full py-6 border-t border-slate-900 text-center text-xs text-slate-500">
        Skylight Village Restaurant Management Platform &bull; Built with Next.js 14, Neon Postgres, & Tailwind CSS
      </footer>
    </div>
  );
}
