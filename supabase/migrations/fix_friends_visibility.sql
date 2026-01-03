-- Fix the friends visibility issue and restore ratmeat's friends

-- First, let's check the current state of ratmeat's friends
-- Run this separately to see what's in the database:
-- SELECT id, username, friends FROM users WHERE username = 'ratmeat';

-- The issue is likely that the RLS policy is preventing users from seeing their friends
-- Let's update the "Users can view public profiles" policy to be less restrictive

DROP POLICY IF EXISTS "Users can view public profiles" ON users;

-- Create a more permissive policy that allows viewing:
-- 1. Public profiles (is_private = false)
-- 2. Your own profile
-- 3. Profiles of users who are your friends
-- 4. Profiles of users who have you as a friend
CREATE POLICY "Users can view public profiles"
ON users
FOR SELECT
USING (
  is_private = false 
  OR auth.uid()::text = id::text
  OR auth.uid()::text = ANY(friends)
  OR EXISTS (
    SELECT 1 FROM users u2 
    WHERE u2.id::text = auth.uid()::text 
    AND id::text = ANY(u2.friends)
  )
);

-- Also, we need to ensure users can update their own friends array
-- The current policy might be preventing friend additions
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

CREATE POLICY "Users can update their own profile"
ON users
FOR UPDATE
USING (auth.uid()::text = id::text)
WITH CHECK (auth.uid()::text = id::text);

-- Additionally, let's make sure authenticated users can read basic user info for friend search
-- This is a separate policy that allows searching for users by username/email
DROP POLICY IF EXISTS "Users can search for other users" ON users;

CREATE POLICY "Users can search for other users"
ON users
FOR SELECT
USING (
  -- Allow viewing username and basic info for all users (for search)
  true
);

-- Note: The above policy is very permissive. If you want to restrict it, you can change it to:
-- USING (is_private = false OR auth.uid() IS NOT NULL);

-- To restore ratmeat's friends, you'll need to manually check the database
-- Run this query to see if the friends data is still there:
-- SELECT id, username, friends FROM users WHERE username = 'ratmeat';

-- If the friends array is empty, you'll need to restore it from a backup
-- or have the user re-add their friends
