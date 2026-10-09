# 📋 Development Guide

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- Code editor (VS Code recommended)

### Installation
```bash
git clone <repository>
cd boxitt
npm install
npm run dev
```

This starts the development server at `http://localhost:5173`

---

## Project Structure Understanding

### Components Folder
Contains reusable React components:
- `QRCodeModal.tsx` - Displays QR code after booking
- `ChatModal.tsx` - Direct messaging interface
- `RatingModal.tsx` - Post-booking ratings
- `GenericScorer.tsx` - Reusable scoring UI

### Pages Folder
Main application pages/routes:
- **LoginPage.tsx** - Entry point, user authentication
- **SportSelector.tsx** - Choose sport (cricket, football, etc.)
- **LocationSelector.tsx** - Choose venue/arena
- **BookingPage.tsx** - Main booking flow
- **AdminDashboard.tsx** - Admin panel for venue management
- **Scanner.tsx** - QR code scanning for check-in
- **Scorer.tsx** - Cricket match scoring interface

### Services Folder
Business logic and external integrations:
- **storage.ts** - localStorage wrapper (offline data)
- **geminiService.ts** - AI image generation via Gemini API
- **supabase.ts** - Database and real-time sync
- **messagingService.ts** - Chat functionality
- **ratingService.ts** - Review system backend

---

## Common Tasks

### Adding a New Page

1. Create file in `pages/YourPage.tsx`:
```tsx
import React from 'react';

interface YourPageProps {
  location: Location;
  onBack?: () => void;
}

const YourPage: React.FC<YourPageProps> = ({ location, onBack }) => {
  return (
    <div className="p-6">
      <h1>Your Page</h1>
    </div>
  );
};

export default YourPage;
```

2. Add to `App.tsx`:
```tsx
import YourPage from './pages/YourPage';
type PageType = '...' | 'your-page';
// In renderPage():
case 'your-page': return <YourPage location={selectedLocation} onBack={handleBack} />;
```

### Adding a New Component

1. Create file in `components/YourComponent.tsx`:
```tsx
import React from 'react';

interface YourComponentProps {
  title: string;
  onClose?: () => void;
}

const YourComponent: React.FC<YourComponentProps> = ({ title, onClose }) => {
  return <div className="rounded-lg p-4">{title}</div>;
};

export default YourComponent;
```

2. Use in page:
```tsx
import YourComponent from '../components/YourComponent';
// In JSX:
<YourComponent title="Example" />
```

### Adding a Service

1. Create file in `services/yourService.ts`:
```typescript
export const yourService = {
  getData: async (id: string) => {
    // Your logic here
  },
  updateData: (id: string, data: any) => {
    // Your logic here
  }
};
```

2. Use in components:
```typescript
import { yourService } from '../services/yourService';
const data = await yourService.getData('123');
```

### Storing Data Locally

Use the storage service:
```typescript
import { storage } from '../services/storage';

// Get data
const bookings = storage.getBookings();
const locations = storage.getLocations();
const user = storage.getUser();

// Save data
storage.saveBooking(bookingObject);
storage.setUser(userObject);
storage.saveLocations(locationsArray);

// Update data
storage.updateBooking(id, { status: 'approved' });
```

### Using Tailwind CSS

Classes are available for styling:
```tsx
<div className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
  Styled Button
</div>
```

Common utilities:
- `p-4` - padding
- `m-4` - margin
- `w-full` - width: 100%
- `h-12` - height
- `rounded-lg` - border radius
- `shadow-lg` - drop shadow
- `bg-blue-600` - background color
- `text-white` - text color

### Adding Icons

Use inline SVG (example from project):
```tsx
<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
</svg>
```

---

## TypeScript Guide

### Basic Types Used

```typescript
// User
interface User {
  email: string;
  isLoggedIn: boolean;
  selectedLocationId?: string;
}

// Location/Arena
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
  // ... more fields
}

// Enums
enum BookingStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
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
```

### Component Props Pattern

