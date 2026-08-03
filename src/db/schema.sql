-- Skylight Village Neon Postgres DDL Schema Script
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tables (Physical Restaurant Layout)
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number INT UNIQUE NOT NULL,
    qr_code_token TEXT UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'merged', 'bill_requested')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table Sessions (Active Dining Parties)
CREATE TABLE IF NOT EXISTS table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
    merged_table_ids UUID[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 3. Service Calls (Waiter Bell Notifications)
CREATE TABLE IF NOT EXISTS service_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
    table_number INT NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('waiter', 'charcoal', 'bill')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Menu Items & Modifiers
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price_usd DECIMAL(10,2) NOT NULL,
    station VARCHAR(30) NOT NULL CHECK (station IN ('mezza', 'sajj', 'grill', 'subs_sandwiches', 'bar', 'shisha')),
    available BOOLEAN DEFAULT true,
    modifier_groups JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. System Settings (Global USD/LBP Exchange Rate)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);
INSERT INTO system_settings (key, value) VALUES ('exchange_rate', '{"lbp_per_usd": 89500}'::jsonb) ON CONFLICT (key) DO NOTHING;

-- 7. Orders & Order Items
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id),
    item_name TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price_usd DECIMAL(10,2) NOT NULL,
    station VARCHAR(30) NOT NULL CHECK (station IN ('mezza', 'sajj', 'grill', 'subs_sandwiches', 'bar', 'shisha')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
    selected_modifiers JSONB DEFAULT '[]'::jsonb,
    special_notes TEXT,
    is_comped BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Discounts
CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('percentage', 'fixed', 'item_comp')),
    value DECIMAL(10,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Payments & Split Billing
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
    amount_usd DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) CHECK (currency IN ('USD', 'LBP')),
    exchange_rate_used INT NOT NULL DEFAULT 89500,
    payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'card')),
    payment_type VARCHAR(20) CHECK (payment_type IN ('full', 'item_split', 'equal_split', 'partial')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id),
    quantity_paid INT NOT NULL
);
