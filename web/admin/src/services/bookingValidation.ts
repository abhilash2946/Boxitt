import { Booking, User, BookingStatus } from '../types';
import { handleError } from './errorHandler';
import { bookingService } from './bookingService';

export interface BookingValidationResult {
  valid: boolean;
  error?: string;
  conflictingBooking?: Booking;
}

export interface BookingSlotConflict {
  bookingId: string;
  playerName: string;
  timeRange: string;
  status: BookingStatus;
}

/**
 * Check if a time slot is already booked
 */
export const checkSlotConflicts = async (
  locationId: string,
  date: string,
  startHour: number,
  endHour: number,
  courtId?: string,
  excludeBookingId?: string
): Promise<BookingSlotConflict[]> => {
  try {
    const bookings = await bookingService.getBookings(locationId, date);
    const conflicts: BookingSlotConflict[] = [];

    if (!bookings || !Array.isArray(bookings)) return [];

    for (const booking of bookings) {
      if (excludeBookingId && booking.id === excludeBookingId) continue;
      if (courtId && booking.courtId !== courtId) continue;
      if (
        booking.status === BookingStatus.CANCELLED ||
        booking.status === BookingStatus.REJECTED ||
        booking.status === BookingStatus.DECLINED ||
        booking.status === BookingStatus.TIMED_OUT
      ) continue;

      const bookingStart = Number(booking.startHour);
      const bookingEnd = Number(booking.endHour);

      if (startHour < bookingEnd && endHour > bookingStart) {
        conflicts.push({
          bookingId: booking.id,
          playerName: booking.name,
          timeRange: booking.slotTime,
          status: booking.status,
        });
      }
    }
    return conflicts;
  } catch (error: any) {
    console.error('Error checking slot conflicts:', error);
    return [];
  }
};

/**
 * Validate a booking before creation/update
 */
export const validateBookingSlot = async (
  locationId: string,
  date: string,
  startHour: number,
  endHour: number,
  userRole: string = 'user',
  courtId?: string,
  excludeBookingId?: string,
  requestedTickets: number = 1,
  maxCapacity: number = 50,
  sport?: string
): Promise<BookingValidationResult> => {
  try {
    if (!locationId || !date || startHour === undefined || endHour === undefined) {
      return { valid: false, error: 'Missing booking parameters' };
    }

    const bookings = await bookingService.getBookings(locationId, date);
    if (!bookings || !Array.isArray(bookings)) return { valid: true };

    const isSwimming = sport === 'Swimming' || sport === 'SWIMMING';
    const capacityLimit = maxCapacity || (isSwimming ? 50 : 10);

    let bookedCount = 0;
    const conflicts: BookingSlotConflict[] = [];

    for (const booking of bookings) {
      if (excludeBookingId && booking.id === excludeBookingId) continue;
      if (courtId && booking.courtId !== courtId) continue;
      if (
        booking.status === BookingStatus.CANCELLED ||
        booking.status === BookingStatus.REJECTED ||
        booking.status === BookingStatus.DECLINED ||
        booking.status === BookingStatus.TIMED_OUT
      ) continue;

      const bookingStart = Number(booking.startHour);
      const bookingEnd = Number(booking.endHour);

      if (startHour < bookingEnd && endHour > bookingStart) {
        const count = Number(booking.currentPlayers) || Number((booking as any).group_size) || 1;
        bookedCount += count;
        conflicts.push({
          bookingId: booking.id,
          playerName: booking.name,
          timeRange: booking.slotTime,
          status: booking.status,
        });
      }
    }

    if (bookedCount + requestedTickets > capacityLimit) {
      if (userRole === 'admin' || userRole === 'superadmin') {
        return { valid: true };
      }

      const spotsLeft = Math.max(0, capacityLimit - bookedCount);
      if (spotsLeft === 0) {
        return { valid: false, error: `This slot is fully booked (${bookedCount}/${capacityLimit}).` };
      }
      return {
        valid: false,
        error: `Only ${spotsLeft} ticket(s) left in this slot (${bookedCount}/${capacityLimit} booked).`,
      };
    }

    return { valid: true };
  } catch (error: any) {
    console.error('Validation Error:', error);
    return { valid: false, error: 'Database verification failed. Please try again.' };
  }
};
