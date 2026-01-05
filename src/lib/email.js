/**
 * Email helper using Supabase Edge Function
 * Avoids CORS issues by proxying email requests through serverless function
 */

 import { supabase } from './supabaseClient'

/**
 * Normalize email addresses
 * Filters out invalid emails and returns array
 */
const normalizeEmails = (emails) => {
  if (!emails) return []
  const arr = Array.isArray(emails) ? emails : [emails]
  return arr
    .filter(Boolean)
    .filter(email => typeof email === 'string' && email.includes('@'))
    .map(email => email.trim())
}

/**
 * Send email via Supabase Edge Function (which calls Resend)
 * This avoids CORS issues by proxying through a serverless function
 */
export const sendWithResend = async ({
  type,
  to,
  data
}) => {
  try {
    if (!supabase) {
      console.error('[EMAIL] Supabase client not initialized')
      throw new Error('Supabase client not initialized')
    }

    // Normalize recipients
    const toEmails = normalizeEmails(to)
    if (toEmails.length === 0) {
      console.error('[EMAIL] No valid recipient emails provided')
      throw new Error('No valid recipient emails')
    }

    const recipientEmail = toEmails[0] // Use first email

    console.log('[EMAIL] Sending via Edge Function:', { 
      type, 
      to: recipientEmail
    })

    // Call Supabase Edge Function via supabase-js.
    // This automatically attaches the signed-in user's JWT (fixes 401).
    const { data: result, error } = await supabase.functions.invoke('send-notification-email', {
      body: {
        type,
        to: recipientEmail,
        data,
      },
    })

    if (error) {
      console.error('[EMAIL] Edge Function error:', error)
      throw new Error(`Edge Function error: ${error.message || 'Unknown error'}`)
    }

    console.log('[EMAIL] Sent successfully:', {
      emailId: result?.emailId,
      to: recipientEmail,
    })

    return {
      success: true,
      messageId: result?.emailId
    }

  } catch (error) {
    console.error('[EMAIL] Send failed:', {
      error: error.message,
      stack: error.stack
    })
    throw error
  }
}

/**
 * High-level notification senders
 * These call the Edge Function which has the email templates
 */
export const sendPitMessageNotification = async (to, data) => {
  return sendWithResend({
    type: 'pit_message',
    to,
    data
  })
}

export const sendFeedLikeNotification = async (to, data) => {
  return sendWithResend({
    type: 'feed_like',
    to,
    data
  })
}
