'use client';

import { useEffect, useState, useRef } from 'react';
import { getKDSData } from '@/app/actions/order-actions';
import { OrderItem, MenuItem } from '@/lib/types';

export function useRealtimeKDS(stationFilter: string) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const prevCountRef = useRef<number>(0);

  const refreshKDSData = async () => {
    try {
      const data = await getKDSData(stationFilter);

      const pendingCount = data.items.filter((i) => i.status === 'pending').length;
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
    }
  };

  useEffect(() => {
    refreshKDSData();
    const interval = setInterval(refreshKDSData, 1500); // 1.5-second polling
    return () => clearInterval(interval);
  }, [stationFilter]);

  return { items, menuItems, refreshKDSData };
}
