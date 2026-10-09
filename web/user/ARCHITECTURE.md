# 🏗️ Project Architecture

## Overview
Boxitt is a React + TypeScript sports booking platform with role-based admin controls, real-time messaging, and cricket scoring.

---

## Directory Structure

```
boxitt/
├── src/                          # Source files (ignore folder)
├── components/                   # React components
│   ├── ChatModal.tsx             # Messaging UI
│   ├── RatingModal.tsx           # Post-booking ratings
│   ├── QRCodeModal.tsx           # QR display
│   ├── GenericScorer.tsx         # Universal scorer
│   └── MessagingExamples.tsx     # Demo components
│
├── pages/                        # Main pages/views
│   ├── LoginPage.tsx             # User authentication
│   ├── LocationSelector.tsx      # Arena selection
│   ├── SportSelector.tsx         # Sport filtering
│   ├── BookingPage.tsx           # Slot booking flow
│   ├── Scanner.tsx               # QR code scanning
│   ├── Scorer.tsx                # Cricket scoring
│   ├── MessagingPage.tsx         # Chat interface
│   ├── AuthCallbackPage.tsx      # Supabase OAuth
│   ├── VerifyOTPPage.tsx         # OTP verification
│   ├── UsernameSetupPage.tsx     # Profile setup
│   └── (removed AIStudio.tsx)
│
├── services/                     # Business logic & API
│   ├── storage.ts                # localStorage wrapper
│   ├── geminiService.ts          # Gemini AI
│   ├── supabase.ts               # Supabase client
│   ├── messagingService.ts       # Chat backend
│   ├── ratingService.ts          # Ratings system
│   ├── authService.ts            # Authentication
│   ├── userService.ts            # User profiles
│   └── errorHandler.ts           # Error tracking
│
├── hooks/                        # Custom React hooks
│   └── useMessaging.ts           # Messaging logic
│
├── supabase/                     # Database configuration
│   ├── migrations/               # SQL migrations
│   └── policies/                 # Row-level security
│
├── App.tsx                       # Root component
├── index.tsx                     # Entry point
├── types.ts                      # TypeScript definitions
├── constants.ts                  # Global constants
├── index.html                    # HTML template
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript config
├── tailwind.config.js            # Tailwind CSS
├── postcss.config.js             # PostCSS config
├── package.json                  # Dependencies
├── manifest.json                 # PWA manifest
├── metadata.json                 # App metadata
├── service-worker.js             # Service worker
├── README.md                     # Getting started
└── SETUP.md                      # Installation guide
```

---

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript 5** - Type safety
- **Vite 6.4** - Build tool
- **Tailwind CSS 3** - Styling
- **PostCSS** - CSS processing

### Backend/Database
- **Supabase** - PostgreSQL + Auth + Real-time
- **localStorage** - Client-side storage
- **Gemini API** - AI image generation

### Testing & Quality
- **Playwright** - E2E testing
- **TypeScript** - Static type checking

### Build & Deployment
- **npm** - Package manager
- **Docker** - Containerization

---

## Data Model

### Core Entities

#### User
```typescript
interface User {
  email: string;
  isLoggedIn: boolean;
  selectedLocationId?: string;
}
```

#### Location (Arena)
```typescript
interface Location {
  id: string;
  name: string;
  address: string;
  imageUrls: string[];
  minAdvance: number;
  supportedSports: SportType[];
}
```

#### Booking
```typescript
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
  checkedIn: boolean;
  createdAt: string;
  bookedBy: 'User' | 'Admin';
  sport: SportType;
  isJoinable: boolean;
  maxPlayers: number;
  currentPlayers: number;
  joinRequests: JoinRequest[];
}
```

#### Cricket Match
```typescript
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
}
```

---

## State Management

### App-Level State (App.tsx)
```typescript
- user: User | null
- selectedLocation: Location | null
- selectedSport: SportType | null
- currentPage: PageType
- history: NavState[]
```

