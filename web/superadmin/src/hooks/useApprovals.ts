import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

// Query key factory
export const approvalKeys = {
  all: ['approvals'] as const,
  pending: () => [...approvalKeys.all, 'pending'] as const,
};

export interface PendingRequest {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
  role_status: string;
}

/**
 * Fetch all pending approval requests
 */
export function usePendingApprovals() {
  return useQuery({
    queryKey: approvalKeys.pending(),
    queryFn: async (): Promise<PendingRequest[]> => {
      // 1. Fetch pending roles from user_roles (New Architecture)
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      console.log('[usePendingApprovals] Pending roles from user_roles:', roles);

      if (rolesError) {
        console.error('Error fetching user_roles:', rolesError);
      }

      // 2. Fetch pending profiles from user_profiles (Legacy Architecture)
      const { data: legacyProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, email, role, requested_role, role_status, created_at')
        .eq('role_status', 'pending')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error fetching legacy profiles:', profilesError);
      }

      // 3. Collect all user IDs for hydration
      const roleUserIds = (roles || []).map(r => r.user_id);
      const legacyUserIds = (legacyProfiles || []).map(p => p.id);
      const allUserIds = [...new Set([...roleUserIds, ...legacyUserIds])].filter(Boolean);

      // 4. Hydrate profiles for role requests
      const { data: hydratedProfiles } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, email')
        .in('id', allUserIds);

      const profileMap = Object.fromEntries((hydratedProfiles || []).map(p => [p.id, p]));

      // 5. Merge results
      const results: PendingRequest[] = [];
      const seenKeys = new Set<string>(); // avoid duplicates if in both

      // Add from user_roles
      (roles || []).forEach((r: any) => {
        const profile = profileMap[r.user_id];
        const displayName = profile?.display_name || profile?.username || profile?.email?.split('@')[0] || 'Anonymous';
        results.push({
          id: r.user_id,
          username: displayName,
          email: profile?.email || 'No email',
          role: r.role,
          created_at: r.created_at,
          role_status: r.status
        });
        seenKeys.add(`${r.user_id}-${r.role}`);
      });

      // Add from legacy user_profiles if not already added
      (legacyProfiles || []).forEach((p: any) => {
        const role = p.requested_role || p.role || 'admin';
        if (!seenKeys.has(`${p.id}-${role}`)) {
          const displayName = p.display_name || p.username || p.email?.split('@')[0] || 'Anonymous';
          results.push({
            id: p.id,
            username: displayName,
            email: p.email || 'No email',
            role: role,
            created_at: p.created_at,
            role_status: p.role_status
          });
        }
      });

      return results;
    },
  });
}

/**
 * Mutation to approve or reject a user request
 */
export function useApprovalAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status,
      role
    }: { 
      id: string; 
      status: 'approved' | 'rejected';
      role?: string;
    }) => {
      let updateData: any = { role_status: status };
      let finalRole: string | null = role || null;

      if (status === 'approved') {
        if (!finalRole) {
          // Fallback: Fetch the profile to see what role was requested if not passed
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role, requested_role')
            .eq('id', id)
            .single();

          finalRole = profile?.requested_role || profile?.role || null;
        }

        if (finalRole) {
          updateData.role = finalRole;
          updateData.requested_role = null;
        }
      } else if (status === 'rejected') {
        updateData.requested_role = null;
      }

      // 1. Update user_profiles
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', id);

      if (profileError) throw profileError;

      // 2. Sync with user_roles table
      if (finalRole) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ status: status })
          .eq('user_id', id)
          .eq('role', finalRole);

        if (roleError) console.error('Error syncing user_roles:', roleError);
      } else if (status === 'rejected') {
        // If rejected and no specific role, mark ALL pending admin/superadmin roles as rejected
        await supabase
          .from('user_roles')
          .update({ status: 'rejected' })
          .eq('user_id', id)
          .in('role', ['admin', 'superadmin'])
          .eq('status', 'pending');
      }

      return { id, status };
    },
    onSuccess: () => {
      // Invalidate pending approvals to refresh the list
      queryClient.invalidateQueries({ queryKey: approvalKeys.pending() });
    },
  });
}
