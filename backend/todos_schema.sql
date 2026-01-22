-- Updated schema for personal/group/assigned/global todos
-- NOTE: run in Supabase SQL editor with a privileged role.

-- Profiles: ensure leader flag exists
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_leader BOOLEAN DEFAULT FALSE;

-- Groups and membership (one group per member enforced by UNIQUE)
CREATE TABLE IF NOT EXISTS groups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  leader_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- Todos with workflow columns
CREATE TABLE IF NOT EXISTS todos (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  full_name TEXT,
  todo_type TEXT DEFAULT 'personal' CHECK (todo_type IN ('global','group','personal','assigned')),
  group_id BIGINT REFERENCES groups(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_confirmed BOOLEAN DEFAULT FALSE,
  suggested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  pending_completion BOOLEAN DEFAULT FALSE,
  date_assigned TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_group ON todos(group_id);
CREATE INDEX IF NOT EXISTS idx_todos_assigned_to ON todos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todos_type ON todos(todo_type);
CREATE INDEX IF NOT EXISTS idx_todos_created_by ON todos(created_by);

-- RLS: allow access patterns used by the API (coordinator bypass)
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- View policy
CREATE POLICY IF NOT EXISTS "todos_select" ON todos
  FOR SELECT USING (
    todo_type = 'global'
    OR (todo_type = 'personal' AND auth.uid() = user_id)
    OR (todo_type = 'group' AND EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = todos.group_id AND gm.user_id = auth.uid()
    ))
    OR (todo_type = 'assigned' AND (auth.uid() = assigned_to OR auth.uid() = assigned_by))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coordinator')
  );

-- Insert policy
CREATE POLICY IF NOT EXISTS "todos_insert" ON todos
  FOR INSERT WITH CHECK (
    (todo_type = 'personal' AND auth.uid() = user_id)
    OR (todo_type = 'global' AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coordinator'))
    OR (todo_type = 'group' AND EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid()
    ))
    OR (todo_type = 'assigned' AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_leader = TRUE OR p.role = 'coordinator')
    ))
  );

-- Update policy (complete/edit)
CREATE POLICY IF NOT EXISTS "todos_update" ON todos
  FOR UPDATE USING (
    (todo_type = 'personal' AND auth.uid() = user_id)
    OR (todo_type = 'global' AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coordinator'))
    OR (todo_type = 'group' AND (
      EXISTS (SELECT 1 FROM groups g WHERE g.id = todos.group_id AND g.leader_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coordinator')
      OR (is_confirmed = TRUE AND EXISTS (
        SELECT 1 FROM group_members gm WHERE gm.group_id = todos.group_id AND gm.user_id = auth.uid()
      ))
    ))
    OR (todo_type = 'assigned' AND (
      auth.uid() = assigned_by
      OR auth.uid() = assigned_to
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coordinator')
    ))
  );

-- Delete policy
CREATE POLICY IF NOT EXISTS "todos_delete" ON todos
  FOR DELETE USING (
    (todo_type = 'personal' AND auth.uid() = user_id)
    OR (todo_type = 'global' AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coordinator'))
    OR (todo_type = 'group' AND (
      EXISTS (SELECT 1 FROM groups g WHERE g.id = todos.group_id AND g.leader_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coordinator')
    ))
    OR (todo_type = 'assigned' AND (
      auth.uid() = assigned_by
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coordinator')
    ))
  );