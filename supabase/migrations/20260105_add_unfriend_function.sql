-- Create RPC function to unfriend users (removes from both users' friends arrays)
CREATE OR REPLACE FUNCTION unfriend_users(user_a UUID, user_b UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_a_username TEXT;
  user_b_username TEXT;
BEGIN
  -- Get usernames
  SELECT username INTO user_a_username FROM users WHERE id = user_a;
  SELECT username INTO user_b_username FROM users WHERE id = user_b;

  -- Remove user_b's username from user_a's friends array
  UPDATE users
  SET friends = array_remove(friends, user_b_username)
  WHERE id = user_a;

  -- Remove user_a's username from user_b's friends array
  UPDATE users
  SET friends = array_remove(friends, user_a_username)
  WHERE id = user_b;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION unfriend_users(UUID, UUID) TO authenticated;
