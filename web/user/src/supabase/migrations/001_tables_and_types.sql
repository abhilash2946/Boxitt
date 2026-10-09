-- =============================================================================
-- MIGRATION 001: Tables and Types
-- Description: Rebuilding the full project object model.
-- =============================================================================

-- =============================================================================
-- TABLE: users
-- Custom public user manifest.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          TEXT NOT NULL UNIQUE,
    created_at     TIMESTAMPTZ DEFAULT now(),
    role           TEXT DEFAULT 'user',
    role_status    TEXT DEFAULT 'approved',
    requested_role TEXT
);

-- =============================================================================
-- TABLE: user_profiles
-- Profile details and metadata.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id             UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    username       TEXT UNIQUE,
    display_name   TEXT,
    email          TEXT,
    role           TEXT DEFAULT 'user',
    role_status    TEXT DEFAULT 'approved',
    requested_role TEXT,
    avatar_url     TEXT,
    bio            TEXT,
    phone_number   TEXT,
    dob            TEXT,
    gender         TEXT,
    address        TEXT,
    location       TEXT,
    joined_date    TEXT,
    latitude       DOUBLE PRECISION,
    longitude      DOUBLE PRECISION,
    rating         REAL DEFAULT 0,
    average_rating REAL DEFAULT 0,
    review_count   INTEGER DEFAULT 0,
    updated_at     TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- TABLE: locations
-- Venue and Sports Arena information.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    address     TEXT NOT NULL,
    city        TEXT NOT NULL,
    state       TEXT NOT NULL,
    zip_code    TEXT NOT NULL,
    phone       TEXT,
    email       TEXT,
    website     TEXT,
    image_url   TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    latitude    DOUBLE PRECISION,
    longitude   DOUBLE PRECISION,
    open_hour   INTEGER DEFAULT 6,
    close_hour  INTEGER DEFAULT 23,
    min_advance INTEGER DEFAULT 0,
    advance_booking_required BOOLEAN DEFAULT FALSE,
    average_rating REAL DEFAULT 0,
    timings     TEXT
);

-- =============================================================================
-- TABLE: admin_accounts
-- Arena-specific administrator access.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_accounts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    email         TEXT,
    password      TEXT NOT NULL,
    location_id   UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    is_superadmin BOOLEAN DEFAULT false,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- TABLE: bookings
-- Core match scheduling and joinable games.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
    id              TEXT PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE, -- Host user
    booked_by       TEXT, -- Optional legacy field
    sport           TEXT,
    is_joinable     BOOLEAN DEFAULT false,
    max_players     INTEGER DEFAULT 10,
    current_players INTEGER DEFAULT 1,
    auto_delete_at  TIMESTAMPTZ,
    location_id     UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    start_hour      DOUBLE PRECISION,
    end_hour        DOUBLE PRECISION,
    date            TEXT,
    slot_time       TEXT
);

-- =============================================================================
-- TABLE: box_pricing
-- Pricing strategy for locations.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.box_pricing (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id   UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    advance_price NUMERIC DEFAULT 5.0,
    duration_hours NUMERIC(4, 2),
    price         NUMERIC(10, 2),
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE(location_id, duration_hours)
);

-- =============================================================================
-- TABLE: closures
-- Time blocks where locations are unavailable.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.closures (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    reason      TEXT,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLE: challenges
-- Player-to-player match requests.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.challenges (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id  UUID REFERENCES public.users(id),
    target_id      UUID REFERENCES public.users(id),
    status         TEXT DEFAULT 'active',
    created_at     TIMESTAMPTZ DEFAULT now(),
    date           TEXT,
    slot_time      TEXT,
    start_hour     DOUBLE PRECISION,
    end_hour       DOUBLE PRECISION,
    booking_id     UUID,
    updated_at     TIMESTAMPTZ DEFAULT now(),
    accepted_by    UUID REFERENCES public.users(id),
    auto_delete_at TIMESTAMPTZ
);

-- =============================================================================
-- TABLE: chat_messages
-- Communication for joinable matches.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id  UUID REFERENCES public.users(id),
    message    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    booking_id TEXT
);

-- =============================================================================
-- TABLE: join_requests
-- Relational storage for squad join requests.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.join_requests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id        TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    requester_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    player_name       TEXT NOT NULL,
    phone             TEXT,
    group_size        INTEGER DEFAULT 1,
    status            TEXT DEFAULT 'pending',
    requester_details JSONB DEFAULT '{}'::jsonb,
    requested_at      TIMESTAMPTZ DEFAULT now(),
    accepted_at       TIMESTAMPTZ
);

-- =============================================================================
-- TABLE: notifications
-- User notification engine.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    message    TEXT NOT NULL,
    is_read    BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    type       TEXT DEFAULT 'info',
    target_url TEXT
);

-- =============================================================================
-- TABLE: ratings & reviews
-- Feedback for locations and players.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ratings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rating     INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment    TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- TABLE: audit_log & audit_logs
-- Compliance and tracking logs.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES public.users(id),
    action      TEXT NOT NULL,
    table_name  TEXT,
    record_id   UUID,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    old_values    JSONB,
    new_values    JSONB,
    ip_address    INET,
    user_agent    TEXT,
    status        TEXT NOT NULL,
    error_message TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);
