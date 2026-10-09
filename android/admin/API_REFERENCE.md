# 🐛 API Reference

## Storage Service

Provides localStorage-based data persistence with offline support.

### User Management

```typescript
// Get current user
const user = storage.getUser();
// Returns: User | null

// Save user
storage.setUser({ email: 'user@example.com', isLoggedIn: true });

// Logout
storage.logout();
```

---

## Location Management

```typescript
// Get all locations
const locations = storage.getLocations();
// Returns: Location[]

// Save locations
storage.saveLocations([location1, location2]);

// Add single location
const updated = storage.addLocation({
  id: 'loc-3',
  name: 'New Arena',
  address: '123 Main St',
  imageUrls: ['url'],
  minAdvance: 500,
  supportedSports: [SportType.CRICKET]
});

// Delete location
const updated = storage.deleteLocation('loc-1');
```

---

## Booking Management

```typescript
// Get all bookings
const bookings = storage.getBookings();
// Returns: Booking[]

// Save new booking
const booking: Booking = {
  id: 'b-1',
  name: 'John Doe',
  phone: '9999999999',
  date: '2024-02-15',
  locationId: 'loc-1',
  slotId: 'slot-1',
  slotTime: '6:00 AM - 7:00 AM',
  startHour: 6,
  endHour: 7,
  duration: '1 hr',
  amount: 800,
  advancePaid: 400,
  status: BookingStatus.PENDING,
  paymentMethod: PaymentMethod.CASH,
  paymentType: PaymentType.ADVANCE,
  checkedIn: false,
  createdAt: new Date().toISOString(),
  bookedBy: 'User',
  sport: SportType.CRICKET,
  isJoinable: true,
  maxPlayers: 8,
  currentPlayers: 3,
  joinRequests: []
};
storage.saveBooking(booking);

// Update booking
storage.updateBooking('b-1', { status: BookingStatus.APPROVED });

// Check if slot is available
const available = storage.isSlotAvailable('2024-02-15', 'loc-1', 6, 7);
// Returns: boolean
```

---

## Join Requests

```typescript
// Add join request to game
const success = storage.addJoinRequest('b-1', 'Player Name', '9999999999');
// Returns: boolean

// Join request added and automatically accepted
// currentPlayers incremented
// joinRequests updated
```

---

## Pricing Management

```typescript
// Get all pricing rules
const pricing = storage.getPricing();
// Returns: PricingRule[]

// Update pricing
storage.updatePricing([
  {
    duration: '1 hr',
    basePricePeak: 1000,
    basePriceOffPeak: 700,
    active: true
  }
]);
```

---

## Admin Credentials

```typescript
// Get admin credentials
const creds = storage.getAdminCredentials();
// Returns: { username: string, password: string }

// Set admin credentials
storage.setAdminCredentials({
  username: 'newadmin',
  password: 'newpass123'
});

// Get superadmin credentials
const superCreds = storage.getSuperAdminCredentials();
// Returns: { username: string, password: string }

// Set superadmin credentials
storage.setSuperAdminCredentials({
  username: 'newsuper',
  password: 'newpass456'
});

// Legacy methods (password only)
const password = storage.getSuperAdminPassword();
storage.setSuperAdminPassword('newpass789');
```

---

## Gemini Service

AI-powered image generation and editing.

### Generate Image

```typescript
import { geminiService } from './services/geminiService';
import { ImageSize } from './types';

// Generate image from prompt
const imageData = await geminiService.generateImage(
  'A beautiful cricket stadium at sunset',
  ImageSize.SIZE_1K
);
// Returns: base64 image data

// Use in img tag
<img src={`data:image/jpeg;base64,${imageData}`} />
```

### Edit Image

```typescript
// Edit existing image
const editedImage = await geminiService.editImage(
  imageData, // base64
  'Make it more vibrant colors'
);
// Returns: edited base64 image data
```

### Image Sizes

```typescript
ImageSize.SIZE_1K    // Standard quality
ImageSize.SIZE_2K    // High quality
ImageSize.SIZE_4K    // Ultra quality
```

---

## Messaging Service

Real-time chat and messaging.

### Get Messages

```typescript
import { messagingService } from './services/messagingService';

const messages = await messagingService.getMessages(threadId);
// Returns: Message[]
```

### Send Message

```typescript
await messagingService.sendMessage({
  threadId: 'thread-1',
  senderId: 'user-1',
  content: 'Hello!',
  timestamp: new Date()
});
```

### Subscribe to Messages

```typescript
const unsubscribe = messagingService.onMessageReceived(
  threadId,
  (message: Message) => {
    console.log('New message:', message);
  }
);

// Clean up
unsubscribe();
```

---

## Rating Service

Booking reviews and ratings.

### Submit Rating

```typescript
import { ratingService } from './services/ratingService';

await ratingService.submitRating({
  bookingId: 'b-1',
  locationId: 'loc-1',
  userId: 'user-1',
  rating: 5,
  comment: 'Great experience!',
  timestamp: new Date()
});
```

### Get Location Rating

```typescript
const avgRating = await ratingService.getLocationAverageRating('loc-1');
// Returns: number (0-5)

const count = await ratingService.getLocationRatingCount('loc-1');
// Returns: number
```

