-- Check current late_minutes values in the database
SELECT 
  id,
  date,
  time_in,
  late_minutes,
  status
FROM attendance
WHERE time_in IS NOT NULL
ORDER BY date DESC, time_in;

-- This will show you if the late_minutes are still wrong
-- All records with check-in times like 7:40 AM, 1:03 PM, 12:53 PM, etc. should have late_minutes = 0
