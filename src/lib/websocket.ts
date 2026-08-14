import { Apinator } from '@apinator/server';

export const APINATOR_KEY = process.env.NEXT_PUBLIC_APINATOR_KEY || process.env.APINATOR_KEY || 'app_d01de6e4a0b4c1aa6a723850115ba737654d3e54';
export const APINATOR_APP_ID = process.env.APINATOR_APP_ID || 'b3b31165-0fd9-4396-a601-da6942889d5e';
export const APINATOR_SECRET = process.env.APINATOR_SECRET || '6e337d5e34668bfb532eaf750b636e01cbeae176c005514947ec8eb09edd7645';
export const APINATOR_CLUSTER = process.env.NEXT_PUBLIC_APINATOR_CLUSTER || process.env.APINATOR_CLUSTER || 'eu';

let apinatorClient: Apinator | null = null;
if (APINATOR_APP_ID && APINATOR_KEY && APINATOR_SECRET) {
  try {
    apinatorClient = new Apinator({
      appId: APINATOR_APP_ID,
      key: APINATOR_KEY,
      secret: APINATOR_SECRET,
      cluster: APINATOR_CLUSTER as any,
    });
  } catch (e) {}
}

export function isApinatorConfigured(): boolean {
  return Boolean(apinatorClient);
}

/**
 * Trigger a real-time event to Apinator WebSocket channel from Server Actions
 */
export async function publishApinatorEvent(channel: string, event: string, payload: any = {}) {
  if (!apinatorClient) return;

  try {
    await apinatorClient.trigger({
      channel,
      name: event,
      data: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('Error publishing Apinator event:', e);
  }
}
