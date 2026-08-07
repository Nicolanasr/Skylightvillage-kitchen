-- ====================================================================
-- SKYLIGHT VILLAGE RESTAURANT - MASTER DATABASE SCHEMA & MIGRATION SCRIPT
-- ====================================================================
-- Paste and execute this entire script in your Neon Console SQL Editor to set up or migrate your live database.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tables (Physical Restaurant Floor Layout)
CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  table_number INT UNIQUE NOT NULL,
  qr_code_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'merged', 'bill_requested')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table Sessions (Active Dining Parties, Takeout & Event Tickets)
CREATE TABLE IF NOT EXISTS table_sessions (
  id TEXT PRIMARY KEY,
  primary_table_id TEXT NOT NULL,
  merged_table_ids JSONB DEFAULT '[]'::jsonb,
  customer_name TEXT DEFAULT '',
  order_type TEXT DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeout', 'camping', 'event', 'event_voucher')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- 3. Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Menu Items & Modifiers
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  station TEXT NOT NULL DEFAULT 'cold_mezza',
  available BOOLEAN DEFAULT true,
  is_staff_only BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  is_bestseller BOOLEAN DEFAULT false,
  image_url TEXT DEFAULT '',
  modifier_groups JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. System Settings (Exchange Rates, POS Configurations)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
INSERT INTO system_settings (key, value)
VALUES ('exchange_rate', '{"lbp_per_usd": 89500}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 6. Orders & Order Items
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES table_sessions(id) ON DELETE CASCADE,
  order_type TEXT DEFAULT 'dine_in',
  ticket_tag TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  session_id TEXT NOT NULL,
  table_number INT DEFAULT 0,
  menu_item_id TEXT,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  station TEXT NOT NULL DEFAULT 'cold_mezza',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
  guest_name TEXT DEFAULT '',
  special_notes TEXT DEFAULT '',
  selected_modifiers JSONB DEFAULT '[]'::jsonb,
  is_comped BOOLEAN DEFAULT false,
  is_paid BOOLEAN DEFAULT false,
  is_printed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Discounts & Comps
CREATE TABLE IF NOT EXISTS discounts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT CHECK (type IN ('percentage', 'fixed', 'item_comp')),
  value NUMERIC(10,2) NOT NULL,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Payments & Split Billing
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  amount_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_lbp NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  exchange_rate_used INT NOT NULL DEFAULT 89500,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'split', 'usd', 'lbp')),
  payment_type TEXT DEFAULT 'full',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Staff Roster & Activity Audit Logs
CREATE TABLE IF NOT EXISTS staff_roster (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Manager', 'Cashier', 'Waiter', 'Kitchen')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  staff_name TEXT NOT NULL,
  staff_role TEXT NOT NULL,
  action_type TEXT NOT NULL,
  table_number INT,
  details TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Service Calls (Waiter Bell Notifications)
CREATE TABLE IF NOT EXISTS service_calls (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  table_number INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('waiter', 'charcoal', 'bill')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Raw Ingredients Inventory (kg, g, pcs, liters, ml)
CREATE TABLE IF NOT EXISTS raw_ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'g', 'pcs', 'liter', 'ml', 'pack')),
  current_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(12,3) NOT NULL DEFAULT 0,
  cost_per_unit_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Menu Item Recipes (Bill of Materials Portion Links)
CREATE TABLE IF NOT EXISTS menu_item_recipes (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES raw_ingredients(id) ON DELETE CASCADE,
  quantity_required NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Supplier Receiving Deliveries (Stock In)
CREATE TABLE IF NOT EXISTS inventory_receiving (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES raw_ingredients(id) ON DELETE CASCADE,
  quantity_added NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  supplier_name TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Kitchen Waste & Spoilage Logs
CREATE TABLE IF NOT EXISTS inventory_waste (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES raw_ingredients(id) ON DELETE CASCADE,
  quantity_wasted NUMERIC(12,3) NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  logged_by TEXT DEFAULT 'Staff',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Real-Time Order Sales Deduction Audit Logs
CREATE TABLE IF NOT EXISTS inventory_deductions (
  id TEXT PRIMARY KEY,
  order_reference TEXT NOT NULL,
  dish_name TEXT NOT NULL,
  ingredient_id TEXT NOT NULL REFERENCES raw_ingredients(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity_deducted NUMERIC(12,3) NOT NULL,
  unit TEXT NOT NULL,
  remaining_stock NUMERIC(12,3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- SAFE COLUMN MIGRATION PATCHES (For Existing Live Tables)
-- ====================================================================
-- Run these statements whenever new columns are added to existing live tables.
-- They will NOT delete any data and will safely add new columns if missing.

ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT '';
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'dine_in';

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_comped BOOLEAN DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_modifiers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS special_notes TEXT DEFAULT '';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS guest_name TEXT DEFAULT '';

ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_lbp NUMERIC(15,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS exchange_rate_used INT DEFAULT 89500;

