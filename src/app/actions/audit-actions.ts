'use server';

import { dbStore, pool } from '@/lib/db';
import { ActivityLog, StaffMember } from '@/lib/types';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';

// Log staff activity in database & memory
export async function logStaffActivity(data: {
  staffName: string;
  staffRole: string;
  actionType: string;
  tableNumber?: number;
  details: string;
}) {
  const logId = randomUUID();
  const newLog: ActivityLog = {
    id: logId,
    staff_name: data.staffName || 'Staff Member',
    staff_role: data.staffRole || 'Staff',
    action_type: data.actionType,
    table_number: data.tableNumber,
    details: data.details,
    created_at: new Date().toISOString(),
  };

  dbStore.activityLogs.unshift(newLog);
  if (dbStore.activityLogs.length > 200) {
    dbStore.activityLogs.pop();
  }

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO activity_logs (id, staff_name, staff_role, action_type, table_number, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newLog.id, newLog.staff_name, newLog.staff_role, newLog.action_type, newLog.table_number || null, newLog.details]
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
  let roster = dbStore.staffMembers;
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM staff_members ORDER BY name ASC');
      if (res.rows.length > 0) roster = res.rows;
    } catch (e) {}
  }
  return roster;
}

// Fetch Activity Logs
export async function getStaffActivityLogs(): Promise<ActivityLog[]> {
  let logs = dbStore.activityLogs;

  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100');
      if (res.rows.length > 0) logs = res.rows;
    } catch (e) {
      console.error('Neon activity logs fetch error:', e);
    }
  }

  return logs;
}
