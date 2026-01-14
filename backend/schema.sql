-- Run this in Supabase SQL Editor

-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('intern', 'coordinator')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create attendance table
CREATE TABLE attendance (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  date DATE NOT NULL,
  time_in TIME,
  time_out TIME,
  ot_time_in TIME,
  ot_time_out TIME,
  status TEXT CHECK(status IN ('On-Time', 'Late')),
  photo_path TEXT,
  work_documentation TEXT,
  late_deduction_hours INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Coordinators can view all profiles" ON profiles
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'coordinator'
  );

-- Attendance policies
CREATE POLICY "Users can view own attendance" ON attendance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attendance" ON attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance" ON attendance
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Coordinators can view all attendance" ON attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'coordinator'
    )
  );

-- Create indexes
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date DESC);
CREATE INDEX idx_attendance_date ON attendance(date DESC);

-- Create todos table
CREATE TABLE todos (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for todos
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create todos policies
CREATE POLICY "Users can view own todos" ON todos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own todos" ON todos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todos" ON todos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todos" ON todos
  FOR DELETE USING (auth.uid() = user_id);
