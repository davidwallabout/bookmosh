# Email Notifications Setup Guide

This guide will help you set up email notifications for pit messages, pit invites, and friend requests.

## Prerequisites

1. **Resend API Key**: Already set in Supabase secrets as `RESEND_API_KEY`
2. **Verified sender domain**: `notifications@bookmosh.com` must be verified in Resend
3. **Supabase project**: Access to your Supabase dashboard

## Step 1: Deploy the Edge Function

Deploy the email notification Edge Function:

```bash
supabase functions deploy send-notification-email
```

## Step 2: Set Environment Variables in Supabase

You need to set these as Supabase secrets (not just Edge Function env vars):

```bash
# Set the Resend API key (if not already set)
supabase secrets set RESEND_API_KEY="your_resend_api_key"

# Set your app URL
supabase secrets set APP_URL="https://bookmosh.com"
```

## Step 3: Configure Database Settings

Run this SQL in your Supabase SQL Editor to set up the database configuration:

```sql
-- Set Supabase URL and anon key for the triggers to use
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key';
```

Replace:
- `your-project.supabase.co` with your actual Supabase project URL
- `your-anon-key` with your Supabase anon key (found in Project Settings → API)

## Step 4: Run the Migration

Apply the database triggers by running the migration SQL in Supabase SQL Editor:

```bash
# Copy the contents of supabase/migrations/email_notifications.sql
# and run it in Supabase SQL Editor
```

Or if you have the Supabase CLI set up:

```bash
supabase db push
```

## Step 5: Verify Setup

### Test Pit Message Notification

1. Create a pit with a friend
2. Send a message in the pit
3. Your friend should receive an email notification

### Test Pit Invite Notification

1. Create a new pit
2. Add a friend to the pit
3. Your friend should receive an email notification

### Test Friend Request Notification

1. Send a friend request to another user
2. They should receive an email notification

## Troubleshooting

### Check Edge Function Logs

```bash
supabase functions logs send-notification-email
```

### Check Database Trigger Execution

Run this SQL to see if triggers are firing:

```sql
SELECT * FROM pg_stat_user_functions 
WHERE funcname LIKE 'notify_%';
```

### Common Issues

1. **Emails not sending**: Check that `RESEND_API_KEY` is set correctly
2. **401 errors**: Verify the anon key is correct in database settings
3. **No emails received**: Check that users have email addresses in the `users` table
4. **Sender not verified**: Verify `notifications@bookmosh.com` in Resend dashboard

## Email Templates

The system sends three types of emails:

1. **Pit Message**: Notifies when someone sends a message in a pit you're part of
2. **Pit Invite**: Notifies when you're added to a new pit
3. **Friend Request**: Notifies when someone sends you a friend request

All emails include:
- BookMosh branding with logo
- Clear call-to-action button
- Responsive design for mobile and desktop
- Direct links to the relevant section of the app

## Database Tables Used

- `moshes`: Pit discussions
- `mosh_messages`: Messages in pits
- `friend_requests`: Friend connection requests
- `users`: User profiles with email addresses

## Important Notes

- Emails are only sent to users who have an email address in the `users` table
- The sender of a pit message does NOT receive a notification for their own message
- Friend request emails are only sent when the request status is 'pending'
- All email sending happens asynchronously via database triggers
