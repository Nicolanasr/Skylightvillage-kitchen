export type StationType = 'mezza' | 'sajj' | 'grill' | 'subs_sandwiches' | 'bar' | 'shisha';
export type TableStatus = 'available' | 'occupied' | 'merged' | 'bill_requested';
export type SessionStatus = 'active' | 'closed';
export type ItemStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type ServiceCallType = 'waiter' | 'charcoal' | 'bill';
export type ServiceCallStatus = 'pending' | 'resolved';

export interface Table {
  id: string;
  table_number: number;
  qr_code_token: string;
  status: TableStatus;
  created_at?: string;
}

export interface TableSession {
  id: string;
  primary_table_id: string;
  merged_table_ids: string[];
  status: SessionStatus;
  order_type?: 'dine_in' | 'takeout' | 'camping' | 'event' | 'event_voucher';
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
  closed_at?: string;
}

export interface ModifierOption {
  name: string;
  price_extra_usd: number;
}

export interface ModifierGroup {
  group_name: string;
  required: boolean;
  options: ModifierOption[];
}

export interface SelectedModifier {
  group: string;
  option: string;
  price_extra: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  price_usd: number;
  price_camping_usd?: number; // Dual pricing for Camping & Picnic orders
  image_url?: string;
  station: StationType;
  available: boolean;
  is_staff_only?: boolean;
  sort_order?: number;
  is_bestseller?: boolean;
  modifier_groups: ModifierGroup[];
}

export function getMenuItemPrice(item: MenuItem, orderType?: string | null): number {
  if (orderType === 'camping' && item.price_camping_usd !== undefined && item.price_camping_usd !== null && Number(item.price_camping_usd) > 0) {
    return Number(item.price_camping_usd);
  }
  return Number(item.price_usd || 0);
}

export interface OrderItem {
  id: string;
  order_id: string;
  session_id: string;
  table_number?: number;
  seat_number?: number;
  guest_name?: string;
  order_type?: 'dine_in' | 'takeout' | 'camping' | 'event' | 'event_voucher';
  customer_name?: string;
  customer_phone?: string;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price_usd: number;
  station: StationType;
  status: ItemStatus;
  selected_modifiers?: SelectedModifier[];
  special_notes?: string;
  is_comped?: boolean;
  is_paid?: boolean;
  is_printed?: boolean;
  loyalty_phone?: string;  // Per-item VIP loyalty assignment
  created_at: string;
}

export interface ServiceCall {
  id: string;
  session_id: string;
  table_number: number;
  type: ServiceCallType;
  status: ServiceCallStatus;
  created_at: string;
}

export interface Payment {
  id: string;
  session_id: string;
  amount_usd: number;
  currency: 'USD' | 'LBP';
  exchange_rate_used: number;
  payment_method: 'cash' | 'card';
  payment_type: 'full' | 'item_split' | 'equal_split' | 'partial';
  created_at: string;
}

export interface PaymentItem {
  id: string;
  payment_id: string;
  order_item_id: string;
  quantity_paid: number;
}

export interface Discount {
  id: string;
  session_id: string;
  type: 'percentage' | 'fixed' | 'item_comp';
  value: number;
  reason?: string;
  created_at: string;
}

export interface CalculatedBill {
  subtotalUsd: number;
  discountUsd: number;
  finalTotalUsd: number;
  paidUsd: number;
  remainingUsd: number;
  finalTotalLbp: string;
  remainingLbp: string;
}

export interface StaffMember {
  id: string;
  name: string;
  pin: string;
  role: 'Waiter' | 'Cashier' | 'Chef' | 'Manager';
}

export interface ActivityLog {
  id: string;
  staff_name: string;
  staff_role: string;
  action_type: string;
  table_number?: number;
  details: string;
  created_at: string;
}
