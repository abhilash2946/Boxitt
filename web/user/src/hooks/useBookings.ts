import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingService } from "../services/bookingService";
import { Booking } from "../types";

// Query key factory for bookings
export const bookingKeys = {
  all: ["bookings"] as const,
  lists: () => [...bookingKeys.all, "list"] as const,
  list: (locationId: string, date?: string) => 
    [...bookingKeys.lists(), { locationId, date }] as const,
  detail: (id: string) => [...bookingKeys.all, "detail", id] as const,
};

/**
 * Fetch bookings for a specific location and optionally a date
 */
export function useBookings(locationId: string, date?: string) {
  return useQuery({
    queryKey: bookingKeys.list(locationId, date),
    queryFn: () => bookingService.getBookings(locationId, date),
    enabled: !!locationId,
  });
}

/**
 * Fetch a single booking by ID
 */
export function useBooking(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: () => bookingService.getBookingById(id),
    enabled: !!id,
  });
}

/**
 * Create a new booking with optimistic updates
 */
export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (booking: any) => bookingService.saveBooking(booking),
    onMutate: async (newBooking) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: bookingKeys.lists() });

      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData(
        bookingKeys.list(newBooking.locationId, newBooking.date)
      );

      // Optimistically update the cache with the new booking
      queryClient.setQueryData(
        bookingKeys.list(newBooking.locationId, newBooking.date),
        (old: Booking[] = []) => {
          // Add temporary booking to the list with a placeholder ID
          const optimisticBooking = {
            ...newBooking,
            id: `temp-${Date.now()}`,
            createdAt: new Date().toISOString(),
          };
          return [...old, optimisticBooking];
        }
      );

      // Return context with the previous bookings for rollback
      return { previousBookings, locationId: newBooking.locationId, date: newBooking.date };
    },
    onError: (err, newBooking, context) => {
      // If the mutation fails, rollback to the previous state
      if (context?.previousBookings) {
        queryClient.setQueryData(
          bookingKeys.list(context.locationId, context.date),
          context.previousBookings
        );
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate all booking lists so they refetch with real data
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
      
      // Set the new booking in the cache with the real ID from server
      if (data.data) {
        queryClient.setQueryData(
          bookingKeys.detail(data.data.id),
          data.data
        );
      }
    },
  });
}

/**
 * Update an existing booking with optimistic updates
 */
export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Booking> }) =>
      bookingService.updateBooking(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel queries to avoid overwriting
      await queryClient.cancelQueries({ queryKey: bookingKeys.detail(id) });
      await queryClient.cancelQueries({ queryKey: bookingKeys.lists() });

      // Snapshot previous data
      const previousBooking = queryClient.getQueryData(bookingKeys.detail(id));
      const previousLists = queryClient.getQueriesData({ queryKey: bookingKeys.lists() });

      // Optimistically update the detail cache
      queryClient.setQueryData(bookingKeys.detail(id), (old: Booking | undefined) => {
        if (!old) return old;
        return { ...old, ...updates };
      });

      // Optimistically update any lists that contain this booking
      queryClient.setQueriesData({ queryKey: bookingKeys.lists() }, (old: Booking[] | undefined) => {
        if (!old) return old;
        return old.map(booking => 
          booking.id === id ? { ...booking, ...updates } : booking
        );
      });

      return { previousBooking, previousLists, id };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousBooking) {
        queryClient.setQueryData(bookingKeys.detail(context.id), context.previousBooking);
      }
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate to ensure we have the latest server data
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

/**
 * Add a join request to a booking with optimistic updates
 */
export function useAddJoinRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bookingId,
      playerName,
      phone,
      count,
      joinerId,
    }: {
      bookingId: string;
      playerName: string;
      phone: string;
      count?: number;
      joinerId?: string;
    }) => bookingService.addJoinRequest(bookingId, playerName, phone, count, joinerId),
    onMutate: async ({ bookingId, playerName, phone, count = 1 }) => {
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: bookingKeys.detail(bookingId) });
      await queryClient.cancelQueries({ queryKey: bookingKeys.lists() });

      // Snapshot previous data
      const previousBooking = queryClient.getQueryData(bookingKeys.detail(bookingId));
      const previousLists = queryClient.getQueriesData({ queryKey: bookingKeys.lists() });

      // Optimistically update the booking
      queryClient.setQueryData(bookingKeys.detail(bookingId), (old: Booking | undefined) => {
        if (!old) return old;
        return {
          ...old,
          currentPlayers: (old.currentPlayers || 0) + count,
          joinRequests: [
            ...(old.joinRequests || []),
            { playerName, phone, status: 'accepted', groupSize: count }
          ],
        };
      });

      // Update lists
      queryClient.setQueriesData({ queryKey: bookingKeys.lists() }, (old: Booking[] | undefined) => {
        if (!old) return old;
        return old.map(booking =>
          booking.id === bookingId
            ? {
                ...booking,
                currentPlayers: (booking.currentPlayers || 0) + count,
                joinRequests: [
                  ...(booking.joinRequests || []),
                  { playerName, phone, status: 'accepted', groupSize: count }
                ],
              }
            : booking
        );
      });

      return { previousBooking, previousLists, bookingId };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousBooking) {
        queryClient.setQueryData(bookingKeys.detail(context.bookingId), context.previousBooking);
      }
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate to get real server data
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(variables.bookingId) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}
