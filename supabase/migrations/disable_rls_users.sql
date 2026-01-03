-- Disable RLS on users table to restore original working state
-- This removes all the restrictive policies that were causing permission errors

-- Drop all policies on users table
DROP POLICY IF EXISTS "Users can view public profiles" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can search for other users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to view all profiles" ON users;

-- Disable RLS entirely on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- This should show rowsecurity = false
