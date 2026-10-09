# Boxitt - Setup & Deployment Guide

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- A Supabase account (free tier available at https://supabase.com)
- A Google Gemini API key (free tier available at https://makersuite.google.com)

### 1. Clone and Install Dependencies

```bash
cd boxitt
npm install
```

### 2. Set Up Supabase (Free Tier)

1. **Create a Supabase Account**
   - Go to https://supabase.com
   - Sign up with email or GitHub
   - Create a new project (select free tier)
   - Wait for project to initialize (~2 minutes)

2. **Get Your Credentials**
   - In Supabase dashboard, go to **Settings → API**
   - Copy `Project URL` and `Anon Public` key
   - Save these values

3. **Create Environment File**
   Update/create `.env` in the project root.

4. **Add Credentials to .env**
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   VITE_GEMINI_API_KEY=your-gemini-api-key
   ```

5. **Create Database Tables**
   - In Supabase dashboard, go to **SQL Editor**
   - Click **New Query**
   - Copy and paste contents of `supabase/migrations/001_create_tables.sql`
   - Click **Run**

6. **Enable Row Level Security (RLS)**
   - Go to **Authentication → Policies**
   - For each table (ratings, closures, chat_messages):
     - Click the table name
     - Click **New Policy**
     - Copy and paste the corresponding policy from `supabase/policies/`

   **Or run SQL directly:**
   - Go to **SQL Editor → New Query**
   - Paste contents of:
     - `supabase/policies/ratings_rls.sql`
     - `supabase/policies/closures_rls.sql`
     - `supabase/policies/chat_messages_rls.sql`
   - Run each query

7. **Enable Real-time for Chat (Optional but recommended)**
   - Go to **Database → Tables**
   - Click on `chat_messages` table
   - Click **Replication** tab
   - Enable real-time replication
   - This allows live chat updates

### 3. Set Up Gemini API (Free Tier)

1. Go to https://makersuite.google.com/app/apikey
2. Click **Create API Key**
3. Copy the key and add it to `.env`

### 4. Run Development Server

```bash
npm run dev
```

The app will start at `http://localhost:3000`

### 5. Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
boxitt/
├── services/              # API and service layer
│   ├── supabase.ts       # Supabase client (FREE)
│   ├── authService.ts    # Authentication with Supabase
│   ├── ratingService.ts  # Ratings management
│   ├── geminiService.ts  # AI features (Google Gemini)
│   └── storage.ts        # Local storage utilities
├── pages/                # Page components
│   ├── LoginPage.tsx
│   ├── BookingPage.tsx
│   ├── AdminDashboard.tsx
│   ├── Scanner.tsx
│   └── ...
├── components/           # Reusable UI components
│   ├── ChatModal.tsx
│   ├── RatingModal.tsx
│   └── ...
├── supabase/            # Database scripts
│   ├── migrations/      # SQL table creation
│   └── policies/        # Row Level Security
└── vite.config.ts       # Vite configuration
```

## Free Services Used

| Service | Tier | Purpose |
|---------|------|---------|
| **Supabase** | Free (5 GB storage, Auth, Realtime) | PostgreSQL database, Authentication, Real-time APIs |
| **Google Gemini** | Free (limited requests/day) | AI features for studio |
| **Vite** | Free | Fast development and production builds |
| **React** | Free | UI framework |

## Supabase Free Tier Limits

- **Database**: 500 MB storage (auto-expanding to 2GB after payment method added)
- **Auth**: Unlimited users
- **API Requests**: 50,000/month
- **Real-time**: 2 concurrent real-time connections per project

For a small venue booking app, this is more than sufficient.

## Deployment Options (All Free)

### Option 1: Vercel (Recommended)
```bash
npm install -g vercel
vercel login
vercel deploy
```
- Automatic deployments from Git
- Free HTTPS
- 100 GB/month bandwidth (free tier)
- Link: https://vercel.com

### Option 2: GitHub Pages
```bash
npm run build
# Push to GitHub and enable Pages in repo settings
```

### Option 3: Netlify
```bash
npm run build
# Drag and drop the `dist` folder to https://netlify.com
```

### Option 4: Docker + Any Cloud
```bash
# Dockerfile is production-ready
docker build -t boxitt .
docker run -p 3000:3000 boxitt
```

## Environment Variables

### Required for Development
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon public key
- `VITE_GEMINI_API_KEY` - Google Gemini API key

### Optional
- `VITE_ENV` - Set to `production` for production builds

## Database Schema

### ratings table
- id (UUID, primary key)
- location_id (TEXT)
- match_id (TEXT, nullable)
- user_id (TEXT)
- rating (INTEGER 1-5)
- comment (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### closures table
- id (UUID, primary key)
- location_id (TEXT)
- reason (TEXT, nullable)
- start (TIMESTAMP)
- end (TIMESTAMP)
- created_by (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### chat_messages table
- id (UUID, primary key)
- text (TEXT)
- sender_name (TEXT)
- sender_id (TEXT)
- team_id (TEXT, nullable)
- match_id (TEXT, nullable)
- created_at (TIMESTAMP)

## Troubleshooting

### "API key not found"
- Check `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Ensure file is in project root (same level as `package.json`)

### Real-time not working
- Enable real-time replication in Supabase for the table
- Check browser console for WebSocket errors
- Verify RLS policies allow reads

### 401 Unauthorized errors
- Verify user is authenticated (check LoginPage)
- Check RLS policies in Supabase SQL editor
- Test with service_role key temporarily (for debugging only)

### Build errors
- Delete `node_modules` and `dist` folders
- Run `npm install` again
- Clear npm cache: `npm cache clean --force`

## Next Steps

1. ✅ Create Supabase account and project
2. ✅ Set up environment variables
3. ✅ Create database tables and enable RLS
4. ✅ Configure Gemini API key
5. ✅ Run `npm install` and `npm run dev`
6. ✅ Test authentication flow
7. ✅ Deploy to Vercel/Netlify/GitHub Pages

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://react.dev
- **Vite Docs**: https://vitejs.dev
- **Gemini API**: https://makersuite.google.com

## License

Private project - Boxitt Venue Booking System
