-- Fix all late_minutes based on grace period rules
-- Morning: 8:05 AM or earlier = 0 late minutes, after 8:05 AM = late
-- Afternoon: 1:05 PM or earlier = 0 late minutes, after 1:05 PM = late

-- First, set all morning session (before 12 PM) to On-Time with 0 late minutes if within grace
UPDATE attendance
SET 
  late_minutes = 0,
  status = 'On-Time'
WHERE time_in IS NOT NULL
  AND EXTRACT(HOUR FROM time_in::time) < 12
  AND (EXTRACT(HOUR FROM time_in::time) < 8 
       OR (EXTRACT(HOUR FROM time_in::time) = 8 AND EXTRACT(MINUTE FROM time_in::time) <= 5));

-- Set morning session LATE (after 8:05 AM)
UPDATE attendance
SET 
  late_minutes = (EXTRACT(HOUR FROM time_in::time) * 60 + EXTRACT(MINUTE FROM time_in::time)) - (8 * 60 + 5),
  status = 'Late'
WHERE time_in IS NOT NULL
  AND EXTRACT(HOUR FROM time_in::time) < 12
  AND (EXTRACT(HOUR FROM time_in::time) > 8 
       OR (EXTRACT(HOUR FROM time_in::time) = 8 AND EXTRACT(MINUTE FROM time_in::time) > 5));

-- Set afternoon session (12 PM - 6 PM) to On-Time with 0 late minutes if within grace
UPDATE attendance
SET 
  late_minutes = 0,
  status = 'On-Time'
WHERE time_in IS NOT NULL
  AND EXTRACT(HOUR FROM time_in::time) >= 12
  AND EXTRACT(HOUR FROM time_in::time) < 18
  AND (EXTRACT(HOUR FROM time_in::time) = 12
       OR (EXTRACT(HOUR FROM time_in::time) = 13 AND EXTRACT(MINUTE FROM time_in::time) <= 5));

-- Set afternoon session LATE (after 1:05 PM)
UPDATE attendance
SET 
  late_minutes = (EXTRACT(HOUR FROM time_in::time) * 60 + EXTRACT(MINUTE FROM time_in::time)) - (13 * 60 + 5),
  status = 'Late'
WHERE time_in IS NOT NULL
  AND EXTRACT(HOUR FROM time_in::time) >= 12
  AND EXTRACT(HOUR FROM time_in::time) < 18
  AND (EXTRACT(HOUR FROM time_in::time) > 13 
       OR (EXTRACT(HOUR FROM time_in::time) = 13 AND EXTRACT(MINUTE FROM time_in::time) > 5));

-- Verify the fix
SELECT 
  id,
  date,
  time_in,
  late_minutes,
  status
FROM attendance
WHERE time_in IS NOT NULL
ORDER BY date DESC, time_in;
