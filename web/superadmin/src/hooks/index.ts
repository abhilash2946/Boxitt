/**
 * Central export point for all React Query hooks
 * Import hooks from here for better organization
 */

// User profile hooks
export * from './useUserProfile';

// Location hooks
export * from './useLocations';

// Approval hooks
export * from './useApprovals';

// Note: useNotifications.ts already exists with a different pattern (useState/useEffect)
// To avoid conflicts, import it directly when needed
