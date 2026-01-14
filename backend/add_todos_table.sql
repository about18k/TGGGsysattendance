-- Add todos table for intern task management
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS todos (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  task TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Users can manage their own todos
CREATE POLICY "Users can view own todos" ON todos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own todos" ON todos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todos" ON todos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todos" ON todos
  FOR DELETE USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_todos_user ON todos(user_id, created_at DESC);
