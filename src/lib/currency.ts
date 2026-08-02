import { Discount, OrderItem, Payment, CalculatedBill } from './types';
export type { CalculatedBill };

export const DEFAULT_LBP_RATE = 89500;

export function usdToLbp(amountUsd: number, rate = DEFAULT_LBP_RATE): number {
  return Math.round(amountUsd * rate);
}

export function formatUsd(amountUsd: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amountUsd || 0);
}

export function formatLbp(amountUsd: number, rate = DEFAULT_LBP_RATE): string {
  const lbp = usdToLbp(amountUsd || 0, rate);
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(lbp) + ' LBP';
}

export function getInvoiceReference(tableNumber: number, sessionId?: string): string {
  if (!sessionId) {
    return `SKL-T${tableNumber}-POS`;
  }
  const shortCode = sessionId.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `SKL-T${tableNumber}-${shortCode}`;
}

export function calculateBillTotals(
  items: OrderItem[] = [],
  discounts: Discount[] = [],
  payments: Payment[] = [],
  rate = DEFAULT_LBP_RATE
): CalculatedBill {
  const activeItems = items.filter((item) => item.status !== 'cancelled');

  const subtotalUsd = activeItems.reduce((acc, item) => {
    if (item.is_comped) return acc;
    const modifierExtra = (item.selected_modifiers || []).reduce(
      (mAcc, mod) => mAcc + (mod.price_extra || 0),
      0
    );
    return acc + (item.unit_price_usd + modifierExtra) * item.quantity;
  }, 0);

  let discountUsd = 0;
  discounts.forEach((d) => {
    if (d.type === 'fixed') discountUsd += Number(d.value);
    if (d.type === 'percentage') discountUsd += subtotalUsd * (Number(d.value) / 100);
  });

  const finalTotalUsd = Math.max(0, subtotalUsd - discountUsd);

  // Sum explicit payment entries
  const paidFromPayments = payments.reduce((acc, p) => acc + Number(p.amount_usd), 0);

  // Sum items marked as is_paid
  const paidFromItems = activeItems.reduce((acc, item) => {
    if (item.is_paid && !item.is_comped) {
      const modifierExtra = (item.selected_modifiers || []).reduce(
        (mAcc, mod) => mAcc + (mod.price_extra || 0),
        0
      );
      return acc + (item.unit_price_usd + modifierExtra) * item.quantity;
    }
    return acc;
  }, 0);

  const paidUsd = Math.min(finalTotalUsd, Math.max(paidFromPayments, paidFromItems));
  const remainingUsd = Math.max(0, finalTotalUsd - paidUsd);

  return {
    subtotalUsd,
    discountUsd,
    finalTotalUsd,
    paidUsd,
    remainingUsd,
    finalTotalLbp: formatLbp(finalTotalUsd, rate),
    remainingLbp: formatLbp(remainingUsd, rate),
  };
}
