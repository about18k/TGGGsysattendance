-- Expand Todos System with Multiple List Types - FIXED VERSION
-- Run this in Supabase SQL Editor

-- 1. Create groups table for team management (FIXED: references profiles)
CREATE TABLE IF NOT EXISTS groups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  leader_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create group_members table (members can only belong to one group) (FIXED: references profiles)
CREATE TABLE IF NOT EXISTS group_members (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id) -- Ensures a user can only be in one group
);

-- 3. Add new columns to existing todos table (FIXED: references profiles)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS todo_type TEXT DEFAULT 'personal' 
  CHECK(todo_type IN ('global', 'group', 'personal', 'assigned'));
ALTER TABLE todos ADD COLUMN IF NOT EXISTS group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT TRUE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS suggested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS pending_completion BOOLEAN DEFAULT FALSE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS date_assigned TIMESTAMP WITH TIME ZONE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS deadline DATE;

-- Add constraints to ensure data integrity
ALTER TABLE todos ADD CONSTRAINT check_assigned_todo_valid 
  CHECK (
    (todo_type = 'assigned' AND assigned_to IS NOT NULL AND assigned_by IS NOT NULL) OR
    (todo_type != 'assigned' AND assigned_to IS NULL AND assigned_by IS NULL)
  );

ALTER TABLE todos ADD CONSTRAINT check_group_todo_valid 
  CHECK (
    (todo_type = 'group' AND group_id IS NOT NULL) OR
    (todo_type != 'group' AND group_id IS NULL)
  );

-- 4. Add is_leader column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_leader BOOLEAN DEFAULT FALSE;

-- 5. Enable RLS on new tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- 6. Drop existing todos policies and recreate with new logic
DROP POLICY IF EXISTS "Users can view own todos" ON todos;
DROP POLICY IF EXISTS "Users can insert own todos" ON todos;
DROP POLICY IF EXISTS "Users can update own todos" ON todos;
DROP POLICY IF EXISTS "Users can delete own todos" ON todos;

-- 7. Create new todos policies (IMPROVED: more secure)
-- View: personal todos, global todos, group todos for group members, assigned todos for assignee
CREATE POLICY "View todos based on type" ON todos
  FOR SELECT USING (
    -- Personal: only owner
    (todo_type = 'personal' AND auth.uid() = user_id) OR
    -- Global: everyone can view
    (todo_type = 'global') OR
    -- Group: group members can view
    (todo_type = 'group' AND EXISTS (
      SELECT 1 FROM group_members WHERE group_id = todos.group_id AND user_id = auth.uid()
    )) OR
    -- Assigned: assignee or assigner can view
    (todo_type = 'assigned' AND (auth.uid() = assigned_to OR auth.uid() = assigned_by))
  );

-- Insert: based on todo type with proper permissions (FIXED: more secure)
CREATE POLICY "Insert todos with permissions" ON todos
  FOR INSERT WITH CHECK (
    -- Personal: only owner can create
    (todo_type = 'personal' AND auth.uid() = user_id) OR
    -- Global: only coordinators can create
    (todo_type = 'global' AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator'
    )) OR
    -- Group: group leaders can create group todos
    (todo_type = 'group' AND EXISTS (
      SELECT 1 FROM groups WHERE id = group_id AND leader_id = auth.uid()
    )) OR
    -- Assigned: can assign to others (not yourself)
    (todo_type = 'assigned' AND auth.uid() = assigned_by AND assigned_to != auth.uid())
  );

-- Update: based on type and role (IMPROVED: assignee can mark complete)
CREATE POLICY "Update todos based on type" ON todos
  FOR UPDATE USING (
    -- Personal: only owner
    (todo_type = 'personal' AND auth.uid() = user_id) OR
    -- Global: coordinator only
    (todo_type = 'global' AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator'
    )) OR
    -- Group: leader can update
    (todo_type = 'group' AND EXISTS (
      SELECT 1 FROM groups WHERE id = todos.group_id AND leader_id = auth.uid()
    )) OR
    -- Assigned: assigner can update any field, assignee can only mark completed
    (todo_type = 'assigned' AND (
      auth.uid() = assigned_by OR 
      (auth.uid() = assigned_to AND (
        (OLD.completed IS DISTINCT FROM NEW.completed) OR
        (OLD.is_confirmed IS DISTINCT FROM NEW.is_confirmed)
      ))
    ))
  );

