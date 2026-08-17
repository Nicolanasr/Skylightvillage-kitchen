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
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Silently skip if environment variables are not yet configured
  if (!botToken || !chatId) {
    return;
  }

  try {
    const typeLabel =
      payload.orderType === 'takeout'
        ? '🛍️ *NEW TAKEOUT ORDER*'
        : payload.orderType === 'camping'
        ? '🏕️ *NEW CAMPING ORDER*'
        : payload.orderType === 'event_voucher'
        ? '🎟️ *NEW EVENT TICKET ORDER*'
        : `🍽️ *NEW DINE-IN ORDER — Table #${payload.tableNumber || '?'}`;

    const guestLine = payload.customerName && payload.customerName.trim()
      ? `\n👤 *Guest:* ${payload.customerName.trim()}`
      : '';
    const phoneLine = payload.customerPhone && payload.customerPhone.trim()
      ? `\n📞 *Phone:* \`${payload.customerPhone.trim()}\``
      : '';

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const itemLines = (payload.items || []).map((item) => {
      const qtyStr = `${item.quantity || 1}x`;
      let line = `• *${qtyStr} ${item.itemName}*`;
      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        const modsStr = item.selectedModifiers.map((m: any) => `${m.group || m.group_name}: ${m.option || m.name}`).join(', ');
        line += `\n   └ _Modifiers: ${modsStr}_`;
      }
      if (item.specialNotes && item.specialNotes.trim()) {
        line += `\n   └ 📝 _Note: ${item.specialNotes.trim()}_`;
      }
      return line;
    });

    let totalStr = '';
    if (payload.totalUsd && payload.totalUsd > 0) {
      totalStr = `\n\n💵 *Total:* $${payload.totalUsd.toFixed(2)}`;
    }

    const text = `${typeLabel}${guestLine}${phoneLine}\n\n📋 *Order Items:*\n${itemLines.join('\n')}${totalStr}\n\n⏰ _${timeStr} | Skylight Kitchen_`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.error('⚠️ Telegram notification delivery failed:', error);
  }
}