```typescript
interface MyComponentProps {
  location: Location;
  onSelect?: (sport: SportType) => void;
  disabled?: boolean;
  className?: string;
}

const MyComponent: React.FC<MyComponentProps> = ({
  location,
  onSelect,
  disabled = false,
  className = ''
}) => {
  return <div className={className}>...</div>;
};
```

---

## State Management Pattern

```typescript
// Use useState for component state
const [selectedDate, setSelectedDate] = useState<string>('2024-01-01');
const [bookings, setBookings] = useState<Booking[]>([]);
const [loading, setLoading] = useState(false);

// Use useEffect for side effects
useEffect(() => {
  const data = storage.getBookings();
  setBookings(data);
}, []);

// Memoize computed values
const availableSlots = useMemo(() => {
  return generateSlots(selectedDate);
}, [selectedDate]);
```

---

## Admin Dashboard Usage

### Access Admin Panel
1. Click "Admin" button in navigation
2. Enter credentials:
   - **Admin**: username: `admin`, password: `admin`
   - **SuperAdmin**: username: `superadmin`, password: `super123`

### Admin Features
1. **Bookings Tab** - View all bookings, change status, create manual booking
2. **Locations Tab** - Add/edit/delete arenas (SuperAdmin only)
3. **Reports Tab** - View analytics and revenue
4. **Security Tab** - Change your password

### Change Admin Credentials
1. Go to Security tab
2. Enter current password
3. Enter new username and password
4. Click "Update Credentials"

---

## Testing

### Run E2E Tests
```bash
npm run test:e2e
```

### Run Tests in UI Mode
```bash
npm run test:ui
```

### View Test Results
```bash
npm run test:report
```

---

## Debugging

### Console Logging
```typescript
console.log('Value:', value);
console.error('Error:', error);
console.warn('Warning:', warning);
```

### Check localStorage
Open browser DevTools → Application → localStorage:
```
boxitt_auth - Current user
boxitt_bookings - All bookings
boxitt_locations - Arenas
boxitt_pricing - Price rules
boxitt_admin_creds - Admin login
```

### Network Debugging
DevTools → Network tab to inspect API calls and Supabase requests

---

## Performance Tips

1. **Use useMemo** for expensive calculations:
```typescript
const filtered = useMemo(() => {
  return bookings.filter(b => b.date === selectedDate);
}, [bookings, selectedDate]);
```

2. **Use useCallback** for event handlers:
```typescript
const handleClick = useCallback(() => {
  // handler logic
}, [dependency]);
```

3. **Avoid unnecessary re-renders** with React.memo:
```typescript
export default React.memo(MyComponent);
```

4. **Code splitting** - Pages load on demand
5. **Image optimization** - Use Unsplash URLs

---

## Common Issues & Solutions

### Issue: "Cannot find module"
**Solution**: Check import path and file name casing

### Issue: Type errors
**Solution**: Check types.ts for interface definitions

### Issue: Style not applied
**Solution**: Ensure Tailwind CSS is loaded, check class names

### Issue: Data not persisting
**Solution**: Check localStorage in DevTools, verify storage.setUser/saveBooking calls

### Issue: Admin login not working
**Solution**: Default credentials are `admin`/`admin`, check storage for saved credentials

---

## Build & Deployment

### Build for Production
```bash
npm run build
```

Creates `dist/` folder with optimized code.

### Preview Build Locally
```bash
npm run preview
```

Starts local server with production build.

### Deploy to Vercel/Netlify
1. Push code to GitHub
2. Connect repository to Vercel/Netlify
3. Set environment variables (if needed)
4. Deploy

---

## Environment Variables

Create `.env`:
```
VITE_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_KEY=your_supabase_key
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/feature-name

# Make changes
git add .
git commit -m "feat: description"

# Push to GitHub
git push origin feature/feature-name

# Create Pull Request on GitHub
```

---

## Resources

- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)
- [Supabase Docs](https://supabase.com/docs)
- [Gemini API](https://ai.google.dev/)
