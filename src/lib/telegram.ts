/**
 * Telegram Bot Order Notification Helper
 * 
 * Sends rich Markdown-formatted alerts to your staff Telegram group/channel
 * whenever a new order is submitted (Dine-In, Takeout, Camping, or Waiter POS).
 */

interface TelegramOrderItem {
  itemName: string;
  quantity: number;
  selectedModifiers?: any[];
  specialNotes?: string;
  unitPriceUsd?: number;
}

interface TelegramOrderPayload {
  orderType?: 'dine_in' | 'takeout' | 'camping' | 'event_voucher' | string;
  tableNumber?: number | string;
  customerName?: string;
  customerPhone?: string;
  items: TelegramOrderItem[];
  totalUsd?: number;
}

export async function sendTelegramOrderNotification(payload: TelegramOrderPayload) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '8967681842:AAEB3mYEQO2T-xy3B9wBUO93Qki2rv_YIC0';
  const chatId = process.env.TELEGRAM_CHAT_ID || '-5412526905';

  if (!botToken || !chatId) {
    console.warn('⚠️ Telegram botToken or chatId missing');
    return;
  }

  const escapeHtml = (str: string) =>
    (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  try {
    const typeLabel =
      payload.orderType === 'takeout'
        ? '🛍️ <b>NEW TAKEOUT ORDER</b>'
        : payload.orderType === 'camping'
        ? '🏕️ <b>NEW CAMPING ORDER</b>'
        : payload.orderType === 'event_voucher'
        ? '🎟️ <b>NEW EVENT TICKET ORDER</b>'
        : `🍽️ <b>NEW DINE-IN ORDER — Table #${escapeHtml(String(payload.tableNumber || '?'))}</b>`;

    const guestLine = payload.customerName && payload.customerName.trim()
      ? `\n👤 <b>Guest:</b> ${escapeHtml(payload.customerName.trim())}`
      : '';
    const phoneLine = payload.customerPhone && payload.customerPhone.trim()
      ? `\n📞 <b>Phone:</b> <code>${escapeHtml(payload.customerPhone.trim())}</code>`
      : '';

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const itemLines = (payload.items || []).map((item) => {
      const qtyStr = `${item.quantity || 1}x`;
      let line = `• <b>${qtyStr} ${escapeHtml(item.itemName)}</b>`;
      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        const modsStr = item.selectedModifiers.map((m: any) => `${escapeHtml(m.group || m.group_name || '')}: ${escapeHtml(m.option || m.name || '')}`).join(', ');
        line += `\n   └ <i>Modifiers: ${modsStr}</i>`;
      }
      if (item.specialNotes && item.specialNotes.trim()) {
        line += `\n   └ 📝 <i>Note: ${escapeHtml(item.specialNotes.trim())}</i>`;
      }
      return line;
    });

    let totalStr = '';
    if (payload.totalUsd && payload.totalUsd > 0) {
      totalStr = `\n\n💵 <b>Total:</b> $${payload.totalUsd.toFixed(2)}`;
    }

    const text = `${typeLabel}${guestLine}${phoneLine}\n\n📋 <b>Order Items:</b>\n${itemLines.join('\n')}${totalStr}\n\n⏰ <i>${timeStr} | Skylight Kitchen</i>`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    console.log(`[Telegram] Dispatching order alert to chat ${chatId}...`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const resJson = await res.json();
    if (!res.ok || !resJson.ok) {
      console.error('❌ Telegram API error response:', resJson);
    } else {
      console.log('✅ Telegram alert delivered successfully! Message ID:', resJson.result?.message_id);
    }
  } catch (error) {
    console.error('⚠️ Telegram notification delivery failed:', error);
  }
}
