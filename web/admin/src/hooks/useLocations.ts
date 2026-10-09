import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { locationService, LocationWithAdmin } from '../services/locationService';
import { Location } from '../types';

export const locationKeys = {
  all: ['locations'] as const,
  lists: () => [...locationKeys.all, 'list'] as const,
  list: () => [...locationKeys.lists()] as const,
  withAdmins: () => [...locationKeys.all, 'withAdmins'] as const,
  detail: (id: string) => [...locationKeys.all, 'detail', id] as const,
};

export function useLocations() {
  return useQuery({
    queryKey: locationKeys.list(),
    queryFn: () => locationService.getLocations(),
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useLocationById(id?: string) {
  return useQuery({
    queryKey: locationKeys.detail(id || ''),
    queryFn: () => locationService.getLocationById(id || ''),
    enabled: Boolean(id),
  });
}

export function useLocationsWithAdmins() {
  return useQuery<LocationWithAdmin[]>({
    queryKey: locationKeys.withAdmins(),
    queryFn: () => locationService.getLocationsWithAdmins(),
  });
}

export function useAddLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (loc: Omit<Location, 'id'>) => locationService.addLocation(loc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all });
    }
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Location> }) => locationService.updateLocation(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all });
      queryClient.invalidateQueries({ queryKey: locationKeys.detail(variables.id) });
    }
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => locationService.deleteLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all });
    }
  });
}
