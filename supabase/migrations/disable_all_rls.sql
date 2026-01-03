-- Disable RLS on both users and friend_requests tables completely
-- This restores the original working state before we applied any RLS policies

-- ===== USERS TABLE =====
-- Drop all policies on users table
DROP POLICY IF EXISTS "Users can view public profiles" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can search for other users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to view all profiles" ON users;

-- Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- ===== FRIEND_REQUESTS TABLE =====
-- Drop all policies on friend_requests table
DROP POLICY IF EXISTS "Users can view their own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can send friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can update friend requests they received" ON friend_requests;
DROP POLICY IF EXISTS "Users can delete their own friend requests" ON friend_requests;

-- Disable RLS on friend_requests table
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;

-- Verify both tables have RLS disabled
SELECT 
  tablename, 
  rowsecurity,
  CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_tables 
WHERE tablename IN ('users', 'friend_requests') 
  AND schemaname = 'public'
ORDER BY tablename;

-- This should show both tables with rowsecurity = false (DISABLED)
