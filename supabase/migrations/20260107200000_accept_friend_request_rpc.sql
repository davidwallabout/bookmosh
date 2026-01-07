-- Create RPC function to accept friend requests and add users to each other's friends arrays
-- This avoids client-side read/modify/write overwrites when local friends arrays are stale.

CREATE OR REPLACE FUNCTION accept_friend_request(request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fr RECORD;
  v_requester_id UUID;
  v_recipient_id UUID;
  v_requester_username TEXT;
  v_recipient_username TEXT;
BEGIN
  SELECT * INTO fr FROM friend_requests WHERE id = request_id;
  IF fr IS NULL THEN
    RAISE EXCEPTION 'friend_request not found';
  END IF;

  v_requester_id := fr.requester_id;
  v_recipient_id := fr.recipient_id;
  v_requester_username := fr.requester_username;
  v_recipient_username := fr.recipient_username;

  -- Backfill missing ids from usernames (some clients historically only stored usernames)
  IF v_requester_id IS NULL AND v_requester_username IS NOT NULL THEN
    SELECT id INTO v_requester_id FROM users WHERE username = v_requester_username LIMIT 1;
  END IF;

  IF v_recipient_id IS NULL AND v_recipient_username IS NOT NULL THEN
    SELECT id INTO v_recipient_id FROM users WHERE username = v_recipient_username LIMIT 1;
  END IF;

  IF v_requester_id IS NULL OR v_recipient_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve requester/recipient ids';
  END IF;

  -- Only the recipient can accept
  IF auth.uid() IS NULL OR auth.uid() <> v_recipient_id THEN
    RAISE EXCEPTION 'Not authorized to accept this request';
  END IF;

  -- Ensure usernames
  IF v_requester_username IS NULL THEN
    SELECT username INTO v_requester_username FROM users WHERE id = v_requester_id;
  END IF;

  IF v_recipient_username IS NULL THEN
    SELECT username INTO v_recipient_username FROM users WHERE id = v_recipient_id;
  END IF;

  -- Mark request accepted and ensure normalized columns are populated
  UPDATE friend_requests
  SET
    status = 'accepted',
    responded_at = now(),
    requester_id = v_requester_id,
    recipient_id = v_recipient_id,
    requester_username = v_requester_username,
    recipient_username = v_recipient_username
  WHERE id = request_id;

  -- Add recipient to requester's friends
  UPDATE users
  SET friends = (
    SELECT ARRAY(
      SELECT DISTINCT f
      FROM (
        SELECT unnest(COALESCE(users.friends, ARRAY[]::text[])) AS f
        UNION
        SELECT v_recipient_username AS f
      ) s
      WHERE f IS NOT NULL AND f <> ''
    )
  )
  WHERE id = v_requester_id;

  -- Add requester to recipient's friends
  UPDATE users
  SET friends = (
    SELECT ARRAY(
      SELECT DISTINCT f
      FROM (
        SELECT unnest(COALESCE(users.friends, ARRAY[]::text[])) AS f
        UNION
        SELECT v_requester_username AS f
      ) s
      WHERE f IS NOT NULL AND f <> ''
    )
  )
  WHERE id = v_recipient_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_friend_request(UUID) TO authenticated;
