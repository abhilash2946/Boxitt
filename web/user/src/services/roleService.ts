import { supabase } from './supabase';
import { PLATFORM_ROLE } from '../constants';

export const roleService = {
  /**
   * Ensures the current platform's role exists for the user in user_roles table.
   * If it doesn't exist, it creates it with 'pending' status.
   */
  async ensurePlatformRole(userId: string) {
    if (!userId) {
      console.warn('[RoleService] No userId provided to ensurePlatformRole');
      return;
    }

    try {
      console.log(`[RoleService] Checking ${PLATFORM_ROLE} role for user: ${userId}`);

      // 1. Check if the role already exists for this user
      const { data: existingRole, error: fetchError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('role', PLATFORM_ROLE)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error(`[RoleService] Error fetching existing role for ${userId}:`, fetchError);
        // We don't throw here to allow the UI to continue, but we log it heavily
        return;
      }

      // 2. If it doesn't exist, create it
      if (!existingRole) {
        console.log(`[RoleService] No ${PLATFORM_ROLE} role found for ${userId}. Creating...`);
        const defaultStatus = PLATFORM_ROLE === 'user' ? 'approved' : 'pending';

        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: PLATFORM_ROLE,
            status: defaultStatus
          });

        if (insertError) {
          console.error(`[RoleService] Failed to create ${PLATFORM_ROLE} role for ${userId}:`, insertError);
          // Potential RLS failure or network error
          if (insertError.code === '42501') {
            console.error('[RoleService] Permission denied (RLS). Ensure the user is authenticated and policies allow insertion into user_roles.');
          }
          return;
        }

        console.log(`[RoleService] Successfully created ${PLATFORM_ROLE} role for ${userId} with ${defaultStatus} status`);
      } else {
        console.log(`[RoleService] ${PLATFORM_ROLE} role already exists for ${userId} (Status: ${existingRole.status})`);
      }
    } catch (err) {
      console.error('[RoleService] Unexpected error in ensurePlatformRole:', err);
    }
  }
};
