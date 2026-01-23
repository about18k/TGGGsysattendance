-- Check your specific attendance records
SELECT 
  id,
  date,
  time_in,
  time_out,
  total_minutes_worked,
  late_minutes,
  status
FROM attendance
WHERE date IN ('2026-01-23', '2026-01-22', '2026-01-21', '2026-01-20', '2026-01-19')
  AND time_in IN ('05:59:00', '07:40:00', '12:59:00', '13:03:00', '07:08:00', '12:53:00', '07:46:00', '12:47:00', '06:40:00', '13:01:00')
ORDER BY date DESC, time_in;
