/**
 * Central export point for all React Query hooks
 * Import hooks from here for better organization
 */

// Booking hooks
export * from './useBookings';

// User profile hooks
export * from './useUserProfile';

// Review hooks
export * from './useReviews';

// Pricing hooks
export * from './usePricing';

// Location hooks
export * from './useLocations';

// Challenge hooks
export * from './useChallenges';

// Transaction hooks
export * from './useTransactions';

// Approval hooks
// export * from './useApprovals';

// Challenge hooks
export * from './useChallenges';

// Note: useNotifications.ts already exists with a different pattern (useState/useEffect)
// To avoid conflicts, import it directly when needed
