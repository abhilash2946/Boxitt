import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getReviews, getUserReview, saveReview } from "../services/reviewService";

// Query key factory for reviews
export const reviewKeys = {
  all: ["reviews"] as const,
  byLocation: (locationId: string) => [...reviewKeys.all, "location", locationId] as const,
  userReview: (locationId: string, userId: string) => 
    [...reviewKeys.all, "userReview", { locationId, userId }] as const,
};

/**
 * Fetch all reviews for a location
 */
export function useReviews(locationId: string) {
  return useQuery({
    queryKey: reviewKeys.byLocation(locationId),
    queryFn: () => getReviews(locationId),
    enabled: !!locationId,
  });
}

/**
 * Fetch a specific user's review for a location
 */
export function useUserReview(locationId: string, userId: string) {
  return useQuery({
    queryKey: reviewKeys.userReview(locationId, userId),
    queryFn: () => getUserReview(locationId, userId),
    enabled: !!locationId && !!userId,
  });
}

/**
 * Create or update a review with optimistic updates
 */
export function useSaveReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      locationId,
      userId,
      rating,
      comment,
    }: {
      locationId: string;
      userId: string;
      rating: number;
      comment: string;
    }) => saveReview(locationId, userId, rating, comment),
    onMutate: async ({ locationId, userId, rating, comment }) => {
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: reviewKeys.byLocation(locationId) });
      await queryClient.cancelQueries({ queryKey: reviewKeys.userReview(locationId, userId) });

      // Snapshot previous data
      const previousReviews = queryClient.getQueryData(reviewKeys.byLocation(locationId));
      const previousUserReview = queryClient.getQueryData(reviewKeys.userReview(locationId, userId));

      // Optimistically add or update the review
      queryClient.setQueryData(reviewKeys.byLocation(locationId), (old: any[] = []) => {
        const existingIndex = old.findIndex(r => r.user_id === userId);
        const newReview = {
          id: existingIndex >= 0 ? old[existingIndex].id : `temp-${Date.now()}`,
          location_id: locationId,
          user_id: userId,
          rating,
          comment,
          created_at: new Date().toISOString(),
        };

        if (existingIndex >= 0) {
          // Update existing review
          const updated = [...old];
          updated[existingIndex] = newReview;
          return updated;
        } else {
          // Add new review at the beginning
          return [newReview, ...old];
        }
      });

      // Update user review cache
      queryClient.setQueryData(reviewKeys.userReview(locationId, userId), {
        id: `temp-${Date.now()}`,
        location_id: locationId,
        user_id: userId,
        rating,
        comment,
        created_at: new Date().toISOString(),
      });

      return { previousReviews, previousUserReview, locationId, userId };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousReviews) {
        queryClient.setQueryData(reviewKeys.byLocation(context.locationId), context.previousReviews);
      }
      if (context?.previousUserReview !== undefined) {
        queryClient.setQueryData(
          reviewKeys.userReview(context.locationId, context.userId),
          context.previousUserReview
        );
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate to get real server data
      queryClient.invalidateQueries({ 
        queryKey: reviewKeys.byLocation(variables.locationId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: reviewKeys.userReview(variables.locationId, variables.userId) 
      });
    },
  });
}
