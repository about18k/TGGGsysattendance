-- Create Coordinator Account in Supabase
-- Run these steps in order:

-- STEP 1: Create Auth User in Supabase Dashboard
-- Go to Authentication → Users → Add User
-- Email: triplegotp@gmail.com
-- Password: admin123
-- Auto Confirm User: YES

-- STEP 2: After creating the user, get the user ID
-- Copy the UUID from the Users table

-- STEP 3: Run this SQL to create the profile
-- Replace 'USER_UUID_HERE' with the actual UUID from step 2

INSERT INTO profiles (id, full_name, role) 
VALUES ('USER_UUID_HERE', 'Head Coordinator', 'coordinator');

-- Example (replace with your actual UUID):
-- INSERT INTO profiles (id, full_name, role) 
-- VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Head Coordinator', 'coordinator');

-- STEP 4: Verify the account was created
SELECT u.email, p.full_name, p.role 
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE p.role = 'coordinator';
