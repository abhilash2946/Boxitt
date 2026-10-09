import { SportType } from '../types';

export enum BookingCategory {
  COURT_BASED = 'COURT_BASED',
  CAPACITY_BASED = 'CAPACITY_BASED',
  RESOURCE_BASED = 'RESOURCE_BASED'
}

export interface SportCapacityRule {
  category: BookingCategory;
  defaultMinPlayers: number;
  defaultMaxPlayers: number;
  playerOptions: number[];
  requiresCourtSelection: boolean;
  unitLabel: string;
}

export const SPORT_STRATEGIES: Record<string, SportCapacityRule> = {
  [SportType.CRICKET]: {
    category: BookingCategory.COURT_BASED,
    defaultMinPlayers: 6,
    defaultMaxPlayers: 16,
    playerOptions: [6, 8, 10, 12, 14, 16],
    requiresCourtSelection: true,
    unitLabel: 'court'
  },
  [SportType.FOOTBALL]: {
    category: BookingCategory.COURT_BASED,
    defaultMinPlayers: 10,
    defaultMaxPlayers: 16,
    playerOptions: [10, 12, 14, 16],
    requiresCourtSelection: true,
    unitLabel: 'turf'
  },
  [SportType.TENNIS]: {
    category: BookingCategory.COURT_BASED,
    defaultMinPlayers: 2,
    defaultMaxPlayers: 4,
    playerOptions: [2, 4],
    requiresCourtSelection: true,
    unitLabel: 'court'
  },
  [SportType.BADMINTON]: {
    category: BookingCategory.COURT_BASED,
    defaultMinPlayers: 2,
    defaultMaxPlayers: 4,
    playerOptions: [2, 4],
    requiresCourtSelection: true,
    unitLabel: 'court'
  },
  [SportType.PICKLEBALL]: {
    category: BookingCategory.COURT_BASED,
    defaultMinPlayers: 2,
    defaultMaxPlayers: 4,
    playerOptions: [2, 4],
    requiresCourtSelection: true,
    unitLabel: 'court'
  },
  [SportType.BASKETBALL]: {
    category: BookingCategory.COURT_BASED,
    defaultMinPlayers: 6,
    defaultMaxPlayers: 10,
    playerOptions: [6, 8, 10],
    requiresCourtSelection: true,
    unitLabel: 'court'
  },
  [SportType.SWIMMING]: {
    category: BookingCategory.CAPACITY_BASED,
    defaultMinPlayers: 1,
    defaultMaxPlayers: 50,
    playerOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    requiresCourtSelection: false,
    unitLabel: 'ticket'
  },
  [SportType.GAME_ZONE]: {
    category: BookingCategory.RESOURCE_BASED,
    defaultMinPlayers: 1,
    defaultMaxPlayers: 10,
    playerOptions: [1, 2, 3, 4, 6, 8, 10],
    requiresCourtSelection: false,
    unitLabel: 'station'
  }
};

/**
 * Returns the booking category for a given sport name or SportType
 */
export const getBookingCategory = (sport?: string | SportType): BookingCategory => {
  if (!sport) return BookingCategory.COURT_BASED;
  const normalized = String(sport).trim().toLowerCase();

  if (normalized.includes('game') || normalized.includes('zone')) {
    return BookingCategory.RESOURCE_BASED;
  }
  if (normalized.includes('swimming') || normalized.includes('swim')) {
    return BookingCategory.CAPACITY_BASED;
  }

  const rule = SPORT_STRATEGIES[sport as SportType] || SPORT_STRATEGIES[String(sport)];
  return rule ? rule.category : BookingCategory.COURT_BASED;
};

/**
 * Returns the capacity rule configuration for a sport
 */
export const getSportCapacityRules = (sport?: string | SportType): SportCapacityRule => {
  const category = getBookingCategory(sport);
  const normalized = String(sport || '').trim();

  if (category === BookingCategory.RESOURCE_BASED) {
    return SPORT_STRATEGIES[SportType.GAME_ZONE];
  }
  if (category === BookingCategory.CAPACITY_BASED) {
    return SPORT_STRATEGIES[SportType.SWIMMING];
  }

  return (
    SPORT_STRATEGIES[normalized] ||
    SPORT_STRATEGIES[SportType.CRICKET]
  );
};

/**
 * Calculates effective tickets or occupancy for a booking attempt
 */
export const calculateEffectiveOccupancy = (
  sport: string | SportType,
  requestedTickets: number = 1,
  playersCount: number = 1
): number => {
  const category = getBookingCategory(sport);
  if (category === BookingCategory.CAPACITY_BASED) {
    return Math.max(1, requestedTickets);
  }
  if (category === BookingCategory.RESOURCE_BASED) {
    return 1;
  }
  return Math.max(1, playersCount);
};
