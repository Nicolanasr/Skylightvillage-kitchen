import { CalculatedBill, formatLbp, formatUsd, getInvoiceReference } from '@/lib/currency';
import { OrderItem } from '@/lib/types';
import { QRCodeSVG } from 'qrcode.react';

export function ThermalReceipt({
    tableNumber,
    items,
    totals,
    isFinal,
    guestName,
    sessionId,
}: {
    tableNumber: number;
    items: OrderItem[];
    totals: CalculatedBill;
    isFinal: boolean;
    guestName?: string;
    sessionId?: string;
}) {
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

    return (
        <div className="print-receipt-container hidden print:block text-black bg-white font-sans text-xs w-[2.8in] p-2">
            {/* Header / Logo */}
            <header className="text-center mb-2">
                <img
                    src="/images/Skylight-logo-white.png"
                    alt="Skylight Village Logo"
                    className="w-40 h-auto mx-auto mb-1 object-contain brightness-0"
                />
                <p className="text-[10px] text-gray-700 font-medium m-0">Jaj, Lebanon | Tel: +961 70 66 33 99</p>
            </header>

            {/* Bill Details */}
            <table className="bill-details text-xs w-full mb-2 border-collapse text-black">
                <tbody>
                    <tr>
                        <td className="text-[11px] py-0.5">Date : <span className="font-bold">{dateStr}</span></td>
                        <td className="text-[11px] py-0.5 text-right">Time : <span className="font-bold">{timeStr}</span></td>
                    </tr>
                    <tr>
                        <td className="text-[11px] py-0.5">Table #: <span className="font-bold">TABLE #{tableNumber}</span></td>
                        <td className="text-[11px] py-0.5 text-right">Bill #: <span className="font-bold">{billId}</span></td>
                    </tr>
                    {guestName && (
                        <tr>
                            <td colSpan={2} className="text-[11px] py-0.5 text-center font-black uppercase text-purple-950 border-t border-b border-black my-1">
                                GUEST CHECK: {guestName.toUpperCase()}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Items Table with Quantity Aggregation */}
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
                                    <div className="text-black font-extrabold">{item.item_name}</div>
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
                                <td className="py-1 text-right align-top font-medium">${unitPrice.toFixed(2)}</td>
                                <td className="py-1 text-right align-top font-bold">
                                    {item.is_comped ? 'COMP' : `$${lineTotal.toFixed(2)}`}
                                </td>
                            </tr>
                        );
                    })}

                    {/* Subtotal */}
                    <tr className="text-xs">
                        <td colSpan={3} className="sum-up line text-right font-bold pt-2 border-t border-black">Subtotal</td>
                        <td className="line text-right font-bold pt-2 border-t border-black">${totals.subtotalUsd.toFixed(2)}</td>
                    </tr>

                    {/* Discount if present */}
                    {totals.discountUsd > 0 && (
                        <tr className="text-xs">
                            <td colSpan={3} className="sum-up text-right font-semibold">Discount</td>
                            <td className="text-right font-semibold">-${totals.discountUsd.toFixed(2)}</td>
                        </tr>
                    )}

                    {/* Net Total USD */}
                    <tr>
                        <th colSpan={3} className="total text text-right py-1 text-xs font-black border-t border-b border-dashed border-black">
                            Total USD
                        </th>
                        <th className="total price text-right py-1 text-xs font-black border-t border-b border-dashed border-black">
                            ${totals.finalTotalUsd.toFixed(2)}
                        </th>
                    </tr>

                    {/* Total LBP - Prevent line wrapping */}
                    <tr>
                        <th colSpan={3} className="text-right py-1 text-[10.5px] font-extrabold text-gray-800 whitespace-nowrap">
                            Total LBP (89,500/$)
                        </th>
                        <th className="text-right py-1 text-[10.5px] font-black text-gray-900 whitespace-nowrap">
                            <span className="whitespace-nowrap inline-block">{totals.finalTotalLbp}</span>
                        </th>
                    </tr>
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
}
