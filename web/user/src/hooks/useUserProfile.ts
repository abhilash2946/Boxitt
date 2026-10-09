import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUserProfile,
  getCurrentUserProfile,
  getCurrentUserRole,
  searchUsers,
  updateUserRole,
  UserProfile,
  UserRole,
} from "../services/userService";

// Query key factory for user profiles
export const userKeys = {
  all: ["users"] as const,
  profile: (userId: string) => [...userKeys.all, "profile", userId] as const,
  currentProfile: () => [...userKeys.all, "currentProfile"] as const,
  currentRole: () => [...userKeys.all, "currentRole"] as const,
  search: (query: string, searchType: string) => 
    [...userKeys.all, "search", { query, searchType }] as const,
};

/**
 * Fetch a user profile by ID
 */
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: userKeys.profile(userId),
    queryFn: async () => {
      const result = await getUserProfile(userId);
      if (result.error) throw new Error(result.error);
      return result.profile;
    },
    enabled: !!userId,
  });
}

/**
 * Fetch the current user's profile
 */
export function useCurrentUserProfile() {
  return useQuery({
    queryKey: userKeys.currentProfile(),
    queryFn: async () => {
      const result = await getCurrentUserProfile();
      if (result.error) throw new Error(result.error);
      return result.profile;
    },
  });
}

/**
 * Fetch the current user's role
 */
export function useCurrentUserRole() {
  return useQuery({
    queryKey: userKeys.currentRole(),
    queryFn: async () => {
      const result = await getCurrentUserRole();
      if (result.error) throw new Error(result.error);
      return result.role;
    },
  });
}

/**
 * Search for users
 */
export function useSearchUsers(
  query: string,
  searchType: "displayName" | "email" | "phone" | "all" = "all"
) {
  return useQuery({
    queryKey: userKeys.search(query, searchType),
    queryFn: async () => {
      const result = await searchUsers(query, searchType);
      if (result.error) throw new Error(result.error);
      return result.users;
    },
    enabled: query.trim().length >= 2, // Only search if query is at least 2 chars
  });
}

/**
 * Update a user's role
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      updateUserRole(userId, role),
    onSuccess: (result, variables) => {
      if (result.error) throw new Error(result.error);
      
      // Invalidate the specific user profile
      queryClient.invalidateQueries({ queryKey: userKeys.profile(variables.userId) });
      
      // If updating current user, invalidate current profile and role
      queryClient.invalidateQueries({ queryKey: userKeys.currentProfile() });
      queryClient.invalidateQueries({ queryKey: userKeys.currentRole() });
    },
  });
}
