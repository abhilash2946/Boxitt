import { usePermissions as usePermissionsContext } from '../contexts/PermissionsContext';

/**
 * @deprecated Use usePermissions from contexts/PermissionsContext instead.
 * This hook is kept for backward compatibility during the migration.
 */
export const usePermissions = usePermissionsContext;
export type { PermissionType } from '../contexts/PermissionsContext';
