-- Make all users friends with each other
-- This creates a full mesh network where everyone is connected

DO $$
DECLARE
  user_record RECORD;
  all_usernames TEXT[];
BEGIN
  -- Get all usernames
  SELECT ARRAY_AGG(username) INTO all_usernames
  FROM users
  WHERE username IS NOT NULL AND username != '';

  -- Update each user to have all other users as friends
  FOR user_record IN SELECT id, username FROM users WHERE username IS NOT NULL AND username != ''
  LOOP
    UPDATE users
    SET friends = ARRAY(
      SELECT unnest(all_usernames)
      WHERE unnest != user_record.username
    ),
    updated_at = NOW()
    WHERE id = user_record.id;
  END LOOP;

  RAISE NOTICE 'Successfully made all users friends with each other';
END $$;
