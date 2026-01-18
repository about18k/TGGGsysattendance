-- ============================================
-- CLEAR ALL USER DATA - Triple G Attendance
-- Run this in Supabase SQL Editor
-- ============================================

-- Delete all overtime requests
DELETE FROM overtime_requests;

-- Delete all attendance records
DELETE FROM attendance;

-- Delete all todos
DELETE FROM todos;

-- Verify deletion (should return 0 for all)
SELECT 'overtime_requests' as table_name, COUNT(*) as remaining FROM overtime_requests
UNION ALL
SELECT 'attendance' as table_name, COUNT(*) as remaining FROM attendance
UNION ALL
SELECT 'todos' as table_name, COUNT(*) as remaining FROM todos;
