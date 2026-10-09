
import { PricingRule, SportType } from './types';

export const PLATFORM_URLS = {
  user: import.meta.env.VITE_USER_URL || 'http://localhost:3000',
  admin: import.meta.env.VITE_ADMIN_URL || 'http://localhost:3001',
  superadmin: import.meta.env.VITE_SUPERADMIN_URL || 'http://localhost:3002',
};

export const PLATFORM_ROLE = 'admin';

export const DURATIONS = ['1 hr', '1.5 hr', '2 hr', '3 hr'];

// Defines the start and end of the booking day
export const DAY_START_HOUR = 6; // 6 AM
export const DAY_END_HOUR = 23;  // 11 PM

export const INITIAL_PRICING: PricingRule[] = [
  { duration: '1 hr', basePricePeak: 800, basePriceOffPeak: 600, active: true },
  { duration: '1.5 hr', basePricePeak: 1100, basePriceOffPeak: 850, active: true },
  { duration: '2 hr', basePricePeak: 1400, basePriceOffPeak: 1100, active: true },
  { duration: '3 hr', basePricePeak: 2000, basePriceOffPeak: 1600, active: true },
];

export const SPORT_CONFIG = {
  [SportType.CRICKET]: {
    capacityOptions: [6, 8, 10, 12, 14, 16],
    squadSizeOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultCapacity: 10
  },
  [SportType.FOOTBALL]: {
    capacityOptions: [10, 12, 14, 16],
    squadSizeOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    defaultCapacity: 10
  },
  [SportType.BADMINTON]: {
    capacityOptions: [2, 4],
    squadSizeOptions: [1, 2, 3],
    defaultCapacity: 4
  },
  [SportType.PICKLEBALL]: {
    capacityOptions: [2, 4],
    squadSizeOptions: [1, 2, 3],
    defaultCapacity: 4
  },
  [SportType.TENNIS]: {
    capacityOptions: [2, 4],
    squadSizeOptions: [1, 2, 3],
    defaultCapacity: 2
  },
  [SportType.BASKETBALL]: {
    capacityOptions: [6, 8, 10],
    squadSizeOptions: [1, 2, 3, 4, 5, 6],
    defaultCapacity: 10
  },
  [SportType.SWIMMING]: {
    capacityOptions: [10, 20, 30, 40, 50, 100],
    squadSizeOptions: [1, 2, 3, 4, 5, 10],
    defaultCapacity: 50
  },
  [SportType.GAME_ZONE]: {
    capacityOptions: [1, 2, 3, 4, 6, 8, 10],
    squadSizeOptions: [1, 2, 3, 4],
    defaultCapacity: 4
  }
};

export const getLocalISODate = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalISODatetime = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};
