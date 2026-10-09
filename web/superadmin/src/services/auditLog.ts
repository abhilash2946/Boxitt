import { supabase } from './supabase';
import { handleError } from './errorHandler';

export type AuditAction = 
  | 'ROLE_CHANGE'
  | 'ADMIN_CREATE_BOOKING'
  | 'ADMIN_MODIFY_BOOKING'
  | 'ADMIN_DELETE_BOOKING'
  | 'ADMIN_DELETE_USER'
  | 'ADMIN_SUSPEND_USER'
  | 'CLOSURE_CREATE'
  | 'CLOSURE_DELETE'
  | 'LOCATION_UPDATE'
  | 'LOCATION_DELETE';

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: AuditAction;
  resource_type: string;
  resource_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  status: 'success' | 'failure';
  error_message?: string;
  created_at: string;
}

/**
 * Log an admin action to audit trail
 * @param action - Type of action performed
 * @param resourceType - What was modified (e.g., 'user', 'booking', 'closure')
 * @param resourceId - ID of the resource (optional)
 * @param oldValues - Previous values before change (optional)
 * @param newValues - New values after change (optional)
 * @param error - Error message if operation failed (optional)
 */
export const logAuditAction = async (
  action: AuditAction,
  resourceType: string,
  resourceId?: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  error?: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      throw new Error('User not authenticated - cannot log audit action');
    }

    const logEntry: Omit<AuditLogEntry, 'id' | 'created_at'> = {
      actor_id: authData.user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: oldValues,
      new_values: newValues,
      status: error ? 'failure' : 'success',
      error_message: error,
    };

    // Get user agent and IP (note: IP from Supabase context when available)
    if (typeof navigator !== 'undefined') {
      logEntry.user_agent = navigator.userAgent;
    }

    const { error: insertError } = await supabase
      .from('audit_logs')
      .insert([logEntry]);

    if (insertError) {
      console.error('Audit logging failed:', insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true, error: null };
  } catch (error: any) {
    const appError = handleError(error);
    console.error('Audit log error:', appError);
    return { success: false, error: appError.message };
  }
};

/**
 * Query audit logs (superadmin only)
 * @param filters - Optional filters (actor_id, action, resource_type, resource_id, date range)
 */
export const getAuditLogs = async (filters?: {
  actor_id?: string;
  action?: AuditAction;
  resource_type?: string;
  resource_id?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<{ logs: AuditLogEntry[]; error: string | null }> => {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.actor_id) {
      query = query.eq('actor_id', filters.actor_id);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.resource_type) {
      query = query.eq('resource_type', filters.resource_type);
    }
    if (filters?.resource_id) {
      query = query.eq('resource_id', filters.resource_id);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    query = query.limit(filters?.limit || 100);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return { logs: data || [], error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { logs: [], error: appError.message };
  }
};

/**
 * Log a role change
 */
export const logRoleChange = async (
  targetUserId: string,
  oldRole: string,
  newRole: string
): Promise<{ success: boolean; error: string | null }> => {
  return logAuditAction(
    'ROLE_CHANGE',
    'user',
    targetUserId,
    { role: oldRole },
    { role: newRole }
  );
};

/**
 * Log an admin booking action
 */
export const logAdminBookingAction = async (
  action: 'ADMIN_CREATE_BOOKING' | 'ADMIN_MODIFY_BOOKING' | 'ADMIN_DELETE_BOOKING',
  bookingId: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>
): Promise<{ success: boolean; error: string | null }> => {
  return logAuditAction(
    action,
    'booking',
    bookingId,
    oldValues,
    newValues
  );
};
