/**
 * Email helper using Supabase Edge Function
 * Avoids CORS issues by proxying email requests through serverless function
 */

import { supabase } from './supabaseClient'

const decodeJwtPayloadSafe = (token) => {
  try {
    const parts = String(token).split('.')
    if (parts.length < 2) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

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

    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!supabaseAnonKey) {
      console.error('[EMAIL] Missing VITE_SUPABASE_ANON_KEY. Needed to call Edge Functions.')
      throw new Error('VITE_SUPABASE_ANON_KEY not configured')
    }

    // Normalize recipients
    const toEmails = normalizeEmails(to)
    if (toEmails.length === 0) {
      console.error('[EMAIL] No valid recipient emails provided')
      throw new Error('No valid recipient emails')
    }

    const recipientEmail = toEmails[0]

    console.log('[EMAIL] Sending via Edge Function:', { 
      type, 
      to: recipientEmail
    })

    // Call Edge Function using anon key (no user session required)
    // The Edge Function validates the request internally
    const { data: result, error } = await supabase.functions.invoke('send-notification-email', {
      body: {
        type,
        to: recipientEmail,
        data,
      },
    })

    if (error) {
      // supabase-js wraps non-2xx responses in FunctionsHttpError; message is generic.
      console.error('[EMAIL] Edge Function error:', error)
      const status = error?.context?.status
      if (status) {
        console.error('[EMAIL] Edge Function HTTP status:', status)
      }
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

export const sendFriendInviteNotification = async (to, data) => {
  return sendWithResend({
    type: 'friend_invite',
    to,
    data,
  })
}

export const sendRecommendationNotification = async (to, data) => {
  return sendWithResend({
    type: 'recommendation',
    to,
    data,
  })
}