### Get All Ratings for Location

```typescript
const ratings = await ratingService.getLocationRatings('loc-1');
// Returns: Rating[]
```

---

## Auth Service

User authentication management.

### Login

```typescript
import { authService } from './services/authService';

const user = await authService.login(email, password);
// Returns: User object
```

### Logout

```typescript
await authService.logout();
```

### Verify OTP

```typescript
const verified = await authService.verifyOTP(email, otpCode);
// Returns: boolean
```

---

## User Service

User profile management.

### Get User Profile

```typescript
import { userService } from './services/userService';

const profile = await userService.getUserProfile(userId);
// Returns: UserProfile
```

### Update User Profile

```typescript
await userService.updateUserProfile(userId, {
  displayName: 'John Doe',
  avatar: 'url',
  bio: 'Sports enthusiast'
});
```

---

## Error Handler

Centralized error logging and reporting.

### Log Error

```typescript
import { errorHandler } from './services/errorHandler';

errorHandler.log(error, 'booking-creation');
// Logs error with context
```

### Format Error Message

```typescript
const message = errorHandler.formatMessage(error);
// Returns: user-friendly message
```

---

## Types Reference

### Core Interfaces

```typescript
// User
interface User {
  email: string;
  isLoggedIn: boolean;
  selectedLocationId?: string;
}

// Location
interface Location {
  id: string;
  name: string;
  address: string;
  imageUrls: string[];
  minAdvance: number;
  supportedSports: SportType[];
}

// Booking
interface Booking {
  id: string;
  name: string;
  phone: string;
  date: string;
  locationId: string;
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
  isJoinable: boolean;
  maxPlayers: number;
  currentPlayers: number;
  joinRequests: JoinRequest[];
}

// Pricing Rule
interface PricingRule {
  duration: string;
  basePricePeak: number;
  basePriceOffPeak: number;
  active: boolean;
}

// Cricket Match
interface CricketMatch {
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
}

// Cricket Innings
interface CricketInnings {
  battingTeam: string;
  runs: number;
  wickets: number;
  balls: number;
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
}

// Cricket Player
interface CricketPlayer {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
}

// Cricket Bowler
interface CricketBowler {
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
}

// Join Request
interface JoinRequest {
  playerName: string;
  phone: string;
  status: 'pending' | 'accepted';
}
```

### Enums

```typescript
enum BookingStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
}

enum PaymentMethod {
  CASH = 'Cash',
  ONLINE = 'Online'
}

enum PaymentType {
  FULL = 'full',
  ADVANCE = 'advance'
}

enum SportType {
  CRICKET = 'Box Cricket',
  FOOTBALL = 'Box Football',
  TENNIS = 'Box Tennis',
  BASKETBALL = 'Box Basketball',
  BADMINTON = 'Box Badminton'
}

enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K'
}
```

---

## Constants

```typescript
// Slot durations (hours)
export const DURATIONS = ['1 hr', '1.5 hr', '2 hr', '3 hr'];

// Business hours
export const DAY_START_HOUR = 6;  // 6 AM
export const DAY_END_HOUR = 23;   // 11 PM

// Initial pricing rules
export const INITIAL_PRICING: PricingRule[] = [
  { duration: '1 hr', basePricePeak: 800, basePriceOffPeak: 600, active: true },
  { duration: '1.5 hr', basePricePeak: 1100, basePriceOffPeak: 850, active: true },
  { duration: '2 hr', basePricePeak: 1400, basePriceOffPeak: 1100, active: true },
  { duration: '3 hr', basePricePeak: 2000, basePriceOffPeak: 1600, active: true },
];
```

---

## Example Usage

### Complete Booking Flow

```typescript
import { storage } from './services/storage';
import { BookingStatus, PaymentMethod, PaymentType } from './types';

// 1. Get available locations
const locations = storage.getLocations();

// 2. Check slot availability
const available = storage.isSlotAvailable(
  '2024-02-15',
  'loc-1',
  6,  // 6 AM
  7   // 7 AM
);

if (!available) {
  console.log('Slot not available');
  return;
}

// 3. Create booking
const booking = {
  id: `b-${Date.now()}`,
  name: 'John Doe',
  phone: '9999999999',
  date: '2024-02-15',
  locationId: 'loc-1',
  slotId: 'slot-1',
  slotTime: '6:00 AM - 7:00 AM',
  startHour: 6,
  endHour: 7,
  duration: '1 hr',
  amount: 800,
  advancePaid: 400,
  status: BookingStatus.PENDING,
  paymentMethod: PaymentMethod.CASH,
  paymentType: PaymentType.ADVANCE,
  checkedIn: false,
  createdAt: new Date().toISOString(),
  bookedBy: 'User',
  sport: SportType.CRICKET,
  isJoinable: true,
  maxPlayers: 8,
  currentPlayers: 1,
  joinRequests: []
};

// 4. Save booking
storage.saveBooking(booking);

// 5. Get QR code or confirmation
// (handled by component)
```

---

## Error Handling Pattern

```typescript
try {
  const result = await someService.doSomething();
} catch (error) {
  errorHandler.log(error, 'operation-name');
  
  // Show user-friendly message
  const message = errorHandler.formatMessage(error);
  alert(message);
}
```
