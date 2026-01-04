-- Make all users friends with each other
-- This creates a full mesh network where everyone is connected

DO $$
DECLARE
  user_record RECORD;
  all_usernames TEXT[];
  other_users TEXT[];
BEGIN
  -- Get all usernames
  SELECT ARRAY_AGG(username) INTO all_usernames
  FROM users
  WHERE username IS NOT NULL AND username != '';

  -- Update each user to have all other users as friends
  FOR user_record IN SELECT id, username FROM users WHERE username IS NOT NULL AND username != ''
  LOOP
    -- Build array of all users except current user
    SELECT ARRAY_AGG(u) INTO other_users
    FROM unnest(all_usernames) AS u
    WHERE u != user_record.username;
    
    UPDATE users
    SET friends = other_users,
        updated_at = NOW()
    WHERE id = user_record.id;
  END LOOP;

  RAISE NOTICE 'Successfully made all users friends with each other';
END $$;
