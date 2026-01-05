/**
 * Email helper using Supabase Edge Function
 * Avoids CORS issues by proxying email requests through serverless function
 */

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
    // Normalize recipients
    const toEmails = normalizeEmails(to)
    if (toEmails.length === 0) {
      console.error('[EMAIL] No valid recipient emails provided')
      throw new Error('No valid recipient emails')
    }

    const recipientEmail = toEmails[0] // Use first email

    // Get Supabase URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) {
      console.error('[EMAIL] No Supabase URL configured')
      throw new Error('VITE_SUPABASE_URL not configured')
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-notification-email`

    console.log('[EMAIL] Sending via Edge Function:', { 
      type, 
      to: recipientEmail
    })

    // Call Supabase Edge Function
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type,
        to: recipientEmail,
        data
      })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('[EMAIL] Edge Function error:', {
        status: response.status,
        error: result
      })
      throw new Error(`Edge Function error: ${result.error || 'Unknown error'}`)
    }

    console.log('[EMAIL] Sent successfully:', {
      emailId: result.emailId,
      to: recipientEmail
    })

    return {
      success: true,
      messageId: result.emailId
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