-- Delete: based on type and role
CREATE POLICY "Delete todos based on type" ON todos
  FOR DELETE USING (
    -- Personal: only owner
    (todo_type = 'personal' AND auth.uid() = user_id) OR
    -- Global: coordinator only
    (todo_type = 'global' AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator'
    )) OR
    -- Group: leader can delete
    (todo_type = 'group' AND EXISTS (
      SELECT 1 FROM groups WHERE id = todos.group_id AND leader_id = auth.uid()
    )) OR
    -- Assigned: assigner can delete
    (todo_type = 'assigned' AND auth.uid() = assigned_by)
  );

-- 8. Groups policies (FIXED: use profiles table)
CREATE POLICY "View groups" ON groups
  FOR SELECT USING (
    -- Members can view their group
    EXISTS (SELECT 1 FROM group_members WHERE group_id = groups.id AND user_id = auth.uid()) OR
    -- Leader can view their group
    leader_id = auth.uid() OR
    -- Coordinators can view all groups
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

CREATE POLICY "Create groups" ON groups
  FOR INSERT WITH CHECK (
    -- Only coordinators or leaders can create groups
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'coordinator' OR is_leader = TRUE))
  );

CREATE POLICY "Update groups" ON groups
  FOR UPDATE USING (
    -- Leaders can update their group
    leader_id = auth.uid() OR
    -- Coordinators can update any group
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

CREATE POLICY "Delete groups" ON groups
  FOR DELETE USING (
    -- Only coordinators can delete groups
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

-- 9. Group members policies (FIXED: use profiles table)
CREATE POLICY "View group members" ON group_members
  FOR SELECT USING (
    -- Members can view their group's members
    EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()) OR
    -- Leaders can view their group's members
    EXISTS (SELECT 1 FROM groups WHERE id = group_members.group_id AND leader_id = auth.uid()) OR
    -- Coordinators can view all
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

CREATE POLICY "Manage group members" ON group_members
  FOR INSERT WITH CHECK (
    -- Leaders can add members to their group
    EXISTS (SELECT 1 FROM groups WHERE id = group_members.group_id AND leader_id = auth.uid()) OR
    -- Coordinators can add members to any group
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

CREATE POLICY "Remove group members" ON group_members
  FOR DELETE USING (
    -- Leaders can remove members from their group
    EXISTS (SELECT 1 FROM groups WHERE id = group_members.group_id AND leader_id = auth.uid()) OR
    -- Coordinators can remove members from any group
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator') OR
    -- Users can remove themselves from groups
    auth.uid() = user_id
  );

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_todos_type ON todos(todo_type);
CREATE INDEX IF NOT EXISTS idx_todos_group ON todos(group_id);
CREATE INDEX IF NOT EXISTS idx_todos_assigned ON todos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_leader ON groups(leader_id);

-- 11. Optional: Add trigger to prevent self-assignment (IMPROVEMENT)
CREATE OR REPLACE FUNCTION prevent_self_assigned_todo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.todo_type = 'assigned' AND NEW.assigned_to = NEW.assigned_by THEN
    RAISE EXCEPTION 'Cannot assign a todo to yourself. Use personal todo type instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_self_assigned ON todos;
CREATE TRIGGER check_self_assigned
  BEFORE INSERT OR UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_assigned_todo();

-- 12. Optional: Add trigger to sync user_id for personal todos (IMPROVEMENT)
CREATE OR REPLACE FUNCTION sync_personal_todo_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.todo_type = 'personal' THEN
    NEW.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_user_id_on_insert ON todos;
CREATE TRIGGER sync_user_id_on_insert
  BEFORE INSERT ON todos
  FOR EACH ROW
  EXECUTE FUNCTION sync_personal_todo_user_id();