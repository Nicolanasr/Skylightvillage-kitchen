'use client';

import React from 'react';
import { HelpCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface OrderGuideModalProps {
  isOpen: boolean;
  guideStep: number;
  onClose: () => void;
  onPrevStep: () => void;
  onNextStep: () => void;
}

const GUIDE_STEPS = [
  {
    title: '1. Choose & Customize Dishes 🥗',
    desc: 'Browse through appetizers, main dishes, and drinks. Tap on any item to customize options (e.g. Extra Garlic, Meat Doneness).',
  },
  {
    title: '2. Add Mobile Number for Loyalty 📱',
    desc: 'Inside your cart drawer, enter your phone number to automatically save points & redeem exclusive VIP rewards.',
  },
  {
    title: '3. Live Order Kitchen Tracker 👨‍🍳',
    desc: 'Track your order status live on your screen (Pending ➔ Preparing ➔ Served).',
  },
  {
    title: '4. Service Bell FAB 🔔',
    desc: 'Need extra napkins, charcoal for your Shisha, or waiter assistance? Tap the floating bell icon at the bottom right!',
  },
  {
    title: '5. Pre-Bill & Check Split 🧾',
    desc: 'View your running total anytime by clicking the running bill amount in the top right. You can request your final check or split payments directly!',
  },
];

export const OrderGuideModal: React.FC<OrderGuideModalProps> = ({
  isOpen,
  guideStep,
  onClose,
  onPrevStep,
  onNextStep,
}) => {
  if (!isOpen) return null;

  const step = GUIDE_STEPS[guideStep] || GUIDE_STEPS[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white border border-[#1c3a1e]/20 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e] space-y-5 relative overflow-hidden">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-[#d4af37]" />
            <h3 className="text-base font-black text-[#1c3a1e]">Customer Ordering Guide</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black font-bold p-1 rounded-full text-sm cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Card */}
        <div className="bg-[#fafbfa] border border-[#1c3a1e]/15 p-5 rounded-2xl space-y-2">
          <p className="text-xs font-black text-[#d4af37] uppercase tracking-wider">
            Step {guideStep + 1} of {GUIDE_STEPS.length}
          </p>
          <h4 className="text-sm font-black text-[#1c3a1e]">{step.title}</h4>
          <p className="text-xs text-gray-700 font-medium leading-relaxed">{step.desc}</p>
        </div>

        {/* Modal Controls */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onPrevStep}
            disabled={guideStep === 0}
            className={`flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer ${
              guideStep === 0
                ? 'opacity-40 cursor-not-allowed text-gray-400'
                : 'bg-[#eaf2eb] text-[#1c3a1e] hover:bg-[#d8e6da]'
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Prev</span>
          </button>

          {guideStep < GUIDE_STEPS.length - 1 ? (
            <button
              onClick={onNextStep}
              className="flex items-center gap-1 text-xs font-black bg-[#1c3a1e] hover:bg-black text-white px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-xs font-black bg-[#d4af37] hover:bg-[#b5942b] text-[#1c3a1e] px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              Got it! Start Ordering
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
