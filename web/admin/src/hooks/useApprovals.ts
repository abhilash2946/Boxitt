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
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          role,
          status,
          created_at,
          user_profiles!user_id (
            username,
            email
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        username: row.user_profiles?.username,
        email: row.user_profiles?.email,
        role: row.role,
        created_at: row.created_at,
        role_status: row.status
      }));
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
      const { error } = await supabase
        .from('user_roles')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      return { id, status, role };
    },
    onSuccess: () => {
      // Invalidate pending approvals to refresh the list
      queryClient.invalidateQueries({ queryKey: approvalKeys.pending() });
    },
  });
}
