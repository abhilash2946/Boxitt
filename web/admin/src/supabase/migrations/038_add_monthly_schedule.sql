-- Add monthly option to box_schedules
ALTER TABLE box_schedules DROP CONSTRAINT IF EXISTS box_schedules_closed_option_check;
ALTER TABLE box_schedules ADD CONSTRAINT box_schedules_closed_option_check CHECK (closed_option IN ('one_time', 'weekly', 'monthly', 'yearly'));
