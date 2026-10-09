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
