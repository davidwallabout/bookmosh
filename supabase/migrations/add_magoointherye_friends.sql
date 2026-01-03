-- Add magoointherye as friend to daveybones and ratmeat (bidirectional)

DO $$
DECLARE
  magoointherye_id TEXT;
  daveybones_id TEXT;
  ratmeat_id TEXT;
BEGIN
  -- Get user IDs
  SELECT id::text INTO magoointherye_id FROM users WHERE username = 'magoointherye';
  SELECT id::text INTO daveybones_id FROM users WHERE username = 'daveybones';
  SELECT id::text INTO ratmeat_id FROM users WHERE username = 'ratmeat';
  
  -- Check if users exist
  IF magoointherye_id IS NULL THEN
    RAISE EXCEPTION 'User magoointherye not found';
  END IF;
  
  IF daveybones_id IS NULL THEN
    RAISE NOTICE 'User daveybones not found, skipping';
  END IF;
  
  IF ratmeat_id IS NULL THEN
    RAISE NOTICE 'User ratmeat not found, skipping';
  END IF;
  
  -- Add daveybones and ratmeat to magoointherye's friends
  UPDATE users
  SET friends = (
    SELECT ARRAY(
      SELECT DISTINCT elem
      FROM unnest(
        COALESCE(friends, ARRAY[]::text[]) || 
        ARRAY[daveybones_id, ratmeat_id]
      ) AS elem
      WHERE elem IS NOT NULL
    )
  )
  WHERE username = 'magoointherye';
  
  -- Add magoointherye to daveybones's friends
  IF daveybones_id IS NOT NULL THEN
    UPDATE users
    SET friends = (
      SELECT ARRAY(
        SELECT DISTINCT elem
        FROM unnest(COALESCE(friends, ARRAY[]::text[]) || ARRAY[magoointherye_id]) AS elem
        WHERE elem IS NOT NULL
      )
    )
    WHERE username = 'daveybones';
  END IF;
  
  -- Add magoointherye to ratmeat's friends (should already be there, but ensure it)
  IF ratmeat_id IS NOT NULL THEN
    UPDATE users
    SET friends = (
      SELECT ARRAY(
        SELECT DISTINCT elem
        FROM unnest(COALESCE(friends, ARRAY[]::text[]) || ARRAY[magoointherye_id]) AS elem
        WHERE elem IS NOT NULL
      )
    )
    WHERE username = 'ratmeat';
  END IF;
  
  RAISE NOTICE 'Successfully updated friend connections for magoointherye';
END $$;

-- Create accepted friend_request records
INSERT INTO friend_requests (requester_id, requester_username, recipient_id, recipient_username, status, created_at)
SELECT 
  m.id, 'magoointherye', f.id, f.username, 'accepted', NOW()
FROM users m
CROSS JOIN users f
WHERE m.username = 'magoointherye'
  AND f.username IN ('daveybones', 'ratmeat')
  AND NOT EXISTS (
    SELECT 1 FROM friend_requests fr
    WHERE (fr.requester_username = 'magoointherye' AND fr.recipient_username = f.username)
       OR (fr.requester_username = f.username AND fr.recipient_username = 'magoointherye')
  )
ON CONFLICT DO NOTHING;

-- Verify the results
SELECT 
  username, 
  friends, 
  array_length(friends, 1) as friend_count
FROM users 
WHERE username IN ('magoointherye', 'daveybones', 'ratmeat')
ORDER BY username;
