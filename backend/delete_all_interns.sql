-- Delete all intern accounts and related data
-- Run this in Supabase SQL Editor
-- WARNING: This will permanently delete all intern data!

-- Step 1: Delete todos for interns
DELETE FROM todos
WHERE user_id IN (
  SELECT id FROM profiles WHERE role = 'intern'
);

-- Step 2: Delete attendance records for interns
DELETE FROM attendance
WHERE user_id IN (
  SELECT id FROM profiles WHERE role = 'intern'
);

-- Step 3: Delete intern profiles
DELETE FROM profiles
WHERE role = 'intern';

-- Step 4: Delete authentication records for interns
-- Note: You need to delete users from Supabase Authentication panel manually
-- OR use the Supabase Management API
-- Go to: Authentication > Users > Select intern users > Delete

-- To verify deletion, run these queries:
-- SELECT COUNT(*) FROM profiles WHERE role = 'intern';
-- SELECT COUNT(*) FROM attendance;
-- SELECT COUNT(*) FROM todos;
