'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function QRRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-xl font-bold mb-2">Redirecting to Admin Floor Plan & QR Generator...</h1>
      <p className="text-xs text-slate-400">QR Code generation is now managed directly inside the Admin Portal under Tables & Floor Plan.</p>
    </div>
  );
}
