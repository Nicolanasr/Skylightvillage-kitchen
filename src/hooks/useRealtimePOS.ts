'use client';

import { useEffect, useState, useRef } from 'react';
import { getPOSData } from '@/app/actions/payment-actions';
import { Table, TableSession, ServiceCall, OrderItem, Discount, Payment, MenuItem, MenuCategory } from '@/lib/types';

export function useRealtimePOS() {
  const [tables, setTables] = useState<Table[]>([]);
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [serviceCalls, setServiceCalls] = useState<ServiceCall[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);

  const prevPendingCallsCount = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  const refreshPOSData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const data = await getPOSData();
      const pendingCalls = (data.serviceCalls || []).filter((c: any) => c.status === 'pending');

      if (pendingCalls.length > prevPendingCallsCount.current && prevPendingCallsCount.current !== 0) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
          osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.4);
        } catch (e) {}
      }
      prevPendingCallsCount.current = pendingCalls.length;

      setTables(data.tables);
      setSessions(data.sessions);
      setServiceCalls(data.serviceCalls);
      setOrderItems(data.orderItems);
      setDiscounts(data.discounts);
      setPayments(data.payments);
      if (data.menuItems) setMenuItems(data.menuItems);
      if (data.categories) setCategories(data.categories);
    } catch (e) {
      console.error('POS fetch error:', e);
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    refreshPOSData();

    let eventSource: EventSource | null = null;
    let ws: WebSocket | null = null;
    let bc: BroadcastChannel | null = null;

    // 1. Instant 0ms Cross-Tab Broadcast Channel
    try {
      bc = new BroadcastChannel('skylight_events');
      bc.onmessage = (msg) => {
        if (msg.data?.event === 'pos_update') {
          console.log('⚡ Realtime Source: BroadcastChannel (0ms local cross-tab push)');
          refreshPOSData();
        }
      };
    } catch (e) {}

    // 2. LocalStorage fallback listener
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'skylight_event_pos') {
        console.log('⚡ Realtime Source: localStorage fallback event');
        refreshPOSData();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
    }

    // 3. Native SSE Server Stream (Always connected as primary/fallback)
    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('pos_update', () => {
        console.log('⚡ Realtime Source: EventSource (SSE stream)');
        refreshPOSData();
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
          console.log('⚡ Connected to Apinator WebSocket (Channel: skylight-pos)');
          try {
            ws?.send(JSON.stringify({
              event: 'realtime:subscribe',
              data: JSON.stringify({ channel: 'skylight-pos' })
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
            if (data.event === 'pos_update' || data.channel === 'skylight-pos') {
              console.log('⚡ Realtime Source: WebSocket (Apinator cloud push)');
              refreshPOSData();
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
  }, []);

  return {
    tables,
    sessions,
    serviceCalls,
    orderItems,
    discounts,
    payments,
    menuItems,
    categories,
    refreshPOSData,
  };
}
