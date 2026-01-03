-- Enable the pg_net extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to send pit message notification
CREATE OR REPLACE FUNCTION notify_pit_message()
RETURNS TRIGGER AS $$
DECLARE
  pit_record RECORD;
  participant_record RECORD;
  sender_record RECORD;
  message_preview TEXT;
BEGIN
  -- Get pit details
  SELECT * INTO pit_record FROM moshes WHERE id = NEW.mosh_id;
  
  -- Get sender details
  SELECT username, email INTO sender_record 
  FROM users 
  WHERE id = NEW.sender_id;
  
  -- Truncate message for preview
  message_preview := LEFT(NEW.content, 100);
  IF LENGTH(NEW.content) > 100 THEN
    message_preview := message_preview || '...';
  END IF;
  
  -- Send email to all participants except the sender
  FOR participant_record IN 
    SELECT u.email, u.username
    FROM users u
    WHERE u.id = ANY(pit_record.participants_ids)
    AND u.id != NEW.sender_id
    AND u.email IS NOT NULL
  LOOP
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
      ),
      body := jsonb_build_object(
        'type', 'pit_message',
        'to', participant_record.email,
        'data', jsonb_build_object(
          'pitId', pit_record.id,
          'pitTitle', pit_record.mosh_title,
          'senderName', sender_record.username,
          'messagePreview', message_preview
        )
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send pit invite notification
CREATE OR REPLACE FUNCTION notify_pit_invite()
RETURNS TRIGGER AS $$
DECLARE
  pit_record RECORD;
  inviter_record RECORD;
  new_participant_email TEXT;
  new_participant_id UUID;
BEGIN
  -- Get pit details
  SELECT * INTO pit_record FROM moshes WHERE id = NEW.id;
  
  -- Get inviter details (creator of the pit)
  SELECT username INTO inviter_record 
  FROM users 
  WHERE id = pit_record.created_by;
  
  -- Find newly added participants
  IF TG_OP = 'UPDATE' THEN
    -- Get participants that are in NEW but not in OLD
    FOR new_participant_id IN 
      SELECT unnest(NEW.participants_ids)
      EXCEPT
      SELECT unnest(OLD.participants_ids)
    LOOP
      -- Get email for new participant
      SELECT email INTO new_participant_email
      FROM users
      WHERE id = new_participant_id
      AND email IS NOT NULL;
      
      IF new_participant_email IS NOT NULL THEN
        PERFORM net.http_post(
          url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notification-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
          ),
          body := jsonb_build_object(
            'type', 'pit_invite',
            'to', new_participant_email,
            'data', jsonb_build_object(
              'pitId', pit_record.id,
              'pitTitle', pit_record.mosh_title,
              'bookTitle', pit_record.book_title,
              'bookAuthor', pit_record.book_author,
              'inviterName', inviter_record.username
            )
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send friend request notification
CREATE OR REPLACE FUNCTION notify_friend_request()
RETURNS TRIGGER AS $$
DECLARE
  sender_record RECORD;
  recipient_email TEXT;
BEGIN
  -- Only send notification for new friend requests (status = 'pending')
  IF NEW.status = 'pending' THEN
    -- Get sender details
    SELECT username INTO sender_record
    FROM users
    WHERE id = NEW.sender_id;
    
    -- Get recipient email
    SELECT email INTO recipient_email
    FROM users
    WHERE id = NEW.receiver_id
    AND email IS NOT NULL;
    
    IF recipient_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notification-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
        ),
        body := jsonb_build_object(
          'type', 'friend_request',
          'to', recipient_email,
          'data', jsonb_build_object(
            'senderName', sender_record.username
          )
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_notify_pit_message ON mosh_messages;
CREATE TRIGGER trigger_notify_pit_message
  AFTER INSERT ON mosh_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_pit_message();

DROP TRIGGER IF EXISTS trigger_notify_pit_invite ON moshes;
CREATE TRIGGER trigger_notify_pit_invite
  AFTER UPDATE ON moshes
  FOR EACH ROW
  WHEN (OLD.participants_ids IS DISTINCT FROM NEW.participants_ids)
  EXECUTE FUNCTION notify_pit_invite();

DROP TRIGGER IF EXISTS trigger_notify_friend_request ON friend_requests;
CREATE TRIGGER trigger_notify_friend_request
  AFTER INSERT ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_friend_request();
