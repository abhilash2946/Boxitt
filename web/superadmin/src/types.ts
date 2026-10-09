import { ReactNode } from "react";

export interface UserProfile {
  id?: string;
  email: string;
  phone?: string;
  dob?: string;
  gender?: string;
  address?: string;
  profileImage?: string;
  location?: string;
  joinedDate?: string;
  joined_date?: string;
  role?: string;
  display_name?: string;
  phone_number?: string;
  avatar_url?: string;
  username?: string;
  latitude?: number;
  longitude?: number;
}

export enum BookingStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  BOOKED = 'booked',
  CONFIRMED = 'confirmed',
  TIMED_OUT = 'timed_out',
  DECLINED = 'declined'
}

export enum PaymentMethod {
  CASH = 'Cash',
  ONLINE = 'Online'
}

export enum PaymentType {
  FULL = 'full',
  ADVANCE = 'advance'
}

export enum SportType {
  CRICKET = 'Box Cricket',
  FOOTBALL = 'Box Football',
  TENNIS = 'Box Tennis',
  BASKETBALL = 'Box Basketball',
  BADMINTON = 'Box Badminton',
  PICKLEBALL = 'Box Pickleball',
  SWIMMING = 'Swimming',
  GAME_ZONE = 'Game Zone'
}

export const parseSportParam = (param?: string | null): SportType => {
  if (!param) return SportType.CRICKET;
  const clean = param.toLowerCase().replace(/[-_ ]/g, '');
  if (clean.includes('pickle') || clean.includes('pickel')) return SportType.PICKLEBALL;
  if (clean.includes('game') || clean.includes('zone')) return SportType.GAME_ZONE;
  if (clean.includes('swim')) return SportType.SWIMMING;
  if (clean.includes('badminton')) return SportType.BADMINTON;
  if (clean.includes('tennis') || clean.includes('ten')) return SportType.TENNIS;
  if (clean.includes('basket') || clean.includes('harsh')) return SportType.BASKETBALL;
  if (clean.includes('foot') || clean.includes('futsal') || clean.includes('soccer') || clean.includes('cr7')) return SportType.FOOTBALL;
  if (clean.includes('cricket') || clean.includes('ball')) return SportType.CRICKET;
  return SportType.CRICKET;
};

export enum SportCategory {
  COURT_BASED = 'COURT_BASED',
  CAPACITY_BASED = 'CAPACITY_BASED',
  RESOURCE_BASED = 'RESOURCE_BASED',
}

export interface SportCapability {
  category: SportCategory;
  supportsNormalBooking: boolean;
  supportsChallenge: boolean;
  supportsJoinable: boolean;
  requiresCourt: boolean;
  usesCapacity: boolean;
  usesResource: boolean;
  scorerAvailable: boolean;
  minPlayers: number;
  maxPlayers: number;
}

export const SPORT_CAPABILITIES: Record<SportType, SportCapability> = {
  [SportType.CRICKET]: {
    category: SportCategory.COURT_BASED,
    supportsNormalBooking: true,
    supportsChallenge: true,
    supportsJoinable: true,
    requiresCourt: true,
    usesCapacity: false,
    usesResource: false,
    scorerAvailable: true,
    minPlayers: 1,
    maxPlayers: 16,
  },
  [SportType.FOOTBALL]: {
    category: SportCategory.COURT_BASED,
    supportsNormalBooking: true,
    supportsChallenge: true,
    supportsJoinable: true,
    requiresCourt: true,
    usesCapacity: false,
    usesResource: false,
    scorerAvailable: true,
    minPlayers: 1,
    maxPlayers: 16,
  },
  [SportType.TENNIS]: {
    category: SportCategory.COURT_BASED,
    supportsNormalBooking: true,
    supportsChallenge: true,
    supportsJoinable: true,
    requiresCourt: true,
    usesCapacity: false,
    usesResource: false,
    scorerAvailable: true,
    minPlayers: 1,
    maxPlayers: 4,
  },
  [SportType.BADMINTON]: {
    category: SportCategory.COURT_BASED,
    supportsNormalBooking: true,
    supportsChallenge: true,
    supportsJoinable: true,
    requiresCourt: true,
    usesCapacity: false,
    usesResource: false,
    scorerAvailable: true,
    minPlayers: 1,
    maxPlayers: 4,
  },
  [SportType.BASKETBALL]: {
    category: SportCategory.COURT_BASED,
    supportsNormalBooking: true,
    supportsChallenge: true,
    supportsJoinable: true,
    requiresCourt: true,
    usesCapacity: false,
    usesResource: false,
    scorerAvailable: true,
    minPlayers: 1,
    maxPlayers: 10,
  },
  [SportType.PICKLEBALL]: {
    category: SportCategory.COURT_BASED,
    supportsNormalBooking: true,
    supportsChallenge: true,
    supportsJoinable: true,
    requiresCourt: true,
    usesCapacity: false,
    usesResource: false,
    scorerAvailable: true,
    minPlayers: 1,
    maxPlayers: 4,
  },
  [SportType.SWIMMING]: {
    category: SportCategory.CAPACITY_BASED,
    supportsNormalBooking: true,
    supportsChallenge: false,
    supportsJoinable: false,
    requiresCourt: false,
    usesCapacity: true,
    usesResource: false,
    scorerAvailable: false,
    minPlayers: 1,
    maxPlayers: 50,
  },
  [SportType.GAME_ZONE]: {
    category: SportCategory.RESOURCE_BASED,
    supportsNormalBooking: true,
    supportsChallenge: false,
    supportsJoinable: false,
    requiresCourt: false,
    usesCapacity: false,
    usesResource: true,
    scorerAvailable: false,
    minPlayers: 1,
    maxPlayers: 10,
  },
};