### localStorage Keys
- `boxitt_auth` - User authentication
- `boxitt_locations` - Arenas
- `boxitt_bookings` - All bookings
- `boxitt_pricing` - Price rules
- `boxitt_admin_creds` - Admin credentials
- `boxitt_super_admin_creds` - SuperAdmin credentials

---

## Authentication Flow

### User Authentication
```
1. LoginPage → Enter email
2. VerifyOTPPage → Verify OTP (optional)
3. AuthCallbackPage → Supabase OAuth (optional)
4. UsernameSetupPage → Complete profile
5. App → Authenticated state
```

### Admin Authentication
```
1. AdminDashboard → Click "Login"
2. Enter admin/superadmin credentials
3. Role-based access granted
```

---

## Navigation Flow

```
App (Root)
├── If not logged in → LoginPage
├── If sport not selected → SportSelector
├── If location not selected → LocationSelector
└── If authenticated & location selected
    ├── BookingPage (default)
    ├── AdminDashboard (role-based)
    ├── Scanner
    ├── Scorer
    └── MessagingPage
```

---

## Admin Dashboard Structure

### Four Tabs:
1. **Bookings** - View all bookings by location/date
2. **Locations** - Add/edit/delete arenas
3. **Reports** - Analytics and revenue
4. **Security** - Change admin credentials

### Role Separation:
- **Admin** - Manage single location only
- **SuperAdmin** - Manage all locations

---

## API Integration

### Gemini AI
```typescript
geminiService.generateImage(prompt, size)
geminiService.editImage(imageData, prompt)
```

### Supabase
- Authentication (OAuth + OTP)
- Real-time messaging
- User ratings storage
- Booking sync

### localStorage (Fallback)
- Complete offline support
- Fast access
- Automatic sync with Supabase

---

## Key Features

### Booking System
- ✅ Slot selection (30-min intervals)
- ✅ Peak/off-peak pricing
- ✅ Advance/full payment options
- ✅ Join existing games
- ✅ Admin manual booking

### Admin Controls
- ✅ Dual-role system
- ✅ Location management
- ✅ Manual booking creation
- ✅ Pricing management
- ✅ Booking status updates

### Cricket Scorer
- ✅ Ball-by-ball tracking
- ✅ Batsman management
- ✅ Bowler management
- ✅ Live score updates

### Additional Features
- ✅ QR code generation & scanning
- ✅ Real-time messaging
- ✅ Post-booking ratings
- ✅ AI image generation

---

## Performance Optimization

### Build Output
- **Main bundle**: 503.40 kB (gzip 139.42 kB)
- **Modules**: 98 transformed
- **Build time**: ~35 seconds

### Client-Side
- Component lazy loading
- Image optimization
- Service worker for offline
- Tailwind CSS purging

---

## Security

### Authentication
- Supabase Auth
- OTP verification
- Admin credential system
- Session persistence

### Data Protection
- localStorage encryption (optional)
- HTTPS only
- Row-level security (Supabase)
- Error logging

---

## Development Workflow

### Setup
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
npm run preview
```

### Testing
```bash
npm run test:e2e
npm run test:unit
```

---

## File Naming Conventions

- **Pages**: PascalCase + Page suffix (e.g., `BookingPage.tsx`)
- **Components**: PascalCase (e.g., `ChatModal.tsx`)
- **Services**: camelCase + Service suffix (e.g., `authService.ts`)
- **Hooks**: camelCase + use prefix (e.g., `useMessaging.ts`)
- **Types**: In `types.ts`, PascalCase
- **Constants**: UPPER_SNAKE_CASE in `constants.ts`

---

## Error Handling

All errors logged to `errorHandler` service:
```typescript
import { errorHandler } from './services/errorHandler';
errorHandler.log(error, 'operation-name');
```

---

## Future Improvements

1. **Analytics Dashboard** - User metrics
2. **Automated Pricing** - Dynamic pricing rules
3. **Mobile App** - React Native version
4. **Payment Gateway** - Real payment processing
5. **Video Streaming** - Live match broadcast
6. **Notifications** - Push notifications
