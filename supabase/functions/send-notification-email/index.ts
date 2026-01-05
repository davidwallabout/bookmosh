import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend@2.0.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing RESEND_API_KEY secret on Edge Function' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY secret on Edge Function' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Manual auth check (verify_jwt is disabled in config.toml)
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: missing bearer token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { type, to, data } = await req.json()

    if (!to || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let subject = ''
    let html = ''
    const appUrl = Deno.env.get('APP_URL') || 'https://bookmosh.com'
    const logoUrl = `${appUrl}/bookmosh-vert.png`

    switch (type) {
      case 'pit_message':
        subject = `New message in ${data.pitTitle || 'your pit'}`
        html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0b1225;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b1225; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #141b2d; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1);">
                      <tr>
                        <td align="center" style="padding: 40px 40px 20px;">
                          <img src="${logoUrl}" alt="BookMosh" style="height: 120px; width: auto;">
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 40px 40px;">
                          <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px; font-weight: 600;">New message in your pit</h2>
                          <p style="color: rgba(255, 255, 255, 0.7); font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                            <strong style="color: #ffffff;">${data.senderName}</strong> sent a message in <strong style="color: #ffffff;">${data.pitTitle}</strong>
                          </p>
                          ${data.messagePreview ? `
                            <div style="background-color: rgba(255, 255, 255, 0.05); border-left: 3px solid #a78bfa; padding: 16px; margin: 20px 0; border-radius: 8px;">
                              <p style="color: rgba(255, 255, 255, 0.8); font-size: 14px; line-height: 1.5; margin: 0; font-style: italic;">
                                "${data.messagePreview}"
                              </p>
                            </div>
                          ` : ''}
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px;">
                            <tr>
                              <td align="center">
                                <a href="${appUrl}?mosh=1&moshId=${data.pitId}" style="display: inline-block; background: linear-gradient(135deg, #a78bfa 0%, rgba(255, 255, 255, 0.7) 100%); color: #0b1225; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">
                                  View Pit
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 20px 40px; background-color: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.1);">
                          <p style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin: 0; text-align: center;">
                            You're receiving this because you're part of this pit on BookMosh
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `
        break

      case 'pit_invite':
        subject = `You've been invited to a pit: ${data.pitTitle || 'Book Discussion'}`
        html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0b1225;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b1225; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #141b2d; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1);">
                      <tr>
                        <td align="center" style="padding: 40px 40px 20px;">
                          <img src="${logoUrl}" alt="BookMosh" style="height: 120px; width: auto;">
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 40px 40px;">
                          <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px; font-weight: 600;">You've been invited to a pit!</h2>
                          <p style="color: rgba(255, 255, 255, 0.7); font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                            <strong style="color: #ffffff;">${data.inviterName}</strong> invited you to discuss <strong style="color: #ffffff;">${data.bookTitle}</strong> by ${data.bookAuthor}
                          </p>
                          ${data.pitTitle ? `
                            <p style="color: rgba(255, 255, 255, 0.6); font-size: 14px; margin: 0 0 20px;">
                              Pit: <strong style="color: #a78bfa;">${data.pitTitle}</strong>
                            </p>
                          ` : ''}
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px;">
                            <tr>
                              <td align="center">
                                <a href="${appUrl}?mosh=1&moshId=${data.pitId}" style="display: inline-block; background: linear-gradient(135deg, #a78bfa 0%, rgba(255, 255, 255, 0.7) 100%); color: #0b1225; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">
                                  Join Pit
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 20px 40px; background-color: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.1);">
                          <p style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin: 0; text-align: center;">
                            Start reading and discussing together on BookMosh
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `
        break

      case 'friend_request':
        subject = `${data.senderName} sent you a friend request`
        html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0b1225;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b1225; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #141b2d; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1);">
                      <tr>
                        <td align="center" style="padding: 40px 40px 20px;">
                          <img src="${logoUrl}" alt="BookMosh" style="height: 120px; width: auto;">
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 40px 40px;">
                          <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px; font-weight: 600;">New friend request</h2>
                          <p style="color: rgba(255, 255, 255, 0.7); font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                            <strong style="color: #ffffff;">${data.senderName}</strong> wants to connect with you on BookMosh
                          </p>
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px;">
                            <tr>
                              <td align="center">
                                <a href="${appUrl}#community" style="display: inline-block; background: linear-gradient(135deg, #a78bfa 0%, rgba(255, 255, 255, 0.7) 100%); color: #0b1225; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">
                                  View Request
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 20px 40px; background-color: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.1);">
                          <p style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin: 0; text-align: center;">
                            Connect with friends and share your reading journey on BookMosh
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `
        break

      case 'feed_like':
        subject = `${data.likerName} liked your post`
        html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0b1225;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b1225; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #141b2d; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1);">
                      <tr>
                        <td align="center" style="padding: 40px 40px 20px;">
                          <img src="${logoUrl}" alt="BookMosh" style="height: 120px; width: auto;">
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 40px 40px;">
                          <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px; font-weight: 600;">Someone liked your post!</h2>
                          <p style="color: rgba(255, 255, 255, 0.7); font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                            <strong style="color: #ffffff;">${data.likerName}</strong> liked your addition of <strong style="color: #ffffff;">${data.bookTitle}</strong>${data.bookAuthor ? ` by ${data.bookAuthor}` : ''}
                          </p>
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px;">
                            <tr>
                              <td align="center">
                                <a href="${appUrl}#feed" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, rgba(255, 255, 255, 0.7) 100%); color: #0b1225; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">
                                  View Feed
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 20px 40px; background-color: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.1);">
                          <p style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin: 0; text-align: center;">
                            Keep sharing your reading journey on BookMosh
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid notification type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const { data: emailData, error } = await resend.emails.send({
      from: 'BookMosh <notifications@bookmosh.com>',
      to: [to],
      subject,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailData?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
