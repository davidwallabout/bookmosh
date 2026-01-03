-- Restore ratmeat's friends: daveybones, dixiecarroll, and cusack10
-- This creates bidirectional friendships (both users have each other in their friends array)

-- First, get the user IDs we need
DO $$
DECLARE
  ratmeat_id TEXT;
  daveybones_id TEXT;
  dixiecarroll_id TEXT;
  cusack10_id TEXT;
BEGIN
  -- Get ratmeat's ID
  SELECT id::text INTO ratmeat_id FROM users WHERE username = 'ratmeat';
  
  -- Get friend IDs
  SELECT id::text INTO daveybones_id FROM users WHERE username = 'daveybones';
  SELECT id::text INTO dixiecarroll_id FROM users WHERE username = 'dixiecarroll';
  SELECT id::text INTO cusack10_id FROM users WHERE username = 'cusack10';
  
  -- Check if all users exist
  IF ratmeat_id IS NULL THEN
    RAISE EXCEPTION 'User ratmeat not found';
  END IF;
  
  IF daveybones_id IS NULL THEN
    RAISE NOTICE 'User daveybones not found, skipping';
  END IF;
  
  IF dixiecarroll_id IS NULL THEN
    RAISE NOTICE 'User dixiecarroll not found, skipping';
  END IF;
  
  IF cusack10_id IS NULL THEN
    RAISE NOTICE 'User cusack10 not found, skipping';
  END IF;
  
  -- Update ratmeat's friends array to include all three friends
  UPDATE users
  SET friends = (
    SELECT ARRAY(
      SELECT DISTINCT elem
      FROM unnest(
        COALESCE(friends, ARRAY[]::text[]) || 
        ARRAY[daveybones_id, dixiecarroll_id, cusack10_id]
      ) AS elem
      WHERE elem IS NOT NULL
    )
  )
  WHERE username = 'ratmeat';
  
  -- Update daveybones to include ratmeat as friend
  IF daveybones_id IS NOT NULL THEN
    UPDATE users
    SET friends = (
      SELECT ARRAY(
        SELECT DISTINCT elem
        FROM unnest(COALESCE(friends, ARRAY[]::text[]) || ARRAY[ratmeat_id]) AS elem
        WHERE elem IS NOT NULL
      )
    )
    WHERE username = 'daveybones';
  END IF;
  
  -- Update dixiecarroll to include ratmeat as friend
  IF dixiecarroll_id IS NOT NULL THEN
    UPDATE users
    SET friends = (
      SELECT ARRAY(
        SELECT DISTINCT elem
        FROM unnest(COALESCE(friends, ARRAY[]::text[]) || ARRAY[ratmeat_id]) AS elem
        WHERE elem IS NOT NULL
      )
    )
    WHERE username = 'dixiecarroll';
  END IF;
  
  -- Update cusack10 to include ratmeat as friend
  IF cusack10_id IS NOT NULL THEN
    UPDATE users
    SET friends = (
      SELECT ARRAY(
        SELECT DISTINCT elem
        FROM unnest(COALESCE(friends, ARRAY[]::text[]) || ARRAY[ratmeat_id]) AS elem
        WHERE elem IS NOT NULL
      )
    )
    WHERE username = 'cusack10';
  END IF;
  
  RAISE NOTICE 'Successfully updated friend connections';
END $$;

-- Verify the updates
SELECT 
  username, 
  friends, 
  array_length(friends, 1) as friend_count
FROM users 
WHERE username IN ('ratmeat', 'daveybones', 'dixiecarroll', 'cusack10')
ORDER BY username;

-- Also create accepted friend_requests records so the system knows they're connected
-- This prevents duplicate friend requests in the future

-- Insert friend request records (if they don't already exist)
INSERT INTO friend_requests (requester_id, requester_username, recipient_id, recipient_username, status, created_at)
SELECT 
  r.id,
  'ratmeat',
  f.id,
  f.username,
  'accepted',
  NOW()
FROM users r
CROSS JOIN users f
WHERE r.username = 'ratmeat'
  AND f.username IN ('daveybones', 'dixiecarroll', 'cusack10')
  AND NOT EXISTS (
    SELECT 1 FROM friend_requests fr
    WHERE (
      (fr.requester_username = 'ratmeat' AND fr.recipient_username = f.username)
      OR (fr.requester_username = f.username AND fr.recipient_username = 'ratmeat')
    )
  )
ON CONFLICT DO NOTHING;

-- Verify friend_requests
SELECT 
  requester_username,
  recipient_username,
  status,
  created_at
FROM friend_requests
WHERE (requester_username = 'ratmeat' OR recipient_username = 'ratmeat')
  AND status = 'accepted'
ORDER BY created_at DESC;
