/**
 * Apinator / Managed WebSocket Push Helper
 * 
 * Provides zero-latency real-time order broadcasts across Vercel Lambdas.
 * When an API key or URL is present in .env.local (NEXT_PUBLIC_APINATOR_KEY or NEXT_PUBLIC_WEBSOCKET_URL),
 * it streams updates directly over WebSocket connections.
 */

export const APINATOR_KEY = process.env.NEXT_PUBLIC_APINATOR_KEY || process.env.APINATOR_KEY || '';
export const APINATOR_APP_ID = process.env.APINATOR_APP_ID || '';
export const APINATOR_SECRET = process.env.APINATOR_SECRET || '';
export const APINATOR_CLUSTER = process.env.NEXT_PUBLIC_APINATOR_CLUSTER || process.env.APINATOR_CLUSTER || 'eu';
export const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.WEBSOCKET_URL || '';

export function isApinatorConfigured(): boolean {
  return Boolean(APINATOR_KEY || WEBSOCKET_URL);
}

/**
 * Trigger a real-time event to Apinator WebSocket channel from Server Actions
 */
export async function publishApinatorEvent(channel: string, event: string, payload: any = {}) {
  if (!isApinatorConfigured()) return;

  const endpoint = WEBSOCKET_URL
    ? `${WEBSOCKET_URL}/publish`
    : APINATOR_APP_ID
    ? `https://api.apinator.io/v1/apps/${APINATOR_APP_ID}/events`
    : `https://api.apinator.io/v1/publish`;

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Realtime-Key': APINATOR_KEY,
        'Authorization': `Bearer ${APINATOR_KEY}`,
      },
      body: JSON.stringify({
        channel,
        name: event,
        event,
        data: JSON.stringify(payload),
        timestamp: Date.now(),
      }),
    });
  } catch (e) {
    console.error('Error publishing Apinator event:', e);
  }
}
