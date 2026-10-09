-- Refine box_schedules table for partial closures and recurrence
ALTER TABLE box_schedules DROP CONSTRAINT IF EXISTS box_schedules_closed_option_check;
ALTER TABLE box_schedules ADD COLUMN IF NOT EXISTS closure_type TEXT DEFAULT 'full' CHECK (closure_type IN ('full', 'partial'));

-- Update existing data if any (mapping old values to new structure)
UPDATE box_schedules SET closure_type = 'full', closed_option = 'one_time' WHERE closed_option = 'full_day';
UPDATE box_schedules SET closure_type = 'partial', closed_option = 'one_time' WHERE closed_option = 'specific_time';
UPDATE box_schedules SET closure_type = 'full', closed_option = 'weekly' WHERE closed_option = 'every_week';
UPDATE box_schedules SET closure_type = 'full', closed_option = 'yearly' WHERE closed_option = 'every_year';

-- Add new check constraint for closed_option
ALTER TABLE box_schedules ADD CONSTRAINT box_schedules_closed_option_check CHECK (closed_option IN ('one_time', 'weekly', 'yearly'));
