'use client';

import { useEffect, useState, useRef } from 'react';
import { getKDSData } from '@/app/actions/order-actions';
import { OrderItem, MenuItem } from '@/lib/types';

export function useRealtimeKDS(stationFilter: string) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const prevCountRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  const refreshKDSData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const data = await getKDSData(stationFilter);

      const pendingCount = (data.items || []).filter((i: OrderItem) => i.status === 'pending').length;
      if (pendingCount > prevCountRef.current && prevCountRef.current !== 0) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.3);
        } catch (e) {}
      }
      prevCountRef.current = pendingCount;

      setItems(data.items);
      setMenuItems(data.menuItems);
    } catch (e) {
      console.error('KDS Fetch error:', e);
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    refreshKDSData();

    let eventSource: EventSource | null = null;
    let ws: WebSocket | null = null;
    let bc: BroadcastChannel | null = null;

    // 1. Instant 0ms Cross-Tab Broadcast Channel (Local Dev & Same Browser)
    try {
      bc = new BroadcastChannel('skylight_events');
      bc.onmessage = (msg) => {
        if (msg.data?.event === 'kds_update') {
          console.log('⚡ Realtime Source: BroadcastChannel (0ms local cross-tab push)');
          refreshKDSData();
        }
      };
    } catch (e) {}

    // 2. LocalStorage fallback listener
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'skylight_event_kds') {
        console.log('⚡ Realtime Source: localStorage fallback event');
        refreshKDSData();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
    }

    // 3. Native SSE Server Stream (Always connected as primary/fallback)
    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('kds_update', () => {
        console.log('⚡ Realtime Source: EventSource (SSE stream)');
        refreshKDSData();
      });
      eventSource.onerror = () => {};
    } catch (e) {}

    // 4. External WebSocket Stream (if NEXT_PUBLIC_WEBSOCKET_URL or APINATOR_KEY configured)
    const apiKey = process.env.NEXT_PUBLIC_APINATOR_KEY || process.env.APINATOR_KEY || 'app_d01de6e4a0b4c1aa6a723850115ba737654d3e54';
    const cluster = process.env.NEXT_PUBLIC_APINATOR_CLUSTER || 'eu';
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || `wss://ws-${cluster}.apinator.io/app/${apiKey}?protocol=7&client=js`;

    if (wsUrl) {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          console.log('⚡ Connected to Apinator WebSocket (Channel: skylight-kds)');
          try {
            ws?.send(JSON.stringify({
              event: 'realtime:subscribe',
              data: JSON.stringify({ channel: 'skylight-kds' })
            }));
          } catch (e) {}
        };
        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data.event === 'realtime:ping') {
              ws?.send(JSON.stringify({ event: 'realtime:pong', data: '' }));
              return;
            }
            if (data.event === 'kds_update' || data.channel === 'skylight-kds') {
              console.log('⚡ Realtime Source: WebSocket (Apinator cloud push)');
              refreshKDSData();
            }
          } catch (e) {}
        };
        ws.onerror = () => {
          console.warn('⚠️ External WebSocket connection offline. Active on native SSE stream.');
        };
      } catch (e) {}
    }

    return () => {
      if (bc) bc.close();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
      }
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => {
            try { ws.close(); } catch (e) {}
          };
        }
      }
      if (eventSource) eventSource.close();
    };
  }, [stationFilter]);

  return { items, menuItems, refreshKDSData };
}
