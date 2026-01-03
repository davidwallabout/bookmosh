import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })

const readJson = async (req: Request) => {
  try {
    return await req.json()
  } catch {
    return null
  }
}

const normalizeEmail = (value: unknown) => String(value ?? '').trim().toLowerCase()

const escapeHtml = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const buildInviteHtml = ({
  inviterName,
  inviteUrl,
  logoUrl,
}: {
  inviterName: string
  inviteUrl: string
  logoUrl: string
}) => {
  const safeInviter = escapeHtml(inviterName || 'A friend')
  const safeUrl = escapeHtml(inviteUrl)
  const safeLogo = escapeHtml(logoUrl)

  return `<!doctype html>
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
            <div style="font-size:20px;font-weight:700;line-height:1.15;">You’re invited</div>
          </div>
        </div>

        <div style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);">
          <p style="margin:0 0 12px 0;">${safeInviter} invited you to join BookMosh — a cozy place to track what you’re reading and share it with friends.</p>
          <p style="margin:0 0 18px 0;">Tap the button below to jump in:</p>
        </div>

        <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(90deg,#7df9ff,rgba(255,255,255,0.75));color:#050914;text-decoration:none;padding:14px 18px;border-radius:16px;font-weight:800;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;">Join BookMosh</a>

        <div style="margin-top:18px;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.55);">
          <div>If the button doesn’t work, copy and paste:</div>
          <div style="word-break:break-all;">${safeUrl}</div>
        </div>
      </div>

      <div style="margin-top:14px;text-align:center;font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:0.25em;text-transform:uppercase;">
        See you in the mosh
      </div>
    </div>
  </body>
</html>`
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' }, { Allow: 'POST, OPTIONS' })
  }

  const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get?.('RESEND_API_KEY') ?? ''
  if (!RESEND_API_KEY) {
    return json(500, { error: 'Missing RESEND_API_KEY secret' })
  }

  const body = await readJson(req)
  const toEmail = normalizeEmail(body?.email)
  const inviterName = String(body?.inviterName ?? '').trim()

  if (!toEmail || !toEmail.includes('@') || toEmail.length > 254) {
    return json(400, { error: 'Invalid email' })
  }

  const appUrl = String(body?.appUrl ?? '').trim() || 'https://www.bookmosh.com'
  const inviteUrl = String(body?.inviteUrl ?? '').trim() || appUrl
  const logoUrl = String(body?.logoUrl ?? '').trim() || `${appUrl.replace(/\/$/, '')}/og-image.png`

  const payload = {
    from: 'BookMosh <invites@bookmosh.com>',
    to: [toEmail],
    subject: `${inviterName ? `${inviterName} invited you to BookMosh` : "You're invited to BookMosh"}`,
    html: buildInviteHtml({ inviterName, inviteUrl, logoUrl }),
  }

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await resendRes.json().catch(() => ({}))

    if (!resendRes.ok) {
      return json(500, { error: 'Resend send failed', details: data })
    }

    return json(200, { ok: true, id: data?.id ?? null })
  } catch (error) {
    const message = (error as any)?.message
    return json(500, { error: 'Invite send failed', details: String(message ?? error) })
  }
})
