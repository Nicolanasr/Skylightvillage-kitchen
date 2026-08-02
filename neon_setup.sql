-- =========================================================
-- SKYLIGHT VILLAGE RESTAURANT - NEON POSTGRES DATABASE SETUP (FIXED)
-- Copy and paste this entire script into your Neon Console SQL Editor
-- =========================================================

-- 1. DROP EXISTING CONFLICTING MENU TABLES IF ID WAS UUID
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS menu_categories CASCADE;

-- 2. CREATE MENU TABLES WITH TEXT IDs (ALLOWS 'cat-cold', 'm-hummus', etc.)
CREATE TABLE menu_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  station TEXT NOT NULL DEFAULT 'cold_mezza',
  available BOOLEAN DEFAULT true,
  image_url TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. OTHER TABLES SETUP
CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  table_number INT NOT NULL UNIQUE,
  qr_code_token TEXT NOT NULL,
  status TEXT DEFAULT 'available',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS table_sessions (
  id TEXT PRIMARY KEY,
  primary_table_id TEXT NOT NULL,
  merged_table_ids JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  table_number INT NOT NULL,
  menu_item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  station TEXT NOT NULL DEFAULT 'cold_mezza',
  status TEXT NOT NULL DEFAULT 'pending',
  guest_name TEXT DEFAULT '',
  special_notes TEXT DEFAULT '',
  selected_modifiers JSONB DEFAULT '[]'::jsonb,
  is_comped BOOLEAN DEFAULT false,
  is_paid BOOLEAN DEFAULT false,
  is_printed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  amount_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  amount_lbp NUMERIC(15, 2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  staff_name TEXT NOT NULL,
  staff_role TEXT NOT NULL,
  action TEXT NOT NULL,
  table_number INT,
  details TEXT DEFAULT '',
  timestamp TIMESTAMP DEFAULT NOW()
);

-- 4. POPULATE MENU CATEGORIES
INSERT INTO menu_categories (id, name, sort_order) VALUES
  ('cat-cold', 'Cold Mezza', 1),
  ('cat-hot', 'Hot Mezza', 2),
  ('cat-salads', 'Salads', 3),
  ('cat-sajj', 'Fresh From The Sajj', 4),
  ('cat-bbq', 'BBQ Platters', 5),
  ('cat-subs', 'Subs & Sandwiches', 6),
  ('cat-kids', 'Kids Meals', 7),
  ('cat-cold-bev', 'Cold Refreshments', 8),
  ('cat-hot-bev', 'Hot Drinks', 9),
  ('cat-spirits', 'Spirits & Alcohol', 10),
  ('cat-shisha', 'Shisha Lounge', 11)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- 5. POPULATE ALL 45 SKYLIGHT VILLAGE MENU ITEMS
INSERT INTO menu_items (id, category_id, name, description, price_usd, station, available, image_url) VALUES
  -- COLD MEZZA
  ('m-labneh', 'cat-cold', 'Labneh', 'Traditional Lebanese strained yogurt with olive oil', 4.00, 'cold_mezza', true, ''),
  ('m-labneh-toum', 'cat-cold', 'Labneh b Toum', 'Strained yogurt mixed with garlic & mint', 4.50, 'cold_mezza', true, ''),
  ('m-hummus', 'cat-cold', 'Hummus', 'Chickpea puree with tahini, lemon & olive oil', 5.00, 'cold_mezza', true, ''),
  ('m-moutabal', 'cat-cold', 'Moutabal', 'Smoked eggplant dip with tahini & pomegranate', 5.50, 'cold_mezza', true, ''),
  ('m-shanklish', 'cat-cold', 'Shanklish', 'Aged cheese with diced tomato, onion & olive oil', 6.00, 'cold_mezza', true, ''),
  ('m-kabiss', 'cat-cold', 'Kabiss Platter', 'Assorted Lebanese pickles & olives', 4.00, 'cold_mezza', true, ''),
  ('m-veg-platter', 'cat-cold', 'Vegetable Platter', 'Fresh mint, cucumber, tomato & radish', 5.00, 'cold_mezza', true, ''),

  -- HOT MEZZA
  ('m-fries', 'cat-hot', 'French Fries', 'Crispy golden potato fries', 4.00, 'hot_mezza', true, ''),
  ('m-batata-harra', 'cat-hot', 'Batata Harra', 'Spicy fried potato cubes with coriander & garlic', 6.00, 'hot_mezza', true, ''),
  ('m-mouajjanet', 'cat-hot', 'Mixed Mouajjanet', '2 Kebbeh, 2 Sambousik, 2 Rkakat Cheese', 9.00, 'hot_mezza', true, ''),
  ('m-makanek', 'cat-hot', 'Makanek', 'Sauteed mini sausages with pomegranate molasses', 8.00, 'hot_mezza', true, ''),
  ('m-soujouk', 'cat-hot', 'Soujouk', 'Spicy Armenian sausages cooked with tomato & garlic', 8.00, 'hot_mezza', true, ''),

  -- SALADS
  ('m-fattoush', 'cat-salads', 'Fattoush', 'Garden greens, radish, sumac dressing & pita chips', 7.00, 'cold_mezza', true, ''),
  ('m-tabbouleh', 'cat-salads', 'Tabbouleh', 'Finely chopped parsley, mint, tomato & bulgur', 7.00, 'cold_mezza', true, ''),

  -- FRESH FROM THE SAJJ
  ('m-sajj-zaatar', 'cat-sajj', 'Zaatar', 'Wild thyme & sesame sajj wrap', 2.50, 'hot_mezza', true, ''),
  ('m-sajj-jebneh', 'cat-sajj', 'Jebneh', 'Melted Akkawi cheese sajj wrap', 4.00, 'hot_mezza', true, ''),
  ('m-sajj-labneh', 'cat-sajj', 'Labneh', 'Fresh labneh with olive oil & mint', 3.50, 'hot_mezza', true, ''),
  ('m-sajj-zl', 'cat-sajj', 'Zaatar & Labneh', 'Half wild thyme & half creamy labneh', 4.00, 'hot_mezza', true, ''),
  ('m-sajj-cocktail', 'cat-sajj', 'Cocktail', 'Mix of cheese & wild thyme', 5.00, 'hot_mezza', true, ''),
  ('m-sajj-jebne-jambon', 'cat-sajj', 'Jebne w Jambon', 'Melted cheese with turkey ham', 6.00, 'hot_mezza', true, ''),
  ('m-sajj-jebne-soujouk', 'cat-sajj', 'Jebne w Soujouk', 'Melted cheese with spicy soujouk', 6.00, 'hot_mezza', true, ''),
  ('m-sajj-jebne-kafta', 'cat-sajj', 'Jebne w Kafta', 'Melted cheese with spiced kafta', 7.00, 'hot_mezza', true, ''),
  ('m-sajj-lahm', 'cat-sajj', 'Lahm Bi Ajeen', 'Minced spiced meat with onion & tomato', 7.00, 'hot_mezza', true, ''),
  ('m-sajj-pizza', 'cat-sajj', 'Lebanese Pizza', 'Lebanese style sajj pizza with cheese & veg', 8.00, 'hot_mezza', true, ''),
  ('m-sajj-chocobas', 'cat-sajj', 'Chocobas', 'Nutella chocolate & banana sweet sajj', 6.00, 'hot_mezza', true, ''),
  ('m-sajj-zebde', 'cat-sajj', 'Zebde & Sekkar', 'Traditional butter & sugar sweet sajj', 4.00, 'hot_mezza', true, ''),

  -- BBQ PLATTERS
  ('m-tawook-platter', 'cat-bbq', 'Tawook Platter', '2 chicken skewers served with fries, coleslaw, garlic dip & pickles', 14.00, 'grill', true, ''),
  ('m-kafta-platter', 'cat-bbq', 'Kafta Platter', '2 kafta skewers served with fries, hummus, biwaz salad & chili bread', 14.00, 'grill', true, ''),
  ('m-lahme-platter', 'cat-bbq', 'Lahme Platter', '2 meat skewers served with fries, hummus, biwaz salad, grilled onion & chili bread', 17.00, 'grill', true, ''),
  ('m-mixed-grill', 'cat-bbq', 'Mixed Grill Platter', '2 Tawook, 2 Kafta, 1 Lahme served with fries, garlic dip, biwaz salad & chili bread', 22.00, 'grill', true, ''),

  -- SUBS & SANDWICHES
  ('m-sub-chicken', 'cat-subs', 'Chicken Sub', 'Served with a side of French Fries', 9.00, 'hot_mezza', true, ''),
  ('m-sub-submarine', 'cat-subs', 'Submarine', 'Served with a side of French Fries', 9.00, 'hot_mezza', true, ''),
  ('m-sub-fajita', 'cat-subs', 'Chicken Fajita', 'Served with a side of French Fries', 10.00, 'hot_mezza', true, ''),

  -- KIDS MEALS
  ('m-kids-burger', 'cat-kids', 'Classic Kids Burger', 'Served with French Fries & Juice', 7.50, 'hot_mezza', true, ''),
  ('m-kids-nuggets', 'cat-kids', 'Chicken Nuggets', 'Served with French Fries & Juice', 7.50, 'hot_mezza', true, ''),

  -- COLD REFRESHMENTS
  ('m-bev-water-sm', 'cat-cold-bev', 'Small Mineral Water', '500ml chilled mineral water', 1.00, 'bar', true, ''),
  ('m-bev-water-lg', 'cat-cold-bev', 'Large Mineral Water', '1.5L chilled mineral water', 2.00, 'bar', true, ''),
  ('m-bev-soft', 'cat-cold-bev', 'Soft Drinks', 'Pepsi, 7Up, Mirinda', 2.00, 'bar', true, ''),
  ('m-bev-energy', 'cat-cold-bev', 'Energy Drinks', 'RedBull Energy Drink', 4.00, 'bar', true, ''),
  ('m-bev-juice', 'cat-cold-bev', 'Fruit Juice', 'Fresh seasonal fruit juice', 3.00, 'bar', true, ''),

  -- HOT DRINKS
  ('m-bev-turkish', 'cat-hot-bev', 'Turkish Coffee', 'Traditional Lebanese cardammon coffee', 2.00, 'bar', true, ''),
  ('m-bev-american', 'cat-hot-bev', 'American Coffee', 'Freshly brewed black coffee', 3.00, 'bar', true, ''),
  ('m-bev-nescafe', 'cat-hot-bev', 'Nescafe (3in1 / 2in1)', 'Instant rich coffee mix', 2.50, 'bar', true, ''),
  ('m-bev-tea', 'cat-hot-bev', 'Tea', 'Red black tea or mint tea', 2.00, 'bar', true, ''),

  -- SPIRITS & ALCOHOL
  ('m-sp-arak', 'cat-spirits', 'Arak (Glass / Bottle)', 'Traditional Lebanese Ksara / Brun Arak', 6.00, 'bar', true, ''),
  ('m-sp-whiskey', 'cat-spirits', 'Whiskey (Glass / Bottle)', 'Premium Scotch / Bourbon Whiskey', 8.00, 'bar', true, ''),
  ('m-sp-vodka', 'cat-spirits', 'Vodka (Glass / Bottle)', 'Imported premium vodka', 8.00, 'bar', true, ''),
  ('m-sp-gin', 'cat-spirits', 'Gin (Glass / Bottle)', 'London dry gin with tonic', 8.00, 'bar', true, ''),
  ('m-sp-wine', 'cat-spirits', 'Wine (Glass / Bottle)', 'Chateau Ksara Red / White / Rose Wine', 7.00, 'bar', true, ''),

  -- SHISHA
  ('m-sh-apple', 'cat-shisha', 'Double Apple (Two Apples)', 'Classic Al-Fakher Double Apple Shisha', 7.00, 'shisha', true, ''),
  ('m-sh-lemon-mint', 'cat-shisha', 'Lemon & Mint', 'Refreshing fresh lemon mint shisha', 7.00, 'shisha', true, ''),
  ('m-sh-love', 'cat-shisha', 'Love', 'Signature sweet fruity passionfruit shisha', 8.00, 'shisha', true, '')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_usd = EXCLUDED.price_usd,
  station = EXCLUDED.station,
  available = EXCLUDED.available;
