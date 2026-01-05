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

    // Make sure we have a fresh session/token
    // (Expired tokens are a common reason for 401s on Edge Functions)
    try {
      await supabase.auth.refreshSession()
    } catch (err) {
      // Not fatal; we'll still try with whatever session we have.
      console.warn('[EMAIL] refreshSession failed (continuing):', err)
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      console.error('[EMAIL] Failed to read Supabase session:', sessionError)
    }
    const accessToken = sessionData?.session?.access_token
    if (!accessToken) {
      console.error('[EMAIL] No active session. Edge Function requires a signed-in user JWT.')
      throw new Error('Not signed in (missing Supabase session)')
    }

    const jwtPayload = decodeJwtPayloadSafe(accessToken)
    if (jwtPayload) {
      const exp = Number(jwtPayload.exp)
      const now = Math.floor(Date.now() / 1000)
      console.log('[EMAIL] JWT diagnostics:', {
        role: jwtPayload.role,
        exp,
        secondsUntilExpiry: Number.isFinite(exp) ? exp - now : null,
        sub: jwtPayload.sub,
      })
    } else {
      console.warn('[EMAIL] Could not decode JWT payload for diagnostics')
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
      headers: {
        // Use lowercase headers to avoid any gateway/header-normalization issues.
        authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
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
