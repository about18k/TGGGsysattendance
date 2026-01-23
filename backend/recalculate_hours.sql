-- Recalculate total_minutes_worked with 5-minute grace period
-- Morning: 8:00-8:05 AM grace = count from 8:00 AM, after 8:05 = count from actual time
-- Afternoon: 1:00-1:05 PM grace = count from 1:00 PM, after 1:05 = count from actual time
-- Overtime: 7:00-7:05 PM grace = count from 7:00 PM, after 7:05 = count from actual time

-- Morning session (before 12 PM)
UPDATE attendance
SET total_minutes_worked = CASE
  WHEN time_out IS NULL THEN 0
  WHEN EXTRACT(HOUR FROM time_in::time) * 60 + EXTRACT(MINUTE FROM time_in::time) = 
       EXTRACT(HOUR FROM time_out::time) * 60 + EXTRACT(MINUTE FROM time_out::time) THEN 0
  ELSE GREATEST(0,
    LEAST(EXTRACT(HOUR FROM time_out::time) * 60 + EXTRACT(MINUTE FROM time_out::time), 12 * 60) -
    CASE 
      WHEN EXTRACT(HOUR FROM time_in::time) * 60 + EXTRACT(MINUTE FROM time_in::time) <= 8 * 60 + 5 THEN 8 * 60
      ELSE EXTRACT(HOUR FROM time_in::time) * 60 + EXTRACT(MINUTE FROM time_in::time)
    END
  )
END
WHERE EXTRACT(HOUR FROM time_in::time) < 12;

-- Afternoon session (12 PM - 6 PM)
UPDATE attendance
SET total_minutes_worked = CASE
  WHEN time_out IS NULL THEN 0
  WHEN EXTRACT(HOUR FROM time_in::time) * 60 + EXTRACT(MINUTE FROM time_in::time) = 
       EXTRACT(HOUR FROM time_out::time) * 60 + EXTRACT(MINUTE FROM time_out::time) THEN 0
  ELSE GREATEST(0,
    LEAST(EXTRACT(HOUR FROM time_out::time) * 60 + EXTRACT(MINUTE FROM time_out::time), 17 * 60) -
    CASE 
      WHEN EXTRACT(HOUR FROM time_in::time) * 60 + EXTRACT(MINUTE FROM time_in::time) <= 13 * 60 + 5 THEN 13 * 60
      ELSE EXTRACT(HOUR FROM time_in::time) * 60 + EXTRACT(MINUTE FROM time_in::time)
    END
  )
END
WHERE EXTRACT(HOUR FROM time_in::time) >= 12 
  AND EXTRACT(HOUR FROM time_in::time) < 18;

-- Overtime session (6 PM - 10 PM)
UPDATE attendance
SET total_minutes_worked = CASE
  WHEN time_out IS NULL THEN 0
  WHEN EXTRACT(HOUR FROM time_in::time) * 60 + EXTRACT(MINUTE FROM time_in::time) = 
       EXTRACT(HOUR FROM time_out::time) * 60 + EXTRACT(MINUTE FROM time_out::time) THEN 0
  ELSE GREATEST(0,
    LEAST(EXTRACT(HOUR FROM time_out::time) * 60 + EXTRACT(MINUTE FROM time_out::time), 22 * 60) -
    CASE 
      WHEN EXTRACT(HOUR FROM time_in::time) * 60 + EXTRACT(MINUTE FROM time_in::time) <= 19 * 60 + 5 THEN 19 * 60
      ELSE EXTRACT(HOUR FROM time_in::time) * 60 + EXTRACT(MINUTE FROM time_in::time)
    END
  )
END
WHERE EXTRACT(HOUR FROM time_in::time) >= 18;

-- Verify the fix
SELECT 
  id,
  date,
  time_in,
  time_out,
  total_minutes_worked,
  FLOOR(total_minutes_worked / 60) as hours,
  MOD(total_minutes_worked, 60) as minutes,
  late_minutes,
  status
FROM attendance
WHERE date IN ('2026-01-23', '2026-01-22', '2026-01-21', '2026-01-20', '2026-01-19')
ORDER BY date DESC, time_in;
