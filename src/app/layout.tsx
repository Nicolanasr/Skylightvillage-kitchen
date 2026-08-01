import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Skylight Village - Restaurant Self-Ordering, KDS & POS',
  description: 'Continuous QR Self-Ordering, Kitchen Display System, and Waiter Cashier POS for Skylight Village',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased selection:bg-amber-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
