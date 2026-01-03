export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Missing RESEND_API_KEY' })
  }

  const { email, inviterName, appUrl, inviteUrl } = req.body

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' })
  }

  const finalAppUrl = appUrl || 'https://www.bookmosh.com'
  const finalInviteUrl = inviteUrl || finalAppUrl
  const logoUrl = `${finalAppUrl.replace(/\/$/, '')}/og-image.png`

  const safeInviter = (inviterName || 'A friend').replace(/[<>&"']/g, '')
  const safeUrl = finalInviteUrl.replace(/[<>&"']/g, '')
  const safeLogo = logoUrl.replace(/[<>&"']/g, '')

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>You're invited to BookMosh</title>
  </head>
  <body style="margin:0;background:#050914;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#ffffff;">
    <div style="max-width:600px;margin:0 auto;padding:32px 18px;">
      <div style="border:1px solid rgba(255,255,255,0.12);border-radius:24px;background:rgba(255,255,255,0.06);padding:26px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
          <img src="${safeLogo}" alt="BookMosh" width="44" height="44" style="border-radius:14px;display:block;" />
          <div>
            <div style="font-size:12px;letter-spacing:0.35em;text-transform:uppercase;color:rgba(255,255,255,0.65);">BookMosh</div>
            <div style="font-size:20px;font-weight:700;line-height:1.15;">You're invited</div>
          </div>
        </div>

        <div style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);">
          <p style="margin:0 0 12px 0;">${safeInviter} invited you to join BookMosh — a cozy place to track what you're reading and share it with friends.</p>
          <p style="margin:0 0 18px 0;">Tap the button below to jump in:</p>
        </div>

        <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(90deg,#7df9ff,rgba(255,255,255,0.75));color:#050914;text-decoration:none;padding:14px 18px;border-radius:16px;font-weight:800;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;">Join BookMosh</a>

        <div style="margin-top:18px;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.55);">
          <div>If the button doesn't work, copy and paste:</div>
          <div style="word-break:break-all;">${safeUrl}</div>
        </div>
      </div>

      <div style="margin-top:14px;text-align:center;font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:0.25em;text-transform:uppercase;">
        See you in the pit
      </div>
    </div>
  </body>
</html>`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BookMosh <invites@bookmosh.com>',  // Change this after verifying bookmosh.com domain in Resend
        to: [email],
        subject: inviterName ? `${inviterName} invited you to BookMosh` : "You're invited to BookMosh",
        html,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: 'Resend send failed', details: data })
    }

    return res.status(200).json({ ok: true, id: data?.id })
  } catch (error) {
    return res.status(500).json({ error: 'Invite send failed', details: error.message })
  }
}
