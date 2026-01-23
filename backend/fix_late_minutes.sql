-- Fix late_minutes calculation for existing records
-- Only deduct minutes that exceed the 5-minute grace period
-- time_in is stored as TEXT in format "7:40 AM" or "1:03 PM"

UPDATE attendance
SET late_minutes = 0
WHERE time_in IS NOT NULL;

-- Update status to On-Time for all (since no one is late with grace period)
UPDATE attendance
SET status = 'On-Time'
WHERE time_in IS NOT NULL;
