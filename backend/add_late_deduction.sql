-- Add late_deduction_hours column to attendance table
-- Run this in Supabase SQL Editor if table already exists

ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS late_deduction_hours INTEGER DEFAULT 0;
