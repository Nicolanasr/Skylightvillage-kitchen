import { NextRequest } from 'next/server';
import { appEvents, EVENT_KDS_UPDATE, EVENT_POS_UPDATE } from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connection success message
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'ok' })}\n\n`));

      // 2. Listen for real-time order/status updates
      const onKDSUpdate = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: kds_update\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {}
      };

      const onPOSUpdate = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: pos_update\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {}
      };

      appEvents.on(EVENT_KDS_UPDATE, onKDSUpdate);
      appEvents.on(EVENT_POS_UPDATE, onPOSUpdate);

      // 3. Heartbeat ping every 30s to keep socket connection alive without DB reads
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (e) {}
      }, 30000);

      // Clean up when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        appEvents.off(EVENT_KDS_UPDATE, onKDSUpdate);
        appEvents.off(EVENT_POS_UPDATE, onPOSUpdate);
        try {
          controller.close();
        } catch (e) {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
