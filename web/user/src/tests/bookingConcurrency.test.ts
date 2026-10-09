import { describe, it, expect } from 'vitest';

interface MockBooking {
  id: string;
  courtId: string;
  startHour: number;
  endHour: number;
  currentPlayers: number;
  sport: string;
  status: string;
}

const isSlotOverlapping = (
  existingStart: number,
  existingEnd: number,
  newStart: number,
  newEnd: number
): boolean => {
  return newStart < existingEnd && newEnd > existingStart;
};

const validateCourtSlot = (
  existingBookings: MockBooking[],
  courtId: string,
  startHour: number,
  endHour: number
): { valid: boolean; error?: string } => {
  for (const b of existingBookings) {
    if (b.status === 'cancelled') continue;
    if (b.courtId === courtId && isSlotOverlapping(b.startHour, b.endHour, startHour, endHour)) {
      return { valid: false, error: 'Court slot taken' };
    }
  }
  return { valid: true };
};

const validateSwimmingCapacity = (
  existingBookings: MockBooking[],
  startHour: number,
  endHour: number,
  requestedTickets: number,
  maxCapacity: number = 30
): { valid: boolean; error?: string } => {
  let bookedTotal = 0;
  for (const b of existingBookings) {
    if (b.status === 'cancelled') continue;
    if (isSlotOverlapping(b.startHour, b.endHour, startHour, endHour)) {
      bookedTotal += b.currentPlayers;
    }
  }

  if (bookedTotal + requestedTickets > maxCapacity) {
    return { valid: false, error: `Capacity exceeded (${bookedTotal}/${maxCapacity})` };
  }
  return { valid: true };
};

describe('Booking Validation & Concurrency Business Logic', () => {
  it('detects overlapping slots on the same court', () => {
    const existing: MockBooking[] = [
      { id: '1', courtId: 'court-a', startHour: 10, endHour: 11, currentPlayers: 1, sport: 'Box Cricket', status: 'booked' }
    ];

    // Overlapping slot (10:30 to 11:30)
    const result = validateCourtSlot(existing, 'court-a', 10.5, 11.5);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Court slot taken');
  });

  it('allows adjacent slots on the same court', () => {
    const existing: MockBooking[] = [
      { id: '1', courtId: 'court-a', startHour: 10, endHour: 11, currentPlayers: 1, sport: 'Box Cricket', status: 'booked' }
    ];

    // Adjacent slot (11:00 to 12:00)
    const result = validateCourtSlot(existing, 'court-a', 11, 12);
    expect(result.valid).toBe(true);
  });

  it('allows concurrent slots on different courts', () => {
    const existing: MockBooking[] = [
      { id: '1', courtId: 'court-a', startHour: 10, endHour: 11, currentPlayers: 1, sport: 'Box Cricket', status: 'booked' }
    ];

    // Same time, different court
    const result = validateCourtSlot(existing, 'court-b', 10, 11);
    expect(result.valid).toBe(true);
  });

  it('enforces capacity limits for Swimming ticket bookings', () => {
    const existing: MockBooking[] = [
      { id: '1', courtId: 'pool-main', startHour: 14, endHour: 15, currentPlayers: 25, sport: 'Swimming', status: 'booked' }
    ];

    // Requesting 10 tickets when only 5 remaining (25/30 booked)
    const overflow = validateSwimmingCapacity(existing, 14, 15, 10, 30);
    expect(overflow.valid).toBe(false);
    expect(overflow.error).toContain('Capacity exceeded');

    // Requesting 5 tickets should succeed
    const fits = validateSwimmingCapacity(existing, 14, 15, 5, 30);
    expect(fits.valid).toBe(true);
  });
});
