create extension if not exists pg_net;

create or replace function notify_recommendation()
returns trigger as $$
declare
  recipient_email text;
  service_key text;
begin
  service_key := current_setting('app.settings.supabase_service_role_key', true);
  if service_key is null then
    return new;
  end if;

  select email into recipient_email
  from users
  where id = new.recipient_id
    and email is not null;

  if recipient_email is null then
    return new;
  end if;

  perform net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'type', 'recommendation',
      'to', recipient_email,
      'data', jsonb_build_object(
        'senderName', new.sender_username,
        'bookTitle', new.book_title,
        'bookAuthor', new.book_author,
        'note', new.note
      )
    )
  );

  return new;
exception
  when others then
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_notify_recommendation on recommendations;
create trigger trigger_notify_recommendation
  after insert on recommendations
  for each row
  execute function notify_recommendation();
