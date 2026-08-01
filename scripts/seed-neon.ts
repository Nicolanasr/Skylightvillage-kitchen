import { Pool } from '@neondatabase/serverless';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_DLVl7ha8TzfK@ep-noisy-recipe-as18ihl7-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require';

async function seedNeonDatabase() {
  console.log('🔌 Connecting to Neon Postgres Database...');
  const pool = new Pool({ connectionString });

  try {
    console.log('📦 Executing database DDL schema creation...');

    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS tables (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          table_number INT UNIQUE NOT NULL,
          qr_code_token TEXT UNIQUE NOT NULL,
          status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'merged', 'bill_requested')),
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS table_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          primary_table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
          merged_table_ids UUID[] DEFAULT '{}',
          status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed')),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          closed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS service_calls (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
          table_number INT NOT NULL,
          type VARCHAR(30) NOT NULL CHECK (type IN ('waiter', 'charcoal', 'bill')),
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS menu_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS menu_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          description TEXT,
          price_usd DECIMAL(10,2) NOT NULL,
          image_url TEXT,
          station VARCHAR(30) NOT NULL CHECK (station IN ('cold_mezza', 'hot_mezza', 'grill', 'bar', 'shisha')),
          available BOOLEAN DEFAULT true,
          is_staff_only BOOLEAN DEFAULT false,
          modifier_groups JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_staff_only BOOLEAN DEFAULT false;

      CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
          session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
          table_number INT NOT NULL DEFAULT 1,
          seat_number INT NOT NULL DEFAULT 1,
          guest_name TEXT,
          menu_item_id UUID REFERENCES menu_items(id),
          item_name TEXT NOT NULL,
          quantity INT NOT NULL DEFAULT 1,
          unit_price_usd DECIMAL(10,2) NOT NULL,
          station VARCHAR(30) NOT NULL CHECK (station IN ('cold_mezza', 'hot_mezza', 'grill', 'bar', 'shisha')),
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
          selected_modifiers JSONB DEFAULT '[]'::jsonb,
          special_notes TEXT,
          is_comped BOOLEAN DEFAULT false,
          is_paid BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS table_number INT DEFAULT 1;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS seat_number INT DEFAULT 1;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS guest_name TEXT;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;

      CREATE TABLE IF NOT EXISTS discounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
          type VARCHAR(20) CHECK (type IN ('percentage', 'fixed', 'item_comp')),
          value DECIMAL(10,2) NOT NULL,
          reason TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

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
    `);

    console.log('✅ Schema created/updated with guest_name on order_items.');

    await pool.end();
    console.log('🎉 Neon database migration completed!');
  } catch (err) {
    console.error('❌ Neon database error:', err);
    process.exit(1);
  }
}

seedNeonDatabase();
