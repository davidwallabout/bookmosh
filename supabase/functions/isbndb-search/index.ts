// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const tryFetch = async (urls, headers) => {
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers })
      if (!res.ok) continue
      const data = await res.json()
      if (data) return data
    } catch (_) {
      // ignore
    }
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const ISBNDB_API_KEY = Deno.env.get('ISBNDB_API_KEY')
  if (!ISBNDB_API_KEY) {
    return json(500, { error: 'Missing ISBNDB_API_KEY secret' })
  }

  let payload = {}
  try {
    payload = (await req.json()) ?? {}
  } catch (_) {
    payload = {}
  }

  const q = (payload.q ?? '').toString().trim()
  const isbn = (payload.isbn ?? '').toString().trim()
  const mode = (payload.mode ?? '').toString().trim().toLowerCase()
  const pageSize = Math.min(50, Math.max(1, Number(payload.pageSize ?? 20) || 20))

  const headers = {
    Authorization: ISBNDB_API_KEY,
  }

  if (isbn) {
    const url = `https://api2.isbndb.com/book/${encodeURIComponent(isbn)}`
    const data = await tryFetch([url], headers)
    return json(200, data ?? { book: null })
  }

  if (!q) {
    return json(400, { error: 'Missing q or isbn' })
  }

  const encoded = encodeURIComponent(q)
  const urls =
    mode === 'author'
      ? [
          `https://api2.isbndb.com/author/${encoded}?page=1&pageSize=${pageSize}`,
          `https://api2.isbndb.com/author/${encoded}?pageSize=${pageSize}`,
          `https://api2.isbndb.com/author/${encoded}`,
          // fallback patterns
          `https://api2.isbndb.com/books/${encoded}?page=1&pageSize=${pageSize}`,
          `https://api2.isbndb.com/books/${encoded}?pageSize=${pageSize}`,
          `https://api2.isbndb.com/books/${encoded}`,
        ]
      : [
          `https://api2.isbndb.com/books/${encoded}?page=1&pageSize=${pageSize}`,
          `https://api2.isbndb.com/books/${encoded}?pageSize=${pageSize}`,
          `https://api2.isbndb.com/books/${encoded}`,
        ]

  const data = await tryFetch(urls, headers)
  return json(200, data ?? { books: [] })
})
