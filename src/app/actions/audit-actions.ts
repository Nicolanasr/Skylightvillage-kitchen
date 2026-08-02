'use server';

import { pool } from '@/lib/db';
import { ActivityLog, StaffMember } from '@/lib/types';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';

// Log staff activity in database
export async function logStaffActivity(data: {
  staffName: string;
  staffRole: string;
  actionType: string;
  tableNumber?: number;
  details: string;
}) {
  const logId = randomUUID();
  const staffName = data.staffName || 'Staff Member';
  const staffRole = data.staffRole || 'Staff';
  const tableNumber = data.tableNumber || null;

  if (pool) {
    try {
      await pool.query('CREATE TABLE IF NOT EXISTS activity_logs (id TEXT PRIMARY KEY, staff_name TEXT, staff_role TEXT, action_type TEXT, table_number INT, details TEXT, created_at TIMESTAMPTZ DEFAULT NOW())');
      await pool.query(
        `INSERT INTO activity_logs (id, staff_name, staff_role, action_type, table_number, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [logId, staffName, staffRole, data.actionType, tableNumber, data.details]
      );
    } catch (e) {
      console.error('Neon activity log insert error:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/pos/reports');
  return { success: true };
}

// Fetch Staff Roster
export async function getStaffRoster(): Promise<StaffMember[]> {
  if (!pool) return [];
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS staff_members (id TEXT PRIMARY KEY, name TEXT NOT NULL, pin TEXT NOT NULL UNIQUE, role TEXT NOT NULL)');
    const res = await pool.query('SELECT * FROM staff_members ORDER BY name ASC');
    if (res.rows.length === 0) {
      // Seed default staff members into PostgreSQL if empty
      const defaultStaff: StaffMember[] = [
        { id: 'stf-1', name: 'John', pin: '1001', role: 'Waiter' },
        { id: 'stf-2', name: 'Sarah', pin: '1002', role: 'Waiter' },
        { id: 'stf-3', name: 'Charbel', pin: '1003', role: 'Cashier' },
        { id: 'stf-4', name: 'Chef Antoine', pin: '2001', role: 'Chef' },
        { id: 'stf-5', name: 'Manager Admin', pin: '1234', role: 'Manager' },
      ];
      for (const stf of defaultStaff) {
        await pool.query(
          'INSERT INTO staff_members (id, name, pin, role) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [stf.id, stf.name, stf.pin, stf.role]
        );
      }
      const seededRes = await pool.query('SELECT * FROM staff_members ORDER BY name ASC');
      return seededRes.rows;
    }
    return res.rows;
  } catch (e) {
    console.error('Neon staff roster fetch error:', e);
    return [];
  }
}

// Fetch Activity Logs
export async function getStaffActivityLogs(): Promise<ActivityLog[]> {
  if (!pool) return [];
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS activity_logs (id TEXT PRIMARY KEY, staff_name TEXT, staff_role TEXT, action_type TEXT, table_number INT, details TEXT, created_at TIMESTAMPTZ DEFAULT NOW())');
    await pool.query('ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()');
    const res = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100');
    return res.rows;
  } catch (e) {
    console.error('Neon activity logs fetch error:', e);
    return [];
  }
}