export const getSportCapability = (sport: SportType | string): SportCapability => {
  if (!sport) return SPORT_CAPABILITIES[SportType.CRICKET];
  const parsed = typeof sport === 'string' ? parseSportParam(sport) : sport;
  return SPORT_CAPABILITIES[parsed] || SPORT_CAPABILITIES[SportType.CRICKET];
};

export enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K',
}

export interface User {
  joined_date: string;
  location: string;
  id?: string;
  email: string;
  isLoggedIn: boolean;
  selectedLocationId?: string;
  profileImage?: string;
  display_name?: string;
  phone_number?: string;
  role?: string;
  role_status?: string;
  latitude?: number;
  longitude?: number;
  avatar_url?: string;
  address?: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  email: string;
  imageUrls: string[];
  minAdvance: number;
  supportedSports: SportType[];
  latitude?: number;
  longitude?: number;
  open_hour?: number;
  close_hour?: number;
  morning_start?: number;
  morning_end?: number;
  night_start?: number;
  night_end?: number;
  description?: string;
  rating?: number;
  timings?: string;
  contact?: string;
  advanceBookingRequired?: boolean;
  defaultPrice?: number;
  defaultAdvance?: number;
  is_open?: boolean;
  numberOfCourts?: number;
  courts?: Court[];
}

export interface Court {
  id: string;
  locationId: string;
  courtNumber: number;
  name?: string;
  description?: string;
  imageUrls: string[];
  open_hour?: number;
  close_hour?: number;
  morning_start?: number;
  morning_end?: number;
  night_start?: number;
  night_end?: number;
}

export interface Pricing {
  id?: string;
  locationId: string;
  courtId?: string;
  durationHours: number;
  price: number;
  advancePrice?: number;
  label?: string;
  category?: 'morning' | 'night';
  ruleType?: 'default' | 'day' | 'date';
  dayOfWeek?: number;
  specificDate?: string;
  // Snake case fallbacks for Supabase compatibility
  duration_hours?: number;
  rule_type?: 'default' | 'day' | 'date';
  day_of_week?: number;
  specific_date?: string;
  court_id?: string;
  advance_price?: number;
  location_id?: string;
}

export interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  category: 'Morning' | 'Afternoon' | 'Evening';
}

export interface JoinRequest {
  id: string;
  booking_id: string;
  requester_id: string;
  player_name: string;
  phone: string;
  group_size: number;
  status: 'pending' | 'accepted' | 'rejected';
  requester_details?: any;
  requested_at?: string;
  accepted_at?: string;
}

export interface Booking {
  id: string;
  name: string;
  phone: string;
  date: string;
  locationId: string;
  courtId?: string;
  slotId: string;
  slotTime: string;
  startHour: number;
  endHour: number;
  duration: string;
  amount: number;
  advancePaid: number;
  status: BookingStatus;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  utr?: string;
  checkedIn: boolean;
  checkedTime?: string;
  createdAt: string;
  bookedBy: 'User' | 'Admin';
  sport: SportType;
  user_id?: string;
  isJoinable: boolean;
  maxPlayers: number;
  currentPlayers: number;
  auto_delete_at?: string;
  joinRequests: JoinRequest[];
}

export interface PricingRule {
  duration: string;
  basePricePeak: number;
  basePriceOffPeak: number;
  active: boolean;
}

export interface CricketPlayer {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
}

export interface CricketBowler {
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
}

export interface CricketInnings {
  battingTeam: string;
  runs: number;
  wickets: number;
  balls: number;
  overs: number;
  isFreeHit: boolean;
  isNoBallRunPending: boolean;
  extras: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
  };
  batsmen: CricketPlayer[];
  bowlers: CricketBowler[];
  strikerIdx: number;
  nonStrikerIdx: number;
  currentBowlerIdx: number;
  ballByBall: string[];
  nextBatsmanIdx: number;
}

export interface CricketMatch {
  id: string;
  locationId: string;
  teamA: string;
  teamB: string;
  tossWinner: string;
  optedTo: 'Bat' | 'Bowl';
  overs: number;
  innings: CricketInnings[];
  currentInningsIdx: number;
  status: 'Live' | 'Finished';
  createdAt: string;
  finishedAt?: string;
  isExpired?: boolean;
  sport: SportType.CRICKET;
  teamASize: number;
  teamBSize: number;
  teamAPlayers: string[];
  teamBPlayers: string[];
}

export interface Review {
  name: ReactNode;
  id: string;
  location_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  user?: { email: string };
}
