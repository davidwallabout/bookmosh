-- Final fix for RLS policies - consolidate into single non-conflicting policies

-- Drop ALL existing policies on users table
DROP POLICY IF EXISTS "Users can view public profiles" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can search for other users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Create a single, simple SELECT policy that allows viewing all users
-- This is needed for friend search to work
CREATE POLICY "Allow authenticated users to view all profiles"
ON users
FOR SELECT
TO authenticated
USING (true);

-- Allow users to update only their own profile
CREATE POLICY "Users can update their own profile"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid()::text = id::text)
WITH CHECK (auth.uid()::text = id::text);

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
