'use server';

import { pool } from '@/lib/db';

export interface RawIngredient {
  id: string;
  name: string;
  category: string;
  unit: 'kg' | 'g' | 'pcs' | 'liter' | 'ml' | 'pack';
  current_stock: number;
  reorder_level: number;
  cost_per_unit_usd: number;
  updated_at?: string;
}

export interface MenuItemRecipe {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  ingredient_name?: string;
  quantity_required: number;
  unit: string;
  cost_contribution_usd?: number;
}

export interface StockReceivingLog {
  id: string;
  ingredient_id: string;
  ingredient_name?: string;
  quantity_added: number;
  unit_cost_usd: number;
  supplier_name: string;
  notes: string;
  created_at: string;
}

export interface StockWasteLog {
  id: string;
  ingredient_id: string;
  ingredient_name?: string;
  quantity_wasted: number;
  total_cost_usd: number;
  reason: string;
  logged_by: string;
  created_at: string;
}

export interface StockAuditLog {
  id: string;
  ingredient_id: string;
  ingredient_name?: string;
  expected_stock: number;
  actual_stock: number;
  variance: number;
  notes: string;
  created_at: string;
}

export interface StockDeductionLog {
  id: string;
  order_reference: string;
  dish_name: string;
  ingredient_id: string;
  ingredient_name: string;
  quantity_deducted: number;
  unit: string;
  remaining_stock: number;
  created_at: string;
}

/**
  Ensure inventory tables exist and prefill demo data if empty
 */
