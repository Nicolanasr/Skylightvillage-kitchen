'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { claimReceiptPointsAction, lookupCustomerLoyalty, getLoyaltyEnabledSetting } from '@/app/actions/loyalty-actions';
import { Gift, Sparkles, CheckCircle2, Phone, User, Award, ArrowRight, AlertCircle } from 'lucide-react';

function ClaimFormContent() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token') || '';

  const [claimToken, setClaimToken] = useState(tokenParam);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [claimedResult, setClaimedResult] = useState<{ points: number; totalBalance?: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);

  useEffect(() => {
    getLoyaltyEnabledSetting().then((enabled) => setLoyaltyEnabled(enabled));
  }, []);

  useEffect(() => {
    if (tokenParam) {
      setClaimToken(tokenParam);
    }
  }, [tokenParam]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimToken.trim()) return setErrorMsg('Please enter or scan your receipt claim token.');
    if (!phoneNumber.trim()) return setErrorMsg('Please enter your mobile phone number.');

    setLoading(true);
    setErrorMsg('');

    const res = await claimReceiptPointsAction(claimToken, phoneNumber, customerName);
    if (res.success && res.pointsClaimed) {
      // Lookup updated profile balance
      const profileRes = await lookupCustomerLoyalty(phoneNumber);
      setClaimedResult({
        points: res.pointsClaimed,
        totalBalance: profileRes.customer?.points_balance || res.pointsClaimed,
      });
    } else {
      setErrorMsg(res.error || 'Failed to claim points. Please check token.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1c3a1e] via-[#244827] to-[#1c3a1e] text-white p-4 sm:p-6 flex flex-col justify-between items-center font-sans antialiased">
      {/* Top Header Logo */}
      <div className="w-full max-w-md text-center pt-6 space-y-2">
        <div className="h-16 w-16 bg-[#d4af37]/20 border border-[#d4af37]/40 rounded-2xl flex items-center justify-center mx-auto shadow-lg backdrop-blur-md">
          <Sparkles className="h-8 w-8 text-[#d4af37] animate-pulse" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">Skylight Village</h1>
        <p className="text-xs text-emerald-200/80 font-medium">VIP Loyalty Rewards Claim Portal</p>
      </div>

      {/* Main Container Card */}
      <div className="w-full max-w-md my-auto bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {!loyaltyEnabled ? (
          <div className="text-center py-6 space-y-4">
            <div className="h-16 w-16 bg-amber-500/20 border border-amber-400/40 rounded-3xl flex items-center justify-center mx-auto text-amber-300">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black">Loyalty Program Paused</h2>
            <p className="text-xs text-emerald-100/90 leading-relaxed font-medium">
              The Skylight Village VIP Loyalty Rewards Program is currently offline or paused by management. Please check back later!
            </p>
          </div>
        ) : claimedResult ? (
          <div className="text-center space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="h-20 w-20 bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest block">Success! Points Added</span>
              <h2 className="text-4xl font-black text-[#d4af37]">+ {claimedResult.points} PTS</h2>
              <p className="text-xs text-emerald-100">Claimed from receipt {claimToken}</p>
            </div>

            <div className="bg-white/10 border border-white/15 rounded-2xl p-4 text-center space-y-1">
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider block">Your Total VIP Balance</span>
              <strong className="text-2xl font-black text-white">{claimedResult.totalBalance} Points</strong>
              <p className="text-[11px] text-emerald-200/80 pt-1 font-medium">Use your phone number {phoneNumber} on your next visit to redeem free Shisha or Tawook!</p>
            </div>

            <button
              onClick={() => {
                setClaimedResult(null);
                setClaimToken('');
              }}
              className="w-full bg-[#d4af37] hover:bg-amber-400 text-[#1c3a1e] font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Claim Another Receipt</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleClaim} className="space-y-4">
            <div className="text-center space-y-1 pb-2 border-b border-white/10">
              <h3 className="text-lg font-black text-white flex items-center justify-center gap-2">
                <Gift className="h-5 w-5 text-[#d4af37]" />
                <span>Claim Receipt Points</span>
              </h3>
              <p className="text-xs text-emerald-200/80 font-medium">Enter the claim code from your thermal receipt</p>
            </div>

            {errorMsg && (
              <div className="bg-red-500/20 border border-red-400/40 text-red-200 text-xs font-bold p-3 rounded-2xl text-center">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-emerald-200 mb-1">Receipt Claim Code</label>
                <div className="relative">
                  <Award className="absolute left-3.5 top-3 h-4 w-4 text-emerald-300" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. CLM-892A-45PTS"
                    value={claimToken}
                    onChange={(e) => setClaimToken(e.target.value.toUpperCase())}
                    className="w-full bg-white/15 border border-white/20 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-emerald-200/50 font-black tracking-wider uppercase focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-emerald-200 mb-1">Mobile Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-emerald-300" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 70 123 456"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-white/15 border border-white/20 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-emerald-200/50 font-black focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-emerald-200 mb-1">Your Name (Optional)</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-emerald-300" />
                  <input
                    type="text"
                    placeholder="e.g. Nicola Nasr"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-white/15 border border-white/20 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-emerald-200/50 font-bold focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#d4af37] hover:bg-amber-400 text-[#1c3a1e] font-black py-4 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span>Processing Claim...</span>
              ) : (
                <>
                  <span>Claim My Points Now</span>
                  <Sparkles className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-md text-center pb-4 text-[11px] text-emerald-200/60 font-medium space-y-1">
        <p>1 USD Spent = 1 Loyalty Point Earned</p>
        <p>© Skylight Village Kitchen & Lounge POS</p>
      </div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#1c3a1e] flex items-center justify-center text-white text-xs font-black">
        Loading Loyalty Claim Portal...
      </div>
    }>
      <ClaimFormContent />
    </Suspense>
  );
}
