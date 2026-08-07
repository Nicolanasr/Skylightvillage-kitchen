import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CalculatedBill, formatLbp, formatUsd, getInvoiceReference } from '@/lib/currency';
import { OrderItem } from '@/lib/types';
import { QRCodeSVG } from 'qrcode.react';

export interface SplitPaymentDetails {
    splitTypeLabel: string;
    amountPaidUsd: number;
    paymentMethod: string;
}

export function ThermalReceipt({
    tableNumber,
    items,
    totals,
    isFinal,
    guestName,
    sessionId,
    forceVisible = false,
    onClosePreview,
    splitPaymentDetails,
}: {
    tableNumber: number;
    items: OrderItem[];
    totals: CalculatedBill;
    isFinal: boolean;
    guestName?: string;
    sessionId?: string;
    forceVisible?: boolean;
    onClosePreview?: () => void;
    splitPaymentDetails?: SplitPaymentDetails;
}) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const activeItems = items.filter((i) => i.status !== 'cancelled');

    // Aggregate duplicate items by item_name + modifiers + price + comp status
    const consolidatedMap = new Map<string, {
        id: string;
        item_name: string;
        quantity: number;
        unit_price_usd: number;
        selected_modifiers: any[];
        special_notes?: string;
        is_comped: boolean;
    }>();

    activeItems.forEach((item) => {
        const modKey = JSON.stringify(item.selected_modifiers || []);
        const key = `${item.item_name}_${item.unit_price_usd}_${modKey}_${item.is_comped}`;

        if (consolidatedMap.has(key)) {
            const existing = consolidatedMap.get(key)!;
            existing.quantity += item.quantity;
            if (item.special_notes && !existing.special_notes?.includes(item.special_notes)) {
                existing.special_notes = existing.special_notes
                    ? `${existing.special_notes}, ${item.special_notes}`
                    : item.special_notes;
            }
        } else {
            consolidatedMap.set(key, {
                id: item.id,
                item_name: item.item_name,
                quantity: item.quantity,
                unit_price_usd: Number(item.unit_price_usd),
                selected_modifiers: item.selected_modifiers || [],
                special_notes: item.special_notes,
                is_comped: !!item.is_comped,
            });
        }
    });

    const consolidatedItems = Array.from(consolidatedMap.values());

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const billId = getInvoiceReference(tableNumber, sessionId || items[0]?.session_id);

    const receiptMarkup = (
        <div className="print-receipt-container text-black bg-white font-sans text-xs w-[76mm] max-w-[76mm] p-2 mx-auto">
            {/* Header / Logo */}
            <header className="text-center mb-2">
                <img
                    src="/images/Skylight-logo-white.png"
                    alt="Skylight Village Logo"
                    className="w-36 h-auto mx-auto mb-1 object-contain brightness-0 filter"
                />
                <p className="text-[10px] text-black font-bold m-0">Jaj, Lebanon | Tel: +961 70 66 33 99</p>
                {splitPaymentDetails && (
                    <span className="inline-block mt-1 bg-black text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">
                        SPLIT GUEST INVOICE
                    </span>
                )}
            </header>

            {/* Bill Details */}
            <table className="bill-details text-xs w-full mb-2 border-collapse text-black">
                <tbody>
                    <tr>
                        <td className="text-[11px] py-0.5">Date : <span className="font-bold">{dateStr}</span></td>
                        <td className="text-[11px] py-0.5 text-right">Time : <span className="font-bold">{timeStr}</span></td>
                    </tr>
                    <tr>
                        <td className="text-[11px] py-0.5">
                            {items[0]?.order_type === 'takeout' || tableNumber === 0 ? (
                                <span className="font-black text-black uppercase">🛍️ TAKEOUT ORDER</span>
                            ) : items[0]?.order_type === 'camping' ? (
                                <span className="font-black text-black uppercase">🏕️ CAMPING ORDER</span>
                            ) : (
                                <>Table #: <span className="font-bold">TABLE #{tableNumber}</span></>
                            )}
                        </td>
                        <td className="text-[11px] py-0.5 text-right">Bill #: <span className="font-bold">{billId}</span></td>
                    </tr>
                    {(items[0]?.customer_name || guestName || splitPaymentDetails?.splitTypeLabel) && (
                        <tr>
                            <td colSpan={2} className="text-[11px] py-0.5 text-center font-black uppercase text-black border-t border-b border-black my-1">
                                {items[0]?.customer_name
                                    ? `CUSTOMER: ${items[0].customer_name.toUpperCase()} ${items[0]?.customer_phone ? `(${items[0].customer_phone})` : ''}`
                                    : guestName
                                    ? `GUEST CHECK: ${guestName.toUpperCase()}`
                                    : splitPaymentDetails?.splitTypeLabel}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Items Table */}
            <table className="items w-full text-xs border-collapse my-2 text-black">
                <thead>
                    <tr className="border-t border-b border-black">
                        <th className="heading name text-left py-1 text-[11px] uppercase font-bold w-[45%]">Item</th>
                        <th className="heading qty text-center py-1 text-[11px] uppercase font-bold w-[10%]">Qty</th>
                        <th className="heading rate text-right py-1 text-[11px] uppercase font-bold w-[20%]">Rate</th>
                        <th className="heading amount text-right py-1 text-[11px] uppercase font-bold w-[25%]">Amount</th>
                    </tr>
                </thead>

                <tbody>
                    {consolidatedItems.map((item) => {
                        const unitPrice = item.unit_price_usd;
                        const lineTotal = unitPrice * item.quantity;
                        return (
                            <tr key={item.id} className="border-b border-gray-300 text-[11px]">
                                <td className="py-1 text-left align-top font-bold pr-1">
                                    <div className="text-black font-extrabold">
                                        {item.item_name} {item.is_comped && <span className="text-[10px] text-black font-black uppercase tracking-wider">(FREE ITEM)</span>}
                                    </div>
                                    {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                        <div className="text-[9.5px] text-gray-700 font-medium pl-2 mt-0.5 space-y-0.5">
                                            {item.selected_modifiers.map((m: any, mIdx: number) => (
                                                <div key={mIdx}>- {m.group}: {m.option}</div>
                                            ))}
                                        </div>
                                    )}
                                    {item.special_notes && item.special_notes.trim() !== '' && item.special_notes !== 'Added by Waiter' && (
                                        <div className="text-[9.5px] text-black font-semibold italic pl-2 mt-0.5">Note: {item.special_notes}</div>
                                    )}
                                </td>
                                <td className="py-1 text-center align-top font-bold">{item.quantity}</td>
                                <td className="py-1 text-right align-top font-medium">{item.is_comped ? '$0.00' : `$${unitPrice.toFixed(2)}`}</td>
                                <td className="py-1 text-right align-top font-bold">
                                    {item.is_comped ? 'FREE ($0.00)' : `$${lineTotal.toFixed(2)}`}
                                </td>
                            </tr>
                        );
                    })}

                    {/* Subtotal */}
                    <tr className="text-xs">
                        <td colSpan={3} className="sum-up line text-right font-bold pt-2 border-t border-black">Full Subtotal</td>
                        <td className="line text-right font-bold pt-2 border-t border-black">${totals.subtotalUsd.toFixed(2)}</td>
                    </tr>

                    {/* Discount */}
                    {totals.discountUsd > 0 && (
                        <tr className="text-xs">
                            <td colSpan={3} className="sum-up text-right font-semibold">Discount</td>
                            <td className="text-right font-semibold">-${totals.discountUsd.toFixed(2)}</td>
                        </tr>
                    )}

                    {/* Split Details Section */}
                    {splitPaymentDetails ? (
                        <>
                            <tr>
                                <th colSpan={3} className="total text text-right py-1 text-xs font-black border-t border-b border-dashed border-black">
                                    Split Guest Paid ({splitPaymentDetails.paymentMethod.toUpperCase()})
                                </th>
                                <th className="total price text-right py-1 text-xs font-black border-t border-b border-dashed border-black">
                                    ${splitPaymentDetails.amountPaidUsd.toFixed(2)}
                                </th>
                            </tr>

                            <tr>
                                <th colSpan={3} className="text-right py-1 text-[10.5px] font-extrabold text-gray-800 whitespace-nowrap">
                                    Paid LBP (89,500/$)
                                </th>
                                <th className="text-right py-1 text-[10.5px] font-black text-gray-900 whitespace-nowrap">
                                    <span className="whitespace-nowrap inline-block">
                                        {formatLbp(splitPaymentDetails.amountPaidUsd * 89500)}
                                    </span>
                                </th>
                            </tr>
                        </>
                    ) : (
                        <>
                            {/* Net Total USD */}
                            <tr>
                                <th colSpan={3} className="total text text-right py-1 text-xs font-black border-t border-b border-dashed border-black">
                                    Total USD
                                </th>
                                <th className="total price text-right py-1 text-xs font-black border-t border-b border-dashed border-black">
                                    ${totals.finalTotalUsd.toFixed(2)}
                                </th>
                            </tr>

                            {/* Total LBP */}
                            <tr>
                                <th colSpan={3} className="text-right py-1 text-[10.5px] font-extrabold text-gray-800 whitespace-nowrap">
                                    Total LBP (89,500/$)
                                </th>
                                <th className="text-right py-1 text-[10.5px] font-black text-gray-900 whitespace-nowrap">
                                    <span className="whitespace-nowrap inline-block">{totals.finalTotalLbp}</span>
                                </th>
                            </tr>
                        </>
                    )}
                </tbody>
            </table>

            {/* Google Review QR Code Section */}
            <section className="text-center my-3 pt-2 border-t border-dashed border-black flex flex-col items-center justify-center">
                <p className="text-[10px] font-black uppercase tracking-wider mb-1 text-black">
                    LEAVE US A GOOGLE REVIEW
                </p>
                <div className="my-1 p-1 bg-white border border-black inline-block">
                    <QRCodeSVG
                        value="https://g.page/r/CVjTZaAHNiz0EAI/review"
                        size={64}
                        level="M"
                        includeMargin={false}
                    />
                </div>
                <p className="text-[9px] text-gray-800 font-bold m-0">Scan QR code to rate your experience!</p>
            </section>

            <footer className="text-center text-[10px] text-gray-600 border-t border-gray-300 pt-2">
                <p className="m-0 font-bold text-black">Thank you for visiting Skylight Village!</p>
                <p className="m-0 text-gray-500">www.skylightvillagelb.com</p>
            </footer>
        </div>
    );

    return (
        <>
            {/* On-screen Preview inside Modal */}
            {forceVisible && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-[#1c3a1e] max-h-[90vh] flex flex-col justify-between overflow-hidden">
                        <div className="overflow-y-auto pr-1">
                            {receiptMarkup}
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-[#1c3a1e]/15 mt-2">
                            <button
                                onClick={onClosePreview}
                                className="w-1/2 bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-bold py-3 rounded-2xl text-xs cursor-pointer"
                            >
                                Close Preview
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="w-1/2 bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-2xl text-xs shadow-xs transition-all cursor-pointer"
                            >
                                Print Thermal Bill
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Single Portal to document.body for @media print */}
            {createPortal(receiptMarkup, document.body)}
        </>
    );
}
