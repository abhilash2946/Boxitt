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
    // IMPORTANT: Fetch latest bookings from database
    const bookings = await bookingService.getBookings(locationId, date);
    const conflicts: BookingSlotConflict[] = [];

    if (!bookings || !Array.isArray(bookings)) return [];

    for (const booking of bookings) {
      if (excludeBookingId && booking.id === excludeBookingId) continue;

      // Only check conflicts on the same court
      if (courtId && booking.courtId !== courtId) continue;

      // Only check conflicting statuses
      if (
        booking.status === BookingStatus.CANCELLED ||
        booking.status === BookingStatus.REJECTED ||
        booking.status === BookingStatus.DECLINED ||
        booking.status === BookingStatus.TIMED_OUT
      ) continue;

      const bookingStart = Number(booking.startHour);
      const bookingEnd = Number(booking.endHour);

      // Overlap logic: start < booking.end AND end > booking.start
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
  excludeBookingId?: string
): Promise<BookingValidationResult> => {
  try {
    if (!locationId || !date || startHour === undefined || endHour === undefined) {
      return { valid: false, error: 'Missing booking parameters' };
    }

    // Check for conflicts in real-time database
    const conflicts = await checkSlotConflicts(locationId, date, startHour, endHour, courtId, excludeBookingId);

    if (conflicts.length > 0) {
      // Admins can override
      if (userRole === 'admin' || userRole === 'superadmin') {
        return { valid: true };
      }

      const conflictList = conflicts.map((c) => `${c.playerName} (${c.timeRange})`).join(', ');
      return {
        valid: false,
        error: `Slot already booked by: ${conflictList}`,
      };
    }

    return { valid: true };
  } catch (error: any) {
    console.error('Validation Error:', error);
    return { valid: false, error: 'Database verification failed. Please try again.' };
  }
};
