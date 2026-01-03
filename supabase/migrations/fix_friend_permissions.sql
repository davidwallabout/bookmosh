-- Fix RLS policies for friend_requests table to allow users to send friend requests

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can send friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can update friend requests they received" ON friend_requests;
DROP POLICY IF EXISTS "Users can delete their own friend requests" ON friend_requests;

-- Enable RLS on friend_requests table
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view friend requests where they are either requester or recipient
CREATE POLICY "Users can view their own friend requests"
ON friend_requests
FOR SELECT
USING (
  auth.uid()::text = requester_id::text
  OR auth.uid()::text = recipient_id::text
);

-- Policy: Users can send friend requests (insert)
CREATE POLICY "Users can send friend requests"
ON friend_requests
FOR INSERT
WITH CHECK (
  auth.uid()::text = requester_id::text
);

-- Policy: Users can update friend requests they received (accept/decline)
CREATE POLICY "Users can update friend requests they received"
ON friend_requests
FOR UPDATE
USING (
  auth.uid()::text = recipient_id::text
)
WITH CHECK (
  auth.uid()::text = recipient_id::text
);

-- Policy: Users can delete their own sent requests
CREATE POLICY "Users can delete their own friend requests"
ON friend_requests
FOR DELETE
USING (
  auth.uid()::text = requester_id::text
);

-- Also fix users table RLS policies to allow searching for users
DROP POLICY IF EXISTS "Users can view public profiles" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON users
FOR SELECT
USING (auth.uid()::text = id::text);

-- Policy: Users can view public profiles (for friend search)
CREATE POLICY "Users can view public profiles"
ON users
FOR SELECT
USING (
  is_private = false 
  OR auth.uid()::text = id::text
  OR auth.uid()::text = ANY(friends)
);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON users
FOR UPDATE
USING (auth.uid()::text = id::text)
WITH CHECK (auth.uid()::text = id::text);

-- Grant necessary permissions
GRANT SELECT ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON friend_requests TO authenticated;
