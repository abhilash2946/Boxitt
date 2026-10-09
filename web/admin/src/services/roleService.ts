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
        return;
      }

      // SELF-HEALING: Check if user_profiles already has this role as approved
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, role_status')
        .eq('id', userId)
        .maybeSingle();

      const shouldBeApproved = ((PLATFORM_ROLE as string) === 'user') || (profile && profile.role === PLATFORM_ROLE && profile.role_status === 'approved');

      // 2. If it doesn't exist, create it
      if (!existingRole) {
        console.log(`[RoleService] No ${PLATFORM_ROLE} role found for ${userId}. Creating...`);
        const defaultStatus = shouldBeApproved ? 'approved' : 'pending';

        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: PLATFORM_ROLE,
            status: defaultStatus
          });

        if (insertError) {
          console.error(`[RoleService] Failed to create ${PLATFORM_ROLE} role for ${userId}:`, insertError);
          return;
        }

        console.log(`[RoleService] Successfully created ${PLATFORM_ROLE} role for ${userId} with ${defaultStatus} status`);
      } else if (existingRole.status === 'pending' && shouldBeApproved) {
        // SELF-HEALING: Update existing pending role if profile is already approved
        console.log(`[RoleService] Updating existing pending ${PLATFORM_ROLE} role to approved for ${userId}`);
        await supabase
          .from('user_roles')
          .update({ status: 'approved' })
          .eq('user_id', userId)
          .eq('role', PLATFORM_ROLE);
      } else {
        console.log(`[RoleService] ${PLATFORM_ROLE} role already exists for ${userId} (Status: ${existingRole.status})`);
      }
    } catch (err) {
      console.error('[RoleService] Unexpected error in ensurePlatformRole:', err);
    }
  },

  async getPlatformRole(userId: string) {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', PLATFORM_ROLE)
      .maybeSingle();

    if (error) {
      console.error('[RoleService] Error fetching platform role:', error);
      return null;
    }
    return data;
  }
};
