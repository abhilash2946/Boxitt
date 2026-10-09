-- Create the box_schedules table
CREATE TABLE IF NOT EXISTS box_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('green', 'red')),
    closed_option TEXT CHECK (closed_option IN ('full_day', 'specific_time', 'every_week', 'every_year')),
    start_time TEXT,
    end_time TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    -- Ensure one rule per date per location
    UNIQUE(location_id, date)
);

-- Enable Row Level Security
ALTER TABLE box_schedules ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow public read access" ON box_schedules FOR SELECT USING (true);

-- Allow admins/superadmins to manage
CREATE POLICY "Allow admin management" ON box_schedules FOR ALL USING (true);
