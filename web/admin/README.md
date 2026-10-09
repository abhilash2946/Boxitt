

# Boxitt - AI-Powered Venue Booking System

A modern, full-featured React application for booking sports venues and managing facilities with AI-powered features.

## ✨ Features

- 🔐 **Secure Authentication** - Powered by Supabase Auth
- 📍 **Venue Management** - Browse and book sports venues
- ⭐ **Rating System** - Community-driven venue ratings and reviews
- 💬 **Real-time Chat** - Live team and match communication (Supabase Realtime)
- 🤖 **AI Studio** - AI-powered features using Google Gemini
- 📱 **QR Code Scanner** - Quick check-ins and venue access
- 📊 **Admin Dashboard** - Manage bookings, venues, and availability
- 🎯 **Match Scheduling** - Create and manage sports matches

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** 9+ (comes with Node.js)
- **Supabase Account** (Free tier - [Sign up](https://supabase.com))
- **Google Gemini API Key** (Free tier - [Get key](https://makersuite.google.com/app/apikey))

### 1️⃣ Installation

```bash
# Clone or extract the project
cd boxitt

# Install dependencies
npm install
```

### 2️⃣ Configure Environment

```bash
# Edit .env and add your credentials:
# VITE_SUPABASE_URL=your-supabase-url
# VITE_SUPABASE_ANON_KEY=your-anon-key
# VITE_GEMINI_API_KEY=your-gemini-api-key
```

For detailed setup instructions, see [SETUP.md](SETUP.md).

### 3️⃣ Run Development Server

```bash
npm run dev
```

App runs at `http://localhost:3000`

### 4️⃣ Build for Production

```bash
npm run build
npm run preview
```

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Complete setup guide with Supabase configuration
- **[Database Schema](supabase/migrations/001_create_tables.sql)** - Tables and indexes
- **[RLS Policies](supabase/policies/)** - Security policies

## 🏗️ Project Structure

```
boxitt/
├── components/              # Reusable UI components
│   ├── ChatModal.tsx       # Real-time chat interface
│   ├── RatingModal.tsx     # Rating submission
│   ├── QRCodeModal.tsx     # QR code scanner
│   └── ...
├── pages/                  # Page components
│   ├── LoginPage.tsx       # Authentication
│   ├── BookingPage.tsx     # Venue booking
│   ├── AdminDashboard.tsx  # Admin panel
│   ├── Scanner.tsx         # QR code scanner
│   ├── (removed AIStudio.tsx)
│   └── ...
├── services/               # Business logic layer
│   ├── supabase.ts        # Supabase client
│   ├── authService.ts     # Authentication
│   ├── ratingService.ts   # Rating logic
│   ├── geminiService.ts   # AI features
│   ├── errorHandler.ts    # Error handling
│   └── storage.ts         # Local storage
├── supabase/              # Database scripts
│   ├── migrations/        # SQL migrations
│   └── policies/          # RLS policies
└── ...config files
```

## 🔧 Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React | 19.2.3 |
| **Build Tool** | Vite | 6.2.0 |
| **Language** | TypeScript | 5.8.2 |
| **Styling** | Tailwind CSS | 3.4.14 |
| **Backend** | Supabase | 2.50.0 |
| **Auth** | Supabase Auth | Built-in |
| **Database** | PostgreSQL | Supabase |
| **Realtime** | Supabase Realtime | Built-in |
| **AI** | Google Gemini | API |

## 🆓 Free Services

All services used are completely free with generous limits:

| Service | Free Tier | Link |
|---------|-----------|------|
| Supabase | 500MB DB, Unlimited Auth, Realtime | [supabase.com](https://supabase.com) |
| Google Gemini | Free API with rate limits | [makersuite.google.com](https://makersuite.google.com) |
| React | Open source | [react.dev](https://react.dev) |
| Vite | Open source | [vitejs.dev](https://vitejs.dev) |

## 📝 Available Scripts

```bash
# Development
npm run dev           # Start dev server at localhost:3000

# Production
npm run build        # Build optimized production bundle
npm run preview      # Preview production build locally

# Docker
docker build -t boxitt .
docker run -p 3000:3000 boxitt
```

## 🚢 Deployment Options (All Free)

### Vercel (Recommended)
```bash
npm install -g vercel
vercel login
vercel deploy
```

### Netlify
```bash
npm run build
# Visit netlify.com and drag-drop the dist/ folder
```

### GitHub Pages
```bash
npm run build
# Push to GitHub and enable Pages in repository settings
```

### Docker + Cloud
```bash
docker build -t boxit .
docker push your-registry/boxitt
# Deploy to any container hosting (Firebase Cloud Run, Heroku, DigitalOcean, etc.)
```

## 🔐 Security

- ✅ Row-Level Security (RLS) enabled on all tables
- ✅ User authentication with Supabase Auth
- ✅ Environment variables for sensitive data
- ✅ HTTPS enforced in production
- ✅ Type-safe database queries with TypeScript

## 🐛 Troubleshooting

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules dist
npm cache clean --force
npm install
npm run build
```

### Environment Variables Not Loading
- Ensure `.env` is in project root (same level as `package.json`)
- Restart dev server after changing `.env`
- Prefix all variables with `VITE_` for frontend

### Database Connection Issues
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
- Check Supabase project status in dashboard
- Ensure tables are created (run `supabase/migrations/001_create_tables.sql`)
- Enable RLS policies (run SQL files in `supabase/policies/`)

### Real-time Chat Not Working
- Enable real-time replication in Supabase for `chat_messages` table
- Check browser console for WebSocket errors
- Verify Row-Level Security policies

## 📞 Support

- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://react.dev
- **Vite Docs**: https://vitejs.dev
- **Gemini API**: https://ai.google.dev/docs

## 📄 License

This project is proprietary - Boxitt Venue Booking System

---

**Status**: ✅ Production Ready
**Last Updated**: February 2026
**Next Steps**: See [SETUP.md](SETUP.md) for complete configuration guide
