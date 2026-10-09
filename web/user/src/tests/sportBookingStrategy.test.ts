import { describe, it, expect } from 'vitest';
import {
  BookingCategory,
  getBookingCategory,
  getSportCapacityRules,
  calculateEffectiveOccupancy
} from '../utils/sportBookingStrategy';
import { SportType } from '../types';

describe('sportBookingStrategy', () => {
  it('correctly identifies COURT_BASED, CAPACITY_BASED, and RESOURCE_BASED categories', () => {
    expect(getBookingCategory(SportType.CRICKET)).toBe(BookingCategory.COURT_BASED);
    expect(getBookingCategory(SportType.FOOTBALL)).toBe(BookingCategory.COURT_BASED);
    expect(getBookingCategory(SportType.TENNIS)).toBe(BookingCategory.COURT_BASED);
    expect(getBookingCategory(SportType.BADMINTON)).toBe(BookingCategory.COURT_BASED);
    expect(getBookingCategory(SportType.PICKLEBALL)).toBe(BookingCategory.COURT_BASED);
    expect(getBookingCategory(SportType.BASKETBALL)).toBe(BookingCategory.COURT_BASED);

    expect(getBookingCategory(SportType.SWIMMING)).toBe(BookingCategory.CAPACITY_BASED);
    expect(getBookingCategory('Swimming')).toBe(BookingCategory.CAPACITY_BASED);

    expect(getBookingCategory(SportType.GAME_ZONE)).toBe(BookingCategory.RESOURCE_BASED);
    expect(getBookingCategory('Game Zone')).toBe(BookingCategory.RESOURCE_BASED);
  });

  it('provides default capacity rules per sport/category', () => {
    const pickleballRules = getSportCapacityRules(SportType.PICKLEBALL);
    expect(pickleballRules.defaultMinPlayers).toBe(2);
    expect(pickleballRules.defaultMaxPlayers).toBe(4);
    expect(pickleballRules.requiresCourtSelection).toBe(true);

    const gameZoneRules = getSportCapacityRules(SportType.GAME_ZONE);
    expect(gameZoneRules.category).toBe(BookingCategory.RESOURCE_BASED);
    expect(gameZoneRules.requiresCourtSelection).toBe(false);
  });

  it('calculates effective occupancy based on category', () => {
    // Court-based uses player count
    expect(calculateEffectiveOccupancy(SportType.CRICKET, 1, 10)).toBe(10);
    expect(calculateEffectiveOccupancy(SportType.PICKLEBALL, 1, 4)).toBe(4);

    // Capacity-based uses requested ticket count
    expect(calculateEffectiveOccupancy(SportType.SWIMMING, 4, 10)).toBe(4);

    // Resource-based maps to 1 resource booked
    expect(calculateEffectiveOccupancy(SportType.GAME_ZONE, 1, 3)).toBe(1);
  });
});
