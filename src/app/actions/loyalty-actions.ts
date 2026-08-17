'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { resolveOrUpsertCustomer } from './crm-actions';
import { normalizePhone, getPhoneLookupVariations } from '@/lib/phone';

export interface CustomerLoyalty {
  id: string;
  phone_number?: string;
  vip_code?: string;
  customer_name: string;
  points_balance: number;
  total_spent_usd: number;
  total_visits: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyRewardTier {
  id: string;
  name: string;
  points_required: number;
  reward_type: 'free_item' | 'discount_usd';
  discount_value: number;
  menu_item_id?: string;
  active: boolean;
  created_at: string;
}

export interface LoyaltyClaimToken {
  token: string;
  session_id: string;
  points_value: number;
  claimed: boolean;
  claimed_by_phone?: string;
  created_at: string;
  expires_at: string;
}

export interface LoyaltyAuditLog {
  id: string;
  customer_phone?: string;
  action_type: string;
  points_amount: number;
  session_id?: string;
  reward_name?: string;
  logged_by?: string;
  notes?: string;
  created_at: string;
}

/**
 * Ensure database tables exist safely
 */
async function ensureLoyaltyTables() {
  return;
}

/**
 * Seed Default Reward Tiers if empty
 */
export async function seedDefaultRewardTiers() {
  if (!pool) return;
  await ensureLoyaltyTables();

  try {
    // await pool.query(`
    //   INSERT INTO loyalty_reward_tiers (id, name, points_required, reward_type, discount_value, active) VALUES
    //   ('tier-5-off', '$5 Off Total Bill', 50, 'discount_usd', 5.00, true),
    //   ('tier-10-off', '$10 Off Total Bill', 100, 'discount_usd', 10.00, true),
    //   ('tier-20-off', '$20 Off Total Bill', 200, 'discount_usd', 20.00, true)
    //   ON CONFLICT (id) DO UPDATE SET
    //     name = EXCLUDED.name,
    //     reward_type = EXCLUDED.reward_type,
    //     discount_value = EXCLUDED.discount_value,
    //     points_required = EXCLUDED.points_required;
    // `);

    // Migrate any legacy database records from free_item to discount_usd
    await pool.query(`
      UPDATE loyalty_reward_tiers SET reward_type = 'discount_usd' WHERE reward_type = 'free_item';
    `);
  } catch (e) {
    console.error('Error seeding default reward tiers:', e);
  }
}

/**
 * Fetch all loyalty data for admin dashboard & POS lookup
 */
let loyaltyDataCache: { timestamp: number; data: any } | null = null;

export async function invalidateLoyaltyCache() {
  loyaltyDataCache = null;
}

export async function getLoyaltyData() {
  if (!pool) {
    return {
      success: false,
      customers: [],
      rewardTiers: [],
      claimTokens: [],
      auditLogs: [],
      menuItems: [],
    };
  }

  const now = Date.now();
  if (loyaltyDataCache && (now - loyaltyDataCache.timestamp < 10000)) {
    return loyaltyDataCache.data;
  }

  await ensureLoyaltyTables();

  try {
    const [custRes, tierRes, tokenRes, auditRes, menuRes] = await Promise.all([
      pool.query('SELECT * FROM customer_loyalty ORDER BY total_spent_usd DESC LIMIT 300'),
      pool.query('SELECT * FROM loyalty_reward_tiers ORDER BY points_required ASC'),
      pool.query('SELECT * FROM loyalty_claim_tokens ORDER BY created_at DESC LIMIT 100'),
      pool.query('SELECT * FROM loyalty_audit_logs ORDER BY created_at DESC LIMIT 200'),
      pool.query('SELECT * FROM menu_items ORDER BY name ASC'),
    ]);

    const custRows = custRes.rows;
    const tierRows = tierRes.rows;
    const tokenRows = tokenRes.rows;
    const auditRows = auditRes.rows;
    const menuRows = menuRes.rows;

    const data = {
      success: true,
      customers: custRows.map((c: any) => ({
        ...c,
        points_balance: Number(c.points_balance || 0),
        total_spent_usd: Number(c.total_spent_usd || 0),
        total_visits: Number(c.total_visits || 1),
      })) as CustomerLoyalty[],
      rewardTiers: tierRows.map((t: any) => ({
        ...t,
        points_required: Number(t.points_required || 0),
        discount_value: Number(t.discount_value || 0),
      })) as LoyaltyRewardTier[],
      claimTokens: tokenRows.map((tk: any) => ({
        ...tk,
        points_value: Number(tk.points_value || 0),
      })) as LoyaltyClaimToken[],
      auditLogs: auditRows.map((a: any) => ({
        ...a,
        points_amount: Number(a.points_amount || 0),
      })) as LoyaltyAuditLog[],
      menuItems: menuRows,
    };

    loyaltyDataCache = { timestamp: Date.now(), data };
    return data;
  } catch (e) {
    console.error('Error fetching loyalty data:', e);
    return {
      success: false,
      error: 'Failed to fetch loyalty data',
      customers: [],
      rewardTiers: [],
      claimTokens: [],
      auditLogs: [],
      menuItems: [],
    };
  }
}

/**
 * Lookup or Auto-Create Customer Profile by Phone Number & fetch eligible rewards
 */
export async function lookupOrCreateCustomerLoyalty(phoneNumber: string, customerName = 'Valued Guest') {
  if (!pool || !phoneNumber || !phoneNumber.trim()) return { success: false, customer: null, rewardTiers: [] };
  await ensureLoyaltyTables();
  await seedDefaultRewardTiers();

  const canonicalPhone = normalizePhone(phoneNumber) || phoneNumber.trim();
  const variations = getPhoneLookupVariations(phoneNumber);
  if (variations.length === 0) variations.push(phoneNumber.trim());
  const cleanName = customerName.trim() || 'Valued Guest';

  try {
    // Also sync with Master CRM customers table
    await resolveOrUpsertCustomer({ phone: canonicalPhone, name: cleanName }).catch(() => {});
    const tierRes = await pool.query('SELECT * FROM loyalty_reward_tiers WHERE active = true ORDER BY points_required ASC');
    const rewardTiers = tierRes.rows.map((t) => ({
      ...t,
      points_required: Number(t.points_required || 0),
      discount_value: Number(t.discount_value || 0),
    })) as LoyaltyRewardTier[];

    const res = await pool.query(
      'SELECT * FROM customer_loyalty WHERE phone_number = ANY($1::text[]) OR vip_code = $2 OR id = $2 LIMIT 1',
      [variations, phoneNumber.trim()]
    );

    let customer: CustomerLoyalty;

    if (res.rows.length > 0) {
      const c = res.rows[0];
      customer = {
        ...c,
        points_balance: Number(c.points_balance || 0),
        total_spent_usd: Number(c.total_spent_usd || 0),
        total_visits: Number(c.total_visits || 1),
      } as CustomerLoyalty;
    } else {
      // Auto-create new customer profile!
      const newId = randomUUID();
      const insertRes = await pool.query(
        `INSERT INTO customer_loyalty (id, phone_number, customer_name, points_balance, total_spent_usd, total_visits)
         VALUES ($1, $2, $3, 0, 0, 1)
         ON CONFLICT (phone_number) DO UPDATE SET customer_name = EXCLUDED.customer_name
         RETURNING *`,
        [newId, canonicalPhone, cleanName]
      );
      const c = insertRes.rows[0];
      customer = {
        ...c,
        points_balance: 0,
        total_spent_usd: 0,
        total_visits: 1,
      } as CustomerLoyalty;
    }

    return {
      success: true,
      customer,
      rewardTiers,
    };
  } catch (e) {
    console.error('Error in lookupOrCreateCustomerLoyalty:', e);
    return { success: false, customer: null, rewardTiers: [] };
  }
}

/**
 * Legacy lookup Customer Profile by Phone Number or VIP Code
 */
export async function lookupCustomerLoyalty(query: string) {
  return lookupOrCreateCustomerLoyalty(query);
}

/**
 * Award Loyalty Points ($1 spent = 1 Point) or Generate Receipt Claim Token if Phone Empty
 */
/**
 * Award loyalty points for a closed session.
 * Handles BOTH per-item phone assignments AND session-level fallback phone.
 * Multiple customers at the same table each earn points independently.
 */
export async function awardLoyaltyPointsForSession(
  sessionId: string,
  amountUsd: number,
  sessionPhone?: string,
  sessionName?: string
) {
  if (!pool) return { success: false };
  await ensureLoyaltyTables();

  const isEnabled = await getLoyaltyEnabledSetting();
  if (!isEnabled) return { success: true, pointsEarned: 0, disabled: true };

  try {
    // 1. Fetch all non-cancelled, non-comped items for this session with their per-item loyalty_phone
    const itemsRes = await pool.query(
      `SELECT loyalty_phone, unit_price_usd * quantity AS line_total
       FROM order_items
       WHERE session_id = $1 AND status != 'cancelled' AND is_comped = false`,
      [sessionId]
    );

    // 2. Build a spend map: phone -> total_usd_spent
    const phoneSpendMap = new Map<string, number>();

    for (const row of itemsRes.rows) {
      const phone = row.loyalty_phone?.trim() || null;
      if (phone) {
        phoneSpendMap.set(phone, (phoneSpendMap.get(phone) || 0) + Number(row.line_total || 0));
      }
    }

    // 3. If a session-level phone is set and no item was assigned to it, award them the full session amount
    //    (only if phoneSpendMap is empty — i.e. waiter used session-level assignment, not per-item)
    const hasItemLevelAssignments = phoneSpendMap.size > 0;
    if (!hasItemLevelAssignments && sessionPhone?.trim()) {
      phoneSpendMap.set(sessionPhone.trim(), amountUsd);
    }

    if (phoneSpendMap.size === 0) {
      return { success: true, pointsEarned: 0 }; // No loyalty phones assigned
    }

    // 4. Award points to each unique phone
    let totalPointsAwarded = 0;

    for (const [phone, spentUsd] of phoneSpendMap.entries()) {
      if (spentUsd <= 0) continue;
      const pts = Math.floor(spentUsd); // 1 USD = 1 point

      const existingRes = await pool.query(
        'SELECT * FROM customer_loyalty WHERE phone_number = $1 LIMIT 1',
        [phone]
      );

      let customerId = '';
      const isNew = existingRes.rows.length === 0;
      if (!isNew) {
        customerId = existingRes.rows[0].id;
        await pool.query(
          `UPDATE customer_loyalty
           SET points_balance = points_balance + $1,
               total_spent_usd = total_spent_usd + $2,
               total_visits = total_visits + 1,
               updated_at = NOW()
           WHERE id = $3`,
          [pts, spentUsd, customerId]
        );
      } else {
        customerId = randomUUID();
        const name = phone === sessionPhone?.trim() ? (sessionName?.trim() || 'Valued Guest') : 'Valued Guest';
        await pool.query(
          `INSERT INTO customer_loyalty (id, phone_number, customer_name, points_balance, total_spent_usd, total_visits)
           VALUES ($1, $2, $3, $4, $5, 1)`,
          [customerId, phone, name, pts, spentUsd]
        );
      }

      // Audit log per person
      await pool.query(
        `INSERT INTO loyalty_audit_logs (id, customer_phone, action_type, points_amount, session_id, logged_by, notes)
         VALUES ($1, $2, 'earned', $3, $4, 'System', $5)`,
        [
          `aud-${Date.now()}-${phone.replace(/\s/g, '')}`,
          phone,
          pts,
          sessionId,
          `Earned ${pts} pts from $${spentUsd.toFixed(2)} spend at table session ${sessionId}`,
        ]
      );

      totalPointsAwarded += pts;
    }

    revalidatePath('/admin');
    return { success: true, pointsEarned: totalPointsAwarded };
  } catch (e) {
    console.error('Error awarding loyalty points:', e);
    return { success: false };
  }
}

/**
 * Claim Points from Receipt QR Code Token on Customer Mobile Phone
 */
export async function claimReceiptPointsAction(claimToken: string, customerPhone: string, customerName?: string) {
  if (!pool || !claimToken || !customerPhone) return { success: false, error: 'Token and Phone Number are required' };
  await ensureLoyaltyTables();

  const cleanToken = claimToken.trim();
  const cleanPhone = customerPhone.trim();
  const name = customerName?.trim() || 'Valued Guest';

  try {
    const tokenRes = await pool.query('SELECT * FROM loyalty_claim_tokens WHERE token = $1 LIMIT 1', [cleanToken]);
    if (tokenRes.rows.length === 0) return { success: false, error: 'Invalid or expired claim token' };

    const tok = tokenRes.rows[0];
    if (tok.claimed) return { success: false, error: `This token has already been claimed by ${tok.claimed_by_phone || 'another user'}.` };

    const pointsValue = Number(tok.points_value || 0);

    // Update Token
    await pool.query('UPDATE loyalty_claim_tokens SET claimed = true, claimed_by_phone = $1 WHERE token = $2', [cleanPhone, cleanToken]);

    // Add Points to Profile
    const existingRes = await pool.query('SELECT * FROM customer_loyalty WHERE phone_number = $1', [cleanPhone]);
    let customerId = '';
    if (existingRes.rows.length > 0) {
      customerId = existingRes.rows[0].id;
      await pool.query(
        `UPDATE customer_loyalty SET points_balance = points_balance + $1, updated_at = NOW() WHERE id = $2`,
        [pointsValue, customerId]
      );
    } else {
      customerId = randomUUID();
      await pool.query(
        `INSERT INTO customer_loyalty (id, phone_number, customer_name, points_balance, total_spent_usd, total_visits)
         VALUES ($1, $2, $3, $4, 0, 1)`,
        [customerId, cleanPhone, name, pointsValue]
      );
    }

    // Log Audit
    await pool.query(
      `INSERT INTO loyalty_audit_logs (id, customer_phone, action_type, points_amount, session_id, logged_by, notes)
       VALUES ($1, $2, 'claimed_receipt', $3, $4, 'Customer QR', $5)`,
      [`aud-${Date.now()}`, cleanPhone, pointsValue, tok.session_id, `Claimed receipt token ${cleanToken}`]
    );

    revalidatePath('/admin');
    revalidatePath('/pos');
    return { success: true, pointsClaimed: pointsValue };
  } catch (e) {
    console.error('Error claiming receipt points:', e);
    return { success: false, error: 'Internal error claiming receipt points' };
  }
}

/**
 * Redeem Reward Tier on POS Cart or Customer QR Order
 */
export async function redeemLoyaltyRewardAction(
  sessionId: string,
  customerPhone: string,
  rewardTierId: string,
  staffName = 'Waiter'
) {
  if (!pool || !sessionId || !customerPhone || !rewardTierId) return { success: false, error: 'Missing required parameters' };
  await ensureLoyaltyTables();

  const isEnabled = await getLoyaltyEnabledSetting();
  if (!isEnabled) return { success: false, error: 'The Loyalty Program is currently disabled by management.' };

  const cleanPhone = customerPhone.trim();
  try {
    // 1. Resolve Virtual Session ID if needed (e.g. virtual-tableId from /order or new table)
    let finalSessionId = sessionId;
    let tableNumber = 1;

    if (sessionId.startsWith('virtual-')) {
      const targetTableId = sessionId.replace('virtual-', '');
      const sessRes = await pool.query(
        "SELECT * FROM table_sessions WHERE (primary_table_id = $1 OR $1 = ANY(merged_table_ids)) AND status = 'active' LIMIT 1",
        [targetTableId]
      );
      if (sessRes.rows.length > 0) {
        finalSessionId = sessRes.rows[0].id;
      } else {
        // Create active table session on demand
        const newSessId = randomUUID();
        const insertSess = await pool.query(
          "INSERT INTO table_sessions (id, primary_table_id, status) VALUES ($1, $2, 'active') RETURNING *",
          [newSessId, targetTableId]
        );
        finalSessionId = insertSess.rows[0].id;
        await pool.query("UPDATE tables SET status = 'occupied' WHERE id = $1", [targetTableId]);
      }
    }

    // Resolve Table Number
    const sessRes = await pool.query('SELECT primary_table_id FROM table_sessions WHERE id = $1', [finalSessionId]);
    if (sessRes.rows.length > 0) {
      const tblRes = await pool.query('SELECT table_number FROM tables WHERE id = $1', [sessRes.rows[0].primary_table_id]);
      if (tblRes.rows.length > 0) tableNumber = Number(tblRes.rows[0].table_number || 1);
    }

    const [custRes, tierRes] = await Promise.all([
      pool.query('SELECT * FROM customer_loyalty WHERE phone_number = $1 OR vip_code = $1 LIMIT 1', [cleanPhone]),
      pool.query('SELECT * FROM loyalty_reward_tiers WHERE id = $1 AND active = true LIMIT 1', [rewardTierId]),
    ]);

    if (custRes.rows.length === 0) return { success: false, error: 'Customer loyalty profile not found' };
    if (tierRes.rows.length === 0) return { success: false, error: 'Reward tier not found or inactive' };

    const customer = custRes.rows[0];
    const tier = tierRes.rows[0];
    const ptsReq = Number(tier.points_required);
    const currPts = Number(customer.points_balance);

    if (currPts < ptsReq) {
      return { success: false, error: `Insufficient points balance (${currPts} pts). Required: ${ptsReq} pts.` };
    }

    // 2. Deduct Points
    await pool.query('UPDATE customer_loyalty SET points_balance = points_balance - $1, updated_at = NOW() WHERE id = $2', [
      ptsReq,
      customer.id,
    ]);

    // 3. Apply Pure Bill Discount to Session
    const discAmount = Number(tier.discount_value) > 0 ? Number(tier.discount_value) : Math.max(1, Math.floor(ptsReq / 10));
    const discountId = randomUUID();
    await pool.query(
      `INSERT INTO discounts (id, session_id, type, value, reason, created_at)
       VALUES ($1, $2, 'fixed', $3, $4, NOW())`,
      [discountId, finalSessionId, discAmount, `🎁 Loyalty Reward: ${tier.name}`]
    );

    // 4. Log Audit with valid randomUUID()
    const auditId = randomUUID();
    await pool.query(
      `INSERT INTO loyalty_audit_logs (id, customer_phone, action_type, points_amount, session_id, reward_name, logged_by, notes)
       VALUES ($1, $2, 'redeemed', $3, $4, $5, $6, $7)`,
      [
        auditId,
        cleanPhone,
        -ptsReq,
        finalSessionId,
        tier.name,
        staffName,
        `Redeemed ${tier.name} (-${ptsReq} pts) for session ${finalSessionId}`,
      ]
    );

    revalidatePath('/pos');
    revalidatePath('/order');
    revalidatePath('/kds');
    revalidatePath('/admin');
    return { success: true, rewardName: tier.name, pointsDeducted: ptsReq };
  } catch (e) {
    console.error('Error redeeming loyalty reward:', e);
    return { success: false, error: 'Failed to redeem reward' };
  }
}

/**
 * Save / Edit Reward Tier
 */
export async function saveRewardTierAction(tier: Partial<LoyaltyRewardTier>) {
  if (!pool || !tier.name || !tier.points_required) return { success: false, error: 'Missing name or points required' };
  await ensureLoyaltyTables();

  const id = tier.id || `tier-${Date.now()}`;
  try {
    await pool.query(
      `INSERT INTO loyalty_reward_tiers (id, name, points_required, reward_type, discount_value, menu_item_id, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         points_required = EXCLUDED.points_required,
         reward_type = EXCLUDED.reward_type,
         discount_value = EXCLUDED.discount_value,
         menu_item_id = EXCLUDED.menu_item_id,
         active = EXCLUDED.active`,
      [
        id,
        tier.name,
        tier.points_required,
        tier.reward_type || 'discount_usd',
        tier.discount_value || 0,
        tier.menu_item_id || null,
        tier.active !== undefined ? tier.active : true,
      ]
    );

    revalidatePath('/admin');
    return { success: true };
  } catch (e) {
    console.error('Error saving reward tier:', e);
    return { success: false, error: 'Failed to save reward tier' };
  }
}

/**
 * Admin Manual Customer Points Adjustment
 */
export async function adjustCustomerPointsAction(customerId: string, deltaPoints: number, notes = 'Admin adjustment', loggedBy = 'Admin') {
  if (!pool || !customerId) return { success: false, error: 'Invalid customer ID' };
  await ensureLoyaltyTables();

  try {
    const custRes = await pool.query('SELECT * FROM customer_loyalty WHERE id = $1 LIMIT 1', [customerId]);
    if (custRes.rows.length === 0) return { success: false, error: 'Customer profile not found' };

    const customer = custRes.rows[0];
    await pool.query('UPDATE customer_loyalty SET points_balance = points_balance + $1, updated_at = NOW() WHERE id = $2', [
      deltaPoints,
      customerId,
    ]);

    await pool.query(
      `INSERT INTO loyalty_audit_logs (id, customer_phone, action_type, points_amount, session_id, logged_by, notes)
       VALUES ($1, $2, 'manual_adjustment', $3, NULL, $4, $5)`,
      [`aud-${Date.now()}`, customer.phone_number || customer.id, deltaPoints, loggedBy, notes]
    );

    revalidatePath('/admin');
    return { success: true };
  } catch (e) {
    console.error('Error adjusting points:', e);
    return { success: false, error: 'Failed to adjust points' };
  }
}

/**
 * Assign a loyalty phone number to an active table session (for POS - whole table)
 * This persists the phone to the session so checkout awards points automatically
 */
export async function assignLoyaltyPhoneToSession(
  sessionId: string,
  phoneNumber: string,
  customerName = 'Valued Guest'
) {
  if (!pool || !sessionId || !phoneNumber?.trim()) return { success: false, error: 'Missing session or phone' };
  await ensureLoyaltyTables();
  await seedDefaultRewardTiers();

  const cleanPhone = phoneNumber.trim();
  const cleanName = customerName.trim() || 'Valued Guest';

  try {
    // Upsert customer profile
    const existingRes = await pool.query('SELECT * FROM customer_loyalty WHERE phone_number = $1 LIMIT 1', [cleanPhone]);
    let customer;
    if (existingRes.rows.length > 0) {
      customer = existingRes.rows[0];
    } else {
      const newId = randomUUID();
      const insertRes = await pool.query(
        `INSERT INTO customer_loyalty (id, phone_number, customer_name, points_balance, total_spent_usd, total_visits)
         VALUES ($1, $2, $3, 0, 0, 1) RETURNING *`,
        [newId, cleanPhone, cleanName]
      );
      customer = insertRes.rows[0];
    }

    // Attach phone to session
    await pool.query(
      'UPDATE table_sessions SET customer_phone = $1, customer_name = $2 WHERE id = $3',
      [cleanPhone, customer.customer_name || cleanName, sessionId]
    );

    // Fetch reward tiers
    const tierRes = await pool.query('SELECT * FROM loyalty_reward_tiers WHERE active = true ORDER BY points_required ASC');
    const rewardTiers = tierRes.rows.map((t) => ({
      ...t,
      points_required: Number(t.points_required || 0),
      discount_value: Number(t.discount_value || 0),
    }));

    revalidatePath('/pos');
    return {
      success: true,
      customer: {
        ...customer,
        points_balance: Number(customer.points_balance || 0),
        total_spent_usd: Number(customer.total_spent_usd || 0),
        total_visits: Number(customer.total_visits || 1),
      },
      rewardTiers,
    };
  } catch (e) {
    console.error('Error assigning loyalty phone to session:', e);
    return { success: false, error: 'Failed to assign loyalty phone' };
  }
}

/**
 * Assign a loyalty phone number to a specific order item (per-item VIP)
 * Creates the customer profile if it doesn't exist yet.
 * Returns the updated customer profile so the UI can show their points.
 */
export async function assignLoyaltyPhoneToOrderItem(
  orderItemId: string,
  phoneNumber: string,
  customerName = 'Valued Guest'
) {
  if (!pool || !orderItemId || !phoneNumber?.trim()) {
    return { success: false, error: 'Missing order item ID or phone number' };
  }
  await ensureLoyaltyTables();
  await seedDefaultRewardTiers();

  const cleanPhone = phoneNumber.trim();
  const cleanName = customerName.trim() || 'Valued Guest';

  try {
    // Upsert customer profile
    const existingRes = await pool.query(
      'SELECT * FROM customer_loyalty WHERE phone_number = $1 LIMIT 1',
      [cleanPhone]
    );
    let customerNameResolved = cleanName;
    let customer: any;
    if (existingRes.rows.length > 0) {
      customer = existingRes.rows[0];
      if (customer.customer_name && customer.customer_name !== 'Valued Guest') {
        customerNameResolved = customer.customer_name;
      } else if (cleanName !== 'Valued Guest') {
        // Update customer profile with specific name provided
        await pool.query('UPDATE customer_loyalty SET customer_name = $1 WHERE id = $2', [cleanName, customer.id]);
        customer.customer_name = cleanName;
      }
    } else {
      const newId = randomUUID();
      const insertRes = await pool.query(
        `INSERT INTO customer_loyalty (id, phone_number, customer_name, points_balance, total_spent_usd, total_visits)
         VALUES ($1, $2, $3, 0, 0, 1) RETURNING *`,
        [newId, cleanPhone, cleanName]
      );
      customer = insertRes.rows[0];
    }

    // Assign phone, guest_name and customer_name to the order item
    await pool.query(
      `UPDATE order_items 
       SET loyalty_phone = $1, 
           guest_name = $2,
           customer_name = CASE WHEN $2 <> 'Valued Guest' THEN $2 ELSE COALESCE(customer_name, $2) END 
       WHERE id = $3`,
      [cleanPhone, customerNameResolved, orderItemId]
    );

    revalidatePath('/pos');
    return {
      success: true,
      customer: {
        id: customer.id,
        phone_number: customer.phone_number,
        customer_name: customerNameResolved,
        points_balance: Number(customer.points_balance || 0),
        total_spent_usd: Number(customer.total_spent_usd || 0),
        total_visits: Number(customer.total_visits || 1),
      },
    };
  } catch (e) {
    console.error('Error assigning loyalty phone to order item:', e);
    return { success: false, error: 'Failed to assign loyalty phone to item' };
  }
}

/**
 * Remove loyalty phone from a specific order item
 */
export async function removeLoyaltyPhoneFromOrderItem(orderItemId: string) {
  if (!pool || !orderItemId) return { success: false, error: 'Missing order item ID' };
  try {
    await pool.query('UPDATE order_items SET loyalty_phone = NULL WHERE id = $1', [orderItemId]);
    revalidatePath('/pos');
    return { success: true };
  } catch (e) {
    console.error('Error removing loyalty phone from item:', e);
    return { success: false, error: 'Failed to remove' };
  }
}

/**
 * Search loyalty customers by phone number or name (for POS typeahead)
 * Returns up to 8 matching results ordered by most recent activity
 */
export async function searchLoyaltyCustomers(query: string, exactMatch = false) {
  if (!pool || !query?.trim() || query.trim().length < 2) {
    return { success: true, customers: [] };
  }
  await ensureLoyaltyTables();

  const rawQuery = query.trim();
  const canonical = normalizePhone(rawQuery);
  const variations = getPhoneLookupVariations(rawQuery);
  const pattern = `%${rawQuery}%`;

  try {
    const res = exactMatch
      ? await pool.query(
          `SELECT id, phone_number, customer_name, points_balance, total_spent_usd, total_visits
           FROM customer_loyalty
           WHERE phone_number = ANY($1::text[]) OR phone_number = $2
           ORDER BY updated_at DESC NULLS LAST
           LIMIT 8`,
          [variations, rawQuery]
        )
      : await pool.query(
          `SELECT id, phone_number, customer_name, points_balance, total_spent_usd, total_visits
           FROM customer_loyalty
           WHERE phone_number ILIKE $1 OR customer_name ILIKE $1 OR phone_number = ANY($2::text[])
           ORDER BY updated_at DESC NULLS LAST
           LIMIT 8`,
          [pattern, variations]
        );

    return {
      success: true,
      canonicalPhone: canonical,
      customers: res.rows.map((c) => ({
        id: c.id,
        phone_number: c.phone_number || '',
        customer_name: c.customer_name || 'Valued Guest',
        points_balance: Number(c.points_balance || 0),
        total_spent_usd: Number(c.total_spent_usd || 0),
        total_visits: Number(c.total_visits || 0),
      })),
    };
  } catch (e) {
    console.error('Error searching loyalty customers:', e);
    return { success: true, canonicalPhone: canonical, customers: [] };
  }
}

/**
 * Get system setting for Loyalty Program enabled state
 */
export async function getLoyaltyEnabledSetting(): Promise<boolean> {
  if (!pool) return true;
  try {
    const res = await pool.query("SELECT value FROM system_settings WHERE key = 'loyalty_program_enabled'");
    if (res.rows.length > 0 && res.rows[0].value !== null) {
      const val = res.rows[0].value;
      let parsed = val;
      if (typeof val === 'string') {
        try { parsed = JSON.parse(val); } catch (e) { parsed = val; }
      }
      if (typeof parsed === 'boolean') return parsed;
      if (typeof parsed === 'object' && parsed !== null && 'enabled' in parsed) return !!parsed.enabled;
    }
  } catch (e) {
    console.error('Error reading loyalty setting:', e);
  }
  return true;
}

/**
 * Update system setting for Loyalty Program enabled state
 */
export async function setLoyaltyEnabledSetting(enabled: boolean) {
  if (!pool) return { success: false, error: 'Database connection error' };
  await ensureLoyaltyTables();

  try {
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('loyalty_program_enabled', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify({ enabled })]
    );

    revalidatePath('/pos');
    revalidatePath('/order');
    revalidatePath('/claim');
    revalidatePath('/admin');

    return { success: true, enabled };
  } catch (e: any) {
    console.error('Error updating loyalty setting:', e);
    return { success: false, error: e.message || 'Failed to update setting' };
  }
}



