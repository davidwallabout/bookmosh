-- Restore friends for magoointherye based on accepted friend requests
-- This rebuilds the friends array from the friend_requests table

UPDATE users
SET friends = (
  SELECT COALESCE(ARRAY_AGG(DISTINCT friend_username), ARRAY[]::text[])
  FROM (
    SELECT CASE 
      WHEN requester_username = 'magoointherye' THEN recipient_username
      ELSE requester_username
    END as friend_username
    FROM friend_requests
    WHERE status = 'accepted'
      AND (requester_username = 'magoointherye' OR recipient_username = 'magoointherye')
  ) subq
  WHERE friend_username IS NOT NULL AND friend_username <> ''
)
WHERE username = 'magoointherye';
