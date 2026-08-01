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

  const refreshPOSData = async () => {
    try {
      const data = await getPOSData();
      const pendingCalls = data.serviceCalls.filter((c) => c.status === 'pending');

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
    }
  };

  useEffect(() => {
    refreshPOSData();
    const interval = setInterval(refreshPOSData, 1500); // 1.5-second polling
    return () => clearInterval(interval);
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
