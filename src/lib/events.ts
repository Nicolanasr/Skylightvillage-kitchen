import { EventEmitter } from 'events';
import { publishApinatorEvent } from './websocket';
import { invalidatePOSCache } from '@/app/actions/payment-actions';

class AppEventEmitter extends EventEmitter {}

const globalEventEmitter = (global as any).appEventEmitter || new AppEventEmitter();
if (process.env.NODE_ENV !== 'production') {
  (global as any).appEventEmitter = globalEventEmitter;
}

export const appEvents = globalEventEmitter;

export const EVENT_KDS_UPDATE = 'kds_update';
export const EVENT_POS_UPDATE = 'pos_update';

export function notifyKDSUpdate() {
  const payload = { timestamp: Date.now() };
  appEvents.emit(EVENT_KDS_UPDATE, payload);
  publishApinatorEvent('skylight-kds', 'kds_update', payload);
}

export function notifyPOSUpdate() {
  invalidatePOSCache();
  const payload = { timestamp: Date.now() };
  appEvents.emit(EVENT_POS_UPDATE, payload);
  publishApinatorEvent('skylight-pos', 'pos_update', payload);
}
