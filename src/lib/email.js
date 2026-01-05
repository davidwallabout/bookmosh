/**
 * Email helper using Resend API
 * Based on the sendWithResend pattern
 */

/**
 * Renders email HTML with proper wrapper and styling
 * Similar to renderEmailHtmlForDelivery
 */
const renderEmailHtml = (content, variables = {}) => {
  // Inject variables into content
  let rendered = content
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g')
    rendered = rendered.replace(regex, variables[key] || '')
  })

  // Wrap in full HTML document
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BookMosh Notification</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b1225;">
      ${rendered}
    </body>
    </html>
  `
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
 * Send email via Resend
 * Core helper following sendWithResend pattern
 */
export const sendWithResend = async ({
  to,
  subject,
  html,
  cc = null,
  replyTo = null,
  variables = {},
  apiKey = null
}) => {
  try {
    // Get API key from env if not provided
    const resendApiKey = apiKey || import.meta.env.VITE_RESEND_API_KEY
    
    if (!resendApiKey) {
      console.error('[EMAIL] No Resend API key configured')
      throw new Error('RESEND_API_KEY not configured')
    }

    // Normalize recipients
    const toEmails = normalizeEmails(to)
    if (toEmails.length === 0) {
      console.error('[EMAIL] No valid recipient emails provided')
      throw new Error('No valid recipient emails')
    }

    const ccEmails = normalizeEmails(cc)
    const replyToEmails = normalizeEmails(replyTo)

    // Render HTML with variables
    const renderedHtml = renderEmailHtml(html, variables)

    // Build payload
    const payload = {
      from: 'BookMosh <notifications@bookmosh.com>',
      to: toEmails,
      subject,
      html: renderedHtml
    }

    if (ccEmails.length > 0) {
      payload.cc = ccEmails
    }

    if (replyToEmails.length > 0) {
      payload.reply_to = replyToEmails[0] // Resend accepts single reply_to
    }

    // Send via Resend API
    console.log('[EMAIL] Sending via Resend:', { 
      type: 'notification', 
      to: toEmails,
      subject 
    })

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('[EMAIL] Resend API error:', {
        status: response.status,
        error: result
      })
      throw new Error(`Resend API error: ${result.message || 'Unknown error'}`)
    }

    console.log('[EMAIL] Sent successfully:', {
      messageId: result.id,
      to: toEmails
    })

    return {
      success: true,
      messageId: result.id
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
 * Email templates
 */
export const emailTemplates = {
  pitMessage: (data) => ({
    subject: `New message in ${data.pitTitle || 'your pit'}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b1225; color: #ffffff; padding: 40px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #a78bfa; font-size: 28px; margin: 0;">BookMosh</h1>
        </div>
        
        <h2 style="color: #ffffff; font-size: 22px; margin-bottom: 16px;">New message in your pit</h2>
        
        <p style="color: #e5e7eb; font-size: 16px; line-height: 1.6;">
          <strong style="color: #a78bfa;">{{senderName}}</strong> sent a message in 
          <strong style="color: #ffffff;">{{pitTitle}}</strong>
        </p>
        
        ${data.messagePreview ? `
          <div style="background-color: rgba(167, 139, 250, 0.1); padding: 20px; border-left: 4px solid #a78bfa; margin: 24px 0; border-radius: 8px;">
            <p style="color: #d1d5db; font-style: italic; margin: 0; font-size: 15px;">"{{messagePreview}}"</p>
          </div>
        ` : ''}
        
        <div style="text-align: center; margin-top: 32px;">
          <a href="{{appUrl}}?mosh=1&moshId={{pitId}}" 
             style="display: inline-block; background: linear-gradient(135deg, #a78bfa 0%, #c4b5fd 100%); color: #0b1225; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(167, 139, 250, 0.3);">
            View Pit
          </a>
        </div>
        
        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center;">
          <p style="color: #9ca3af; font-size: 13px; margin: 0;">
            You're receiving this because you're a participant in this pit.
          </p>
        </div>
      </div>
    `,
    variables: {
      senderName: data.senderName,
      pitTitle: data.pitTitle,
      messagePreview: data.messagePreview || '',
      pitId: data.pitId,
      appUrl: data.appUrl || 'https://bookmosh.com'
    }
  }),

  feedLike: (data) => ({
    subject: `${data.likerName} liked your post`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b1225; color: #ffffff; padding: 40px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #ec4899; font-size: 28px; margin: 0;">BookMosh</h1>
        </div>
        
        <h2 style="color: #ffffff; font-size: 22px; margin-bottom: 16px;">Someone liked your post! 💖</h2>
        
        <p style="color: #e5e7eb; font-size: 16px; line-height: 1.6;">
          <strong style="color: #ec4899;">{{likerName}}</strong> liked your addition of 
          <strong style="color: #ffffff;">{{bookTitle}}</strong>${data.bookAuthor ? ` by {{bookAuthor}}` : ''}
        </p>
        
        <div style="text-align: center; margin-top: 32px;">
          <a href="{{appUrl}}#feed" 
             style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);">
            View Feed
          </a>
        </div>
        
        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center;">
          <p style="color: #9ca3af; font-size: 13px; margin: 0;">
            You're receiving this because someone interacted with your post.
          </p>
        </div>
      </div>
    `,
    variables: {
      likerName: data.likerName,
      bookTitle: data.bookTitle,
      bookAuthor: data.bookAuthor || '',
      appUrl: data.appUrl || 'https://bookmosh.com'
    }
  })
}

/**
 * High-level notification senders
 */
export const sendPitMessageNotification = async (to, data) => {
  const template = emailTemplates.pitMessage(data)
  return sendWithResend({
    to,
    subject: template.subject,
    html: template.html,
    variables: template.variables
  })
}

export const sendFeedLikeNotification = async (to, data) => {
  const template = emailTemplates.feedLike(data)
  return sendWithResend({
    to,
    subject: template.subject,
    html: template.html,
    variables: template.variables
  })
}
