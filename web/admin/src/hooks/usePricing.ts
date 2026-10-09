import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPricingForLocation, upsertPricing, deletePricing, Pricing } from "../services/pricingService";

// Query key factory for pricing
export const pricingKeys = {
  all: ["pricing"] as const,
  byLocation: (locationId: string) => [...pricingKeys.all, "location", locationId] as const,
};

/**
 * Fetch pricing for a specific location
 */
export function usePricing(locationId: string) {
  return useQuery({
    queryKey: pricingKeys.byLocation(locationId),
    queryFn: () => getPricingForLocation(locationId),
    enabled: !!locationId,
  });
}

/**
 * Upsert pricing
 */
export function useUpsertPricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pricing: Pricing) => upsertPricing(pricing),
    onSuccess: (_, variables) => {
      // Invalidate pricing for this location
      queryClient.invalidateQueries({ 
        queryKey: pricingKeys.byLocation(variables.locationId || variables.location_id || '')
      });
    },
  });
}

/**
 * Delete pricing
 */
export function useDeletePricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, locationId }: { id: string; locationId: string }) => 
      deletePricing(id),
    onSuccess: (_, variables) => {
      // Invalidate pricing for this location
      queryClient.invalidateQueries({ 
        queryKey: pricingKeys.byLocation(variables.locationId) 
      });
    },
  });
}