export async function ensureInventoryTables() {
  if (!pool) return;
  try {
    await pool.query(`
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

      CREATE TABLE IF NOT EXISTS menu_item_recipes (
        id TEXT PRIMARY KEY,
        menu_item_id TEXT NOT NULL,
        ingredient_id TEXT NOT NULL,
        quantity_required NUMERIC(12,3) NOT NULL DEFAULT 0,
        unit TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory_receiving (
        id TEXT PRIMARY KEY,
        ingredient_id TEXT NOT NULL,
        quantity_added NUMERIC(12,3) NOT NULL DEFAULT 0,
        unit_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
        supplier_name TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory_waste (
        id TEXT PRIMARY KEY,
        ingredient_id TEXT NOT NULL,
        quantity_wasted NUMERIC(12,3) NOT NULL DEFAULT 0,
        total_cost_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
        reason TEXT NOT NULL,
        logged_by TEXT DEFAULT 'Staff',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory_audits (
        id TEXT PRIMARY KEY,
        ingredient_id TEXT NOT NULL,
        expected_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
        actual_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
        variance NUMERIC(12,3) NOT NULL DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory_deductions (
        id TEXT PRIMARY KEY,
        order_reference TEXT NOT NULL,
        dish_name TEXT NOT NULL,
        ingredient_id TEXT NOT NULL,
        ingredient_name TEXT NOT NULL,
        quantity_deducted NUMERIC(12,3) NOT NULL,
        unit TEXT NOT NULL,
        remaining_stock NUMERIC(12,3) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await seedAllDishesRecipes();
  } catch (e) {
    console.error('Error in ensureInventoryTables:', e);
  }
}

export async function seedAllDishesRecipes() {
  if (!pool) return;
  try {
    // 1. Ensure raw ingredients exist
    await pool.query(`
      INSERT INTO raw_ingredients (id, name, category, unit, current_stock, reorder_level, cost_per_unit_usd) VALUES
      ('ing-tawook', 'Marinated Chicken Tawook', 'Poultry', 'kg', 45.0, 5.0, 6.00),
      ('ing-kafta', 'Spiced Kafta Meat', 'Meat', 'kg', 35.0, 5.0, 7.50),
      ('ing-lahme', 'Beef Tenderloin Cubes', 'Meat', 'kg', 25.0, 4.0, 12.00),
      ('ing-garlic-mayo', 'Garlic Mayonnaise Dip', 'Sauces', 'g', 10000.0, 1000.0, 0.005),
      ('ing-bread', 'Arabic Lebanese Bread', 'Bakery', 'pcs', 300.0, 50.0, 0.10),
      ('ing-fries', 'Frozen Potato Fries', 'Produce', 'kg', 50.0, 10.0, 2.00),
      ('ing-cheese', 'Akkawi Cheese', 'Dairy', 'g', 15000.0, 2000.0, 0.008),
      ('ing-zaatar', 'Wild Thyme Zaatar Mix', 'Spices', 'g', 5000.0, 500.0, 0.006),
      ('ing-labneh', 'Strained Labneh Yogurt', 'Dairy', 'g', 8000.0, 1000.0, 0.004),
      ('ing-shisha-apple', 'Double Apple Tobacco', 'Shisha', 'g', 3000.0, 300.0, 0.04),
      ('ing-shisha-lemon', 'Lemon Mint Tobacco', 'Shisha', 'g', 3000.0, 300.0, 0.04),
      ('ing-charcoal', 'Shisha Charcoal Coals', 'Shisha', 'pcs', 600.0, 60.0, 0.05),
      ('ing-beer-almaza', 'Almaza Beer 330ml', 'Beverages', 'pcs', 144.0, 24.0, 1.25),
      ('ing-arak-ksara', 'Arak Ksara 750ml Bottle', 'Beverages', 'pcs', 18.0, 3.0, 11.00),
      ('ing-water-sm', 'Small Mineral Water 500ml', 'Beverages', 'pcs', 200.0, 30.0, 0.25),
      ('ing-soft-drink', 'Can Soft Drink', 'Beverages', 'pcs', 150.0, 24.0, 0.50)
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Fetch all menu items
    const menuRes = await pool.query('SELECT id, name, station FROM menu_items');

    for (const item of menuRes.rows) {
      const name = item.name.toLowerCase();
      const st = (item.station || 'mezza').toLowerCase();

      // Check if item already has recipe
      const existing = await pool.query('SELECT COUNT(*) FROM menu_item_recipes WHERE menu_item_id = $1', [item.id]);
      if (parseInt(existing.rows[0].count, 10) > 0) continue;

      const rId = (ingId: string) => `rec-${item.id.slice(0, 8)}-${ingId}-${Math.random().toString(36).substring(2, 5)}`;

      if (name.includes('tawook')) {
        await pool.query(
          `INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity_required, unit) VALUES
           ($1, $2, 'ing-tawook', 0.200, 'kg'),
           ($3, $2, 'ing-garlic-mayo', 30.0, 'g'),
           ($4, $2, 'ing-bread', 1.0, 'pcs'),
           ($5, $2, 'ing-fries', 0.100, 'kg')`,
          [rId('tawook'), item.id, rId('mayo'), rId('bread'), rId('fries')]
        );
      } else if (name.includes('kafta')) {
        await pool.query(
          `INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity_required, unit) VALUES
           ($1, $2, 'ing-kafta', 0.200, 'kg'),
           ($3, $2, 'ing-bread', 2.0, 'pcs'),
           ($4, $2, 'ing-fries', 0.100, 'kg')`,
          [rId('kafta'), item.id, rId('bread'), rId('fries')]
        );
      } else if (name.includes('lahm') || name.includes('grill') || name.includes('bbq')) {
        await pool.query(
          `INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity_required, unit) VALUES
           ($1, $2, 'ing-lahme', 0.220, 'kg'),
           ($3, $2, 'ing-bread', 2.0, 'pcs'),
           ($4, $2, 'ing-fries', 0.150, 'kg')`,
          [rId('lahme'), item.id, rId('bread'), rId('fries')]
        );
      } else if (name.includes('sajj') || st.includes('sajj')) {
        if (name.includes('zaatar')) {
          await pool.query(
            `INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity_required, unit) VALUES
             ($1, $2, 'ing-bread', 1.0, 'pcs'),
             ($3, $2, 'ing-zaatar', 25.0, 'g')`,
            [rId('bread'), item.id, rId('zaatar')]
          );
        } else if (name.includes('labneh')) {
          await pool.query(
            `INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity_required, unit) VALUES
             ($1, $2, 'ing-bread', 1.0, 'pcs'),
             ($3, $2, 'ing-labneh', 80.0, 'g')`,
            [rId('bread'), item.id, rId('labneh')]
          );
        } else {
          await pool.query(
            `INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity_required, unit) VALUES
             ($1, $2, 'ing-bread', 1.0, 'pcs'),
             ($3, $2, 'ing-cheese', 75.0, 'g')`,
            [rId('bread'), item.id, rId('cheese')]
          );
        }
      } else if (name.includes('shisha') || st.includes('shisha')) {
        await pool.query(
          `INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity_required, unit) VALUES
           ($1, $2, 'ing-shisha-apple', 20.0, 'g'),
           ($3, $2, 'ing-charcoal', 3.0, 'pcs')`,
          [rId('apple'), item.id, rId('charcoal')]
        );
      } else if (name.includes('fries') || name.includes('batata')) {
        await pool.query(
          `INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity_required, unit) VALUES
           ($1, $2, 'ing-fries', 0.250, 'kg')`,
          [rId('fries'), item.id]
        );
      } else if (name.includes('beer') || name.includes('almaza')) {
        await pool.query(
          `INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity_required, unit) VALUES
           ($1, $2, 'ing-beer-almaza', 1.0, 'pcs')`,
          [rId('beer'), item.id]
        );
      } else if (name.includes('water')) {
        await pool.query(
          `INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity_required, unit) VALUES
           ($1, $2, 'ing-water-sm', 1.0, 'pcs')`,
          [rId('water'), item.id]
        );
      }
    }
  } catch (e) {
    console.error('Error seeding all dish recipes:', e);
  }
}

/**
  Fetch all inventory data for Admin Dashboard
 */
export async function getInventoryData() {
  await ensureInventoryTables();
  if (!pool) return { success: false, error: 'Database connection failed' };

  try {
    const rawRes = await pool.query(`
      SELECT * FROM raw_ingredients ORDER BY category ASC, name ASC
    `);

    const recipesRes = await pool.query(`
      SELECT r.*, i.name as ingredient_name, i.cost_per_unit_usd
      FROM menu_item_recipes r
      JOIN raw_ingredients i ON r.ingredient_id = i.id
    `);

    const menuItemsRes = await pool.query(`
      SELECT id, name, price_usd, station, available FROM menu_items ORDER BY name ASC
    `);

    const receivingRes = await pool.query(`
      SELECT rec.*, i.name as ingredient_name
      FROM inventory_receiving rec
      JOIN raw_ingredients i ON rec.ingredient_id = i.id
      ORDER BY rec.created_at DESC LIMIT 50
    `);

    const wasteRes = await pool.query(`
      SELECT w.*, i.name as ingredient_name
      FROM inventory_waste w
      JOIN raw_ingredients i ON w.ingredient_id = i.id
      ORDER BY w.created_at DESC LIMIT 50
    `);

    const auditRes = await pool.query(`
      SELECT a.*, i.name as ingredient_name
      FROM inventory_audits a
      JOIN raw_ingredients i ON a.ingredient_id = i.id
      ORDER BY a.created_at DESC LIMIT 50
    `);

    const deductionsRes = await pool.query(`
      SELECT * FROM inventory_deductions ORDER BY created_at DESC LIMIT 100
    `);

    return {
      success: true,
      rawIngredients: rawRes.rows.map((r) => ({
        ...r,
        current_stock: Number(r.current_stock),
        reorder_level: Number(r.reorder_level),
        cost_per_unit_usd: Number(r.cost_per_unit_usd),
      })),
      recipes: recipesRes.rows.map((r) => ({
        ...r,
        quantity_required: Number(r.quantity_required),
        cost_contribution_usd: Number(r.quantity_required) * Number(r.cost_per_unit_usd || 0),
      })),
      menuItems: menuItemsRes.rows.map((m) => ({
        ...m,
        price_usd: Number(m.price_usd),
      })),
      receivingLogs: receivingRes.rows.map((r) => ({
        ...r,
        quantity_added: Number(r.quantity_added),
        unit_cost_usd: Number(r.unit_cost_usd),
      })),
      wasteLogs: wasteRes.rows.map((w) => ({
        ...w,
        quantity_wasted: Number(w.quantity_wasted),
        total_cost_usd: Number(w.total_cost_usd),
      })),
      auditLogs: auditRes.rows.map((a) => ({
        ...a,
        expected_stock: Number(a.expected_stock),
        actual_stock: Number(a.actual_stock),
        variance: Number(a.variance),
      })),
      deductionLogs: deductionsRes.rows.map((d) => ({
        ...d,
        quantity_deducted: Number(d.quantity_deducted),
        remaining_stock: Number(d.remaining_stock),
      })),
    };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to load inventory data' };
  }
}

/**
  Create or update a raw ingredient
 */
export async function saveRawIngredient(data: Partial<RawIngredient>) {
  await ensureInventoryTables();
  if (!pool) return { success: false, error: 'Database error' };

  try {
    const id = data.id || `ing-${Date.now()}`;
    const name = data.name?.trim();
    const category = data.category?.trim() || 'General';
    const unit = data.unit || 'kg';
    const currentStock = Number(data.current_stock || 0);
    const reorderLevel = Number(data.reorder_level || 0);
    const costPerUnit = Number(data.cost_per_unit_usd || 0);

    if (!name) return { success: false, error: 'Ingredient name is required' };

    await pool.query(
      `
      INSERT INTO raw_ingredients (id, name, category, unit, current_stock, reorder_level, cost_per_unit_usd, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        unit = EXCLUDED.unit,
        current_stock = EXCLUDED.current_stock,
        reorder_level = EXCLUDED.reorder_level,
        cost_per_unit_usd = EXCLUDED.cost_per_unit_usd,
        updated_at = NOW()
    `,
      [id, name, category, unit, currentStock, reorderLevel, costPerUnit]
    );

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
  Delete a raw ingredient
 */
export async function deleteRawIngredient(id: string) {
  if (!pool) return { success: false, error: 'Database error' };
  try {
    await pool.query('DELETE FROM raw_ingredients WHERE id = $1', [id]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
  Save or update recipe ingredients for a menu dish
 */
export async function saveMenuItemRecipe(menuItemId: string, ingredients: { ingredient_id: string; quantity_required: number; unit: string }[]) {
  await ensureInventoryTables();
  if (!pool) return { success: false, error: 'Database error' };

  try {
    // Delete existing recipe links for this dish first
    await pool.query('DELETE FROM menu_item_recipes WHERE menu_item_id = $1', [menuItemId]);

    // Insert new portion recipe links
    for (const ing of ingredients) {
      if (ing.quantity_required > 0) {
        await pool.query(
          `
          INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity_required, unit)
          VALUES ($1, $2, $3, $4, $5)
        `,
          [`rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, menuItemId, ing.ingredient_id, ing.quantity_required, ing.unit]
        );
      }
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
  Record Supplier Stock Receiving (Stock-In)
 */
export async function recordStockReceiving(data: { ingredientId: string; quantityAdded: number; unitCostUsd: number; supplierName?: string; notes?: string }) {
  await ensureInventoryTables();
  if (!pool) return { success: false, error: 'Database error' };

  try {
    const recId = `rec-in-${Date.now()}`;
    const qty = Number(data.quantityAdded);
    const cost = Number(data.unitCostUsd);

    if (qty <= 0) return { success: false, error: 'Quantity must be greater than 0' };

    // 1. Log receiving entry
    await pool.query(
      `
      INSERT INTO inventory_receiving (id, ingredient_id, quantity_added, unit_cost_usd, supplier_name, notes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
      [recId, data.ingredientId, qty, cost, data.supplierName?.trim() || '', data.notes?.trim() || '']
    );

    // 2. Increase stock & weighted average cost calculation
    await pool.query(
      `
      UPDATE raw_ingredients
      SET 
        current_stock = current_stock + $1,
        cost_per_unit_usd = CASE WHEN $2 > 0 THEN $2 ELSE cost_per_unit_usd END,
        updated_at = NOW()
      WHERE id = $3
    `,
      [qty, cost, data.ingredientId]
    );

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
  Record Kitchen Waste & Spoilage
 */
export async function recordStockWaste(data: { ingredientId: string; quantityWasted: number; reason: string; loggedBy?: string }) {
  await ensureInventoryTables();
  if (!pool) return { success: false, error: 'Database error' };

  try {
    const wasteId = `wst-${Date.now()}`;
    const qty = Number(data.quantityWasted);

    if (qty <= 0) return { success: false, error: 'Quantity must be greater than 0' };

    // Get current unit cost
    const ingRes = await pool.query('SELECT cost_per_unit_usd FROM raw_ingredients WHERE id = $1', [data.ingredientId]);
    const unitCost = ingRes.rows.length > 0 ? Number(ingRes.rows[0].cost_per_unit_usd) : 0;
    const totalCost = qty * unitCost;

    // 1. Log waste entry
    await pool.query(
      `
      INSERT INTO inventory_waste (id, ingredient_id, quantity_wasted, total_cost_usd, reason, logged_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
      [wasteId, data.ingredientId, qty, totalCost, data.reason.trim(), data.loggedBy?.trim() || 'Staff']
    );

    // 2. Decrement raw stock
    await pool.query(
      `
      UPDATE raw_ingredients
      SET current_stock = GREATEST(0, current_stock - $1), updated_at = NOW()
      WHERE id = $2
    `,
      [qty, data.ingredientId]
    );

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
  Record Physical Stock Variance Audit Count
 */
export async function recordStockAudit(data: { ingredientId: string; actualStock: number; notes?: string }) {
  await ensureInventoryTables();
  if (!pool) return { success: false, error: 'Database error' };

  try {
    const auditId = `aud-${Date.now()}`;
    const actual = Number(data.actualStock);

    // Get expected stock
    const ingRes = await pool.query('SELECT current_stock FROM raw_ingredients WHERE id = $1', [data.ingredientId]);
    if (ingRes.rows.length === 0) return { success: false, error: 'Ingredient not found' };

    const expected = Number(ingRes.rows[0].current_stock);
    const variance = actual - expected;

    // 1. Log audit entry
    await pool.query(
      `
      INSERT INTO inventory_audits (id, ingredient_id, expected_stock, actual_stock, variance, notes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
      [auditId, data.ingredientId, expected, actual, variance, data.notes?.trim() || '']
    );

    // 2. Adjust raw stock to actual count
    await pool.query(
      `
      UPDATE raw_ingredients
      SET current_stock = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [actual, data.ingredientId]
    );

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
  Automatically deduct raw ingredient stock when dishes are ordered/paid!
  Checks if ingredients drop below 0 and automatically locks menu items as unavailable.
 */
export async function deductRecipeStockForItems(
  items: { menuItemId: string; quantity: number }[],
  orderReference: string = 'Order Sale'
) {
  if (!pool || !items || items.length === 0) return;

  try {
    for (const item of items) {
      // Get dish name
      const dishRes = await pool.query('SELECT name FROM menu_items WHERE id = $1', [item.menuItemId]);
      const dishName = dishRes.rows.length > 0 ? dishRes.rows[0].name : 'Dish';

      const recipesRes = await pool.query(
        `SELECT r.*, i.name as ingredient_name
         FROM menu_item_recipes r
         JOIN raw_ingredients i ON r.ingredient_id = i.id
         WHERE r.menu_item_id = $1`,
        [item.menuItemId]
      );
      
      for (const recipe of recipesRes.rows) {
        const totalDeduct = Number(recipe.quantity_required) * item.quantity;
        
        if (totalDeduct > 0) {
          // Decrement raw stock
          const updateRes = await pool.query(
            `
            UPDATE raw_ingredients
            SET current_stock = GREATEST(0, current_stock - $1), updated_at = NOW()
            WHERE id = $2
            RETURNING current_stock, reorder_level
          `,
            [totalDeduct, recipe.ingredient_id]
          );

          const remaining = updateRes.rows.length > 0 ? Number(updateRes.rows[0].current_stock) : 0;

          // Log sales deduction entry
          await pool.query(
            `
            INSERT INTO inventory_deductions (id, order_reference, dish_name, ingredient_id, ingredient_name, quantity_deducted, unit, remaining_stock, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `,
            [
              `ded-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              orderReference,
              `${item.quantity}x ${dishName}`,
              recipe.ingredient_id,
              recipe.ingredient_name || 'Ingredient',
              totalDeduct,
              recipe.unit,
              remaining,
            ]
          );

          // If ingredient is completely out of stock (0), auto-lock linked menu items as unavailable
          if (remaining <= 0) {
            await pool.query(`
              UPDATE menu_items SET available = false 
              WHERE id IN (SELECT menu_item_id FROM menu_item_recipes WHERE ingredient_id = $1)
            `, [recipe.ingredient_id]);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error deducting recipe stock for order:', e);
  }
}

/**
  Restock raw ingredient inventory when an ordered item is cancelled/voided!
 */
export async function restockRecipeStockForItems(
  items: { menuItemId: string; quantity: number }[],
  orderReference: string = 'Cancelled Item Restock'
) {
  if (!pool || !items || items.length === 0) return;

  try {
    for (const item of items) {
      const dishRes = await pool.query('SELECT name FROM menu_items WHERE id = $1', [item.menuItemId]);
      const dishName = dishRes.rows.length > 0 ? dishRes.rows[0].name : 'Dish';

      const recipesRes = await pool.query(
        `SELECT r.*, i.name as ingredient_name
         FROM menu_item_recipes r
         JOIN raw_ingredients i ON r.ingredient_id = i.id
         WHERE r.menu_item_id = $1`,
        [item.menuItemId]
      );

      for (const recipe of recipesRes.rows) {
        const totalRestock = Number(recipe.quantity_required) * item.quantity;

        if (totalRestock > 0) {
          // Increment raw stock
          const updateRes = await pool.query(
            `
            UPDATE raw_ingredients
            SET current_stock = current_stock + $1, updated_at = NOW()
            WHERE id = $2
            RETURNING current_stock
          `,
            [totalRestock, recipe.ingredient_id]
          );

          const newStock = updateRes.rows.length > 0 ? Number(updateRes.rows[0].current_stock) : 0;

          // Log restock entry into inventory_deductions as +restock
          await pool.query(
            `
            INSERT INTO inventory_deductions (id, order_reference, dish_name, ingredient_id, ingredient_name, quantity_deducted, unit, remaining_stock, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `,
            [
              `rst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              `↺ RESTOCK: ${orderReference}`,
              `${item.quantity}x ${dishName}`,
              recipe.ingredient_id,
              recipe.ingredient_name || 'Ingredient',
              -totalRestock, // Negative deduction = RESTOCK +
              recipe.unit,
              newStock,
            ]
          );

          // Re-enable linked menu items if stock is now > 0
          if (newStock > 0) {
            await pool.query(
              `UPDATE menu_items SET available = true WHERE id IN (SELECT menu_item_id FROM menu_item_recipes WHERE ingredient_id = $1)`,
              [recipe.ingredient_id]
            );
          }
        }
      }
    }
  } catch (e) {
    console.error('Error restocking recipe stock for cancelled item:', e);
  }
}
