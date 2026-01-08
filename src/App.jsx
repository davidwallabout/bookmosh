import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import { sendPitMessageNotification, sendFeedLikeNotification, sendFriendInviteNotification, sendRecommendationNotification } from './lib/email'

const STORAGE_KEY = 'bookmosh-tracker-storage'
const AUTH_STORAGE_KEY = 'bookmosh-auth-store'

const StarSvg = ({ fraction = 0, className = '' }) => {
  const clipId = useMemo(() => `clip_${Math.random().toString(36).slice(2)}`, [])
  const clamped = Math.max(0, Math.min(1, Number(fraction) || 0))
  const clipWidth = 24 * clamped
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={clipWidth} height="24" />
        </clipPath>
      </defs>
      <path
        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
        fill="rgba(255, 255, 255, 0.2)"
      />
      <path
        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
        fill="#fbbf24"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  )
}

const PROFILE_ICONS = [
  {
    id: 'avatar_grin',
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 16 16" shape-rendering="crispEdges">
  <rect width="16" height="16" fill="#0b1225"/>
  <rect x="4" y="3" width="8" height="10" fill="#a78bfa"/>
  <rect x="5" y="4" width="6" height="8" fill="#c4b5fd"/>
  <rect x="6" y="6" width="1" height="1" fill="#4c1d95"/>
  <rect x="9" y="6" width="1" height="1" fill="#4c1d95"/>
  <rect x="6" y="9" width="4" height="1" fill="#4c1d95"/>
  <rect x="5" y="2" width="6" height="1" fill="#7c3aed"/>
  <rect x="4" y="3" width="1" height="10" fill="#6d28d9"/>
  <rect x="11" y="3" width="1" height="10" fill="#6d28d9"/>
  <rect x="5" y="13" width="6" height="1" fill="#7c3aed"/>
</svg>`,
  },
  {
    id: 'avatar_cyclops',
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 16 16" shape-rendering="crispEdges">
  <rect width="16" height="16" fill="#0b1225"/>
  <rect x="4" y="4" width="8" height="8" fill="#7c3aed"/>
  <rect x="5" y="5" width="6" height="6" fill="#a78bfa"/>
  <rect x="6" y="6" width="4" height="3" fill="#c4b5fd"/>
  <rect x="7" y="7" width="2" height="1" fill="#4c1d95"/>
  <rect x="8" y="7" width="1" height="1" fill="#0b1225"/>
  <rect x="6" y="10" width="4" height="1" fill="#4c1d95"/>
  <rect x="3" y="6" width="1" height="4" fill="#6d28d9"/>
  <rect x="12" y="6" width="1" height="4" fill="#6d28d9"/>
</svg>`,
  },
  {
    id: 'avatar_heart_eyes',
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 16 16" shape-rendering="crispEdges">
  <rect width="16" height="16" fill="#0b1225"/>
  <rect x="4" y="3" width="8" height="10" fill="#c4b5fd"/>
  <rect x="5" y="4" width="6" height="8" fill="#a78bfa"/>
  <rect x="6" y="6" width="1" height="1" fill="#7c3aed"/>
  <rect x="9" y="6" width="1" height="1" fill="#7c3aed"/>
  <rect x="5" y="6" width="1" height="1" fill="#6d28d9"/>
  <rect x="10" y="6" width="1" height="1" fill="#6d28d9"/>
  <rect x="6" y="7" width="1" height="1" fill="#6d28d9"/>
  <rect x="9" y="7" width="1" height="1" fill="#6d28d9"/>
  <rect x="7" y="10" width="2" height="1" fill="#4c1d95"/>
  <rect x="6" y="9" width="4" height="1" fill="#4c1d95"/>
</svg>`,
  },
  {
    id: 'avatar_mask',
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 16 16" shape-rendering="crispEdges">
  <rect width="16" height="16" fill="#0b1225"/>
  <rect x="4" y="3" width="8" height="10" fill="#7c3aed"/>
  <rect x="5" y="4" width="6" height="8" fill="#a78bfa"/>
  <rect x="5" y="7" width="6" height="2" fill="#4c1d95"/>
  <rect x="6" y="7" width="1" height="1" fill="#c4b5fd"/>
  <rect x="9" y="7" width="1" height="1" fill="#c4b5fd"/>
  <rect x="6" y="9" width="4" height="1" fill="#4c1d95"/>
  <rect x="6" y="10" width="4" height="1" fill="#c4b5fd"/>
</svg>`,
  },
  {
    id: 'avatar_sunglasses',
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 16 16" shape-rendering="crispEdges">
  <rect width="16" height="16" fill="#0b1225"/>
  <rect x="4" y="3" width="8" height="10" fill="#c4b5fd"/>
  <rect x="5" y="4" width="6" height="8" fill="#a78bfa"/>
  <rect x="5" y="6" width="6" height="2" fill="#0b1225"/>
  <rect x="6" y="7" width="1" height="1" fill="#6d28d9"/>
  <rect x="9" y="7" width="1" height="1" fill="#6d28d9"/>
  <rect x="6" y="10" width="4" height="1" fill="#4c1d95"/>
  <rect x="7" y="9" width="2" height="1" fill="#4c1d95"/>
</svg>`,
  },
  {
    id: 'avatar_alien',
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 16 16" shape-rendering="crispEdges">
  <rect width="16" height="16" fill="#0b1225"/>
  <rect x="5" y="3" width="6" height="10" fill="#7c3aed"/>
  <rect x="6" y="4" width="4" height="8" fill="#a78bfa"/>
  <rect x="6" y="6" width="1" height="2" fill="#0b1225"/>
  <rect x="9" y="6" width="1" height="2" fill="#0b1225"/>
  <rect x="7" y="7" width="2" height="1" fill="#c4b5fd"/>
  <rect x="7" y="10" width="2" height="1" fill="#4c1d95"/>
  <rect x="4" y="4" width="1" height="2" fill="#6d28d9"/>
  <rect x="11" y="4" width="1" height="2" fill="#6d28d9"/>
</svg>`,
  },
]

const iconDataUrl = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
const getProfileAvatarUrl = (user) => {
  if (!user) return null
  if (user.avatar_url) return user.avatar_url
  const iconId = user.avatar_icon || 'pixel_book_1'
  const icon = PROFILE_ICONS.find((i) => i.id === iconId) || PROFILE_ICONS[0]
  return iconDataUrl(icon.svg)
}

const isCoverUrlValue = (value) => {
  const v = String(value ?? '').trim()
  return v.startsWith('http') || v.startsWith('data:image')
}

const normalizeTitleValue = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const computeMeaningfulRelevance = (title, author, termWords) => {
  const titleLower = normalizeTitleValue(title)
  const authorLower = String(author ?? '').toLowerCase()
  const stopwords = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'for',
    'from',
    'in',
    'into',
    'is',
    'it',
    'of',
    'on',
    'or',
    'the',
    'to',
    'was',
    'were',
    'with',
  ])
  const tokens = (Array.isArray(termWords) ? termWords : [])
    .map((w) => String(w ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ''))
    .filter((w) => w.length >= 2) // Allow 2-char tokens like "mr"
    .filter((w) => !stopwords.has(w))

  if (tokens.length === 0) return 0

  const titleHits = tokens.filter((t) => titleLower.includes(t)).length
  const authorHits = tokens.filter((t) => authorLower.includes(t)).length

  let score = 0
  score += Math.min(3, titleHits) * 2 // Title match: 2 points each
  if (authorHits > 0) score += 3 // Author match: 3 points
  return score
}

const openLibraryIsbnCoverUrl = (isbn, size = 'M') => {
  const clean = (isbn ?? '').toString().trim()
  if (!clean) return null
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(clean)}-${size}.jpg`
}

const openLibraryCoverIdUrl = (coverId, size = 'L') => {
  const id = (coverId ?? '').toString().trim()
  if (!id) return null
  return `https://covers.openlibrary.org/b/id/${encodeURIComponent(id)}-${size}.jpg`
}

const invokeIsbndbSearch = async ({ q, isbn, mode, pageSize = 20 } = {}) => {
  if (!supabase) return null
  
  // Always log ISBNdb calls to verify it's being used
  console.log('[ISBNDB] Search called with:', { q, isbn, mode, pageSize })
  
  try {
    if (supabase.functions?.invoke) {
      try {
        const { data, error } = await supabase.functions.invoke('isbndb-search', {
          body: { q, isbn, mode, pageSize },
        })
        if (!error && data) {
          const count = Array.isArray(data?.books) ? data.books.length : (Array.isArray(data?.data) ? data.data.length : (data?.book ? 1 : 0))
          console.log('[ISBNDB] ✅ Success via supabase.functions.invoke', { q, isbn, mode, count })
          return data
        }

        if (error) {
          console.warn('[ISBNDB] invoke failed, falling back to HTTP fetch', error)
        }
      } catch (error) {
        console.warn('[ISBNDB] invoke threw, falling back to HTTP fetch', error)
      }
    }

    const baseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!baseUrl || !anonKey) {
      console.error('[ISBNDB] Missing Supabase config')
      return null
    }

    const headers = {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    }

    const res = await fetch(`${baseUrl}/functions/v1/isbndb-search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ q, isbn, mode, pageSize }),
    })
    if (!res.ok) {
      console.warn('[ISBNDB] HTTP fetch failed', res.status)
      return null
    }
    const data = await res.json()
    const count = Array.isArray(data?.books) ? data.books.length : (Array.isArray(data?.data) ? data.data.length : (data?.book ? 1 : 0))
    console.log('[ISBNDB] ✅ Success via HTTP fetch', { q, isbn, mode, count })
    return data
  } catch (error) {
    console.error('[ISBNDB] ❌ Search failed:', error)
    return null
  }
}


const mapIsbndbBookToResult = (b, searchLower, last1Lower, last2Lower, last3Lower, termWords) => {
  if (!b) return null
  const titlePrimary = b.title ?? null
  const titleLong = b.title_long ?? null
  const fallbackTitle = titlePrimary ?? titleLong ?? null
  if (!fallbackTitle) return null

  const authors = Array.isArray(b.authors) ? b.authors : []
  const author = authors[0] ?? b.author ?? 'Unknown author'
  const isbn13 = b.isbn13 ?? null
  const isbn = isbn13 || b.isbn || b.isbn10 || null
  let cover = b.image || b.image_url || b.image_original || null
  if (typeof cover === 'string' && cover.startsWith('http://')) {
    cover = `https://${cover.slice('http://'.length)}`
  }
  const date = String(b.date_published ?? '')
  const year = date ? Number(date.slice(0, 4)) || null : null

  let title = fallbackTitle
  let score = computeMeaningfulRelevance(title, author, termWords)

  const asciiRatio = (value) => {
    const s = String(value ?? '')
    if (!s) return 0
    const ascii = s.replace(/[^\x00-\x7F]/g, '').length
    return ascii / s.length
  }

  const queryAscii = (() => {
    const joined = (Array.isArray(termWords) ? termWords : []).join(' ')
    return joined ? joined === joined.replace(/[^\x00-\x7F]/g, '') : true
  })()

  if (Array.isArray(termWords) && termWords.length > 0 && titlePrimary && titleLong && titlePrimary !== titleLong) {
    const scorePrimary = computeMeaningfulRelevance(titlePrimary, author, termWords)
    const scoreLong = computeMeaningfulRelevance(titleLong, author, termWords)

    const primaryAscii = asciiRatio(titlePrimary)
    const longAscii = asciiRatio(titleLong)

    const longClearlyMoreAscii = queryAscii && longAscii >= 0.9 && primaryAscii <= 0.75

    if (longClearlyMoreAscii || scoreLong > scorePrimary) {
      title = titleLong
      score = scoreLong
    } else {
      title = titlePrimary
      score = scorePrimary
    }
  }

  if (queryAscii && asciiRatio(title) < 0.6) {
    score -= 2
  }

  return {
    key: `isbndb:${isbn ?? title}`,
    source: 'isbndb',
    title,
    author,
    year,
    cover,
    editionCount: 0,
    rating: 0,
    subjects: Array.isArray(b.subjects) ? b.subjects.slice(0, 3) : [],
    isbn,
    publisher: b.publisher ?? null,
    language: b.language ?? null,
    relevance: score,
    synopsis: b.synopsis ?? b.overview ?? null,
  }
}

const fetchGoogleVolume = async (volumeId) => {
  const id = (volumeId ?? '').toString().trim()
  if (!id) return null
  try {
    const url = new URL(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}`)
    if (GOOGLE_BOOKS_API_KEY) url.searchParams.set('key', GOOGLE_BOOKS_API_KEY)
    const res = await fetch(url.toString())
    if (!res.ok) return null
    return await res.json()
  } catch (error) {
    console.error('Google Books volume fetch failed', error)
    return null
  }
}

const curatedRecommendations = []

const initialTracker = []

const resolveOpenLibraryWorkKey = async (book) => {
  const existing = book?.olKey
  if (typeof existing === 'string' && existing.startsWith('/works/')) return existing

  const isbn = (book?.isbn ?? '').toString().trim()
  if (isbn) {
    try {
      const editionRes = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`)
      if (editionRes.ok) {
        const edition = await editionRes.json()
        const workKey = edition?.works?.[0]?.key
        if (typeof workKey === 'string' && workKey.startsWith('/works/')) return workKey
      }
    } catch (error) {
      console.error('Failed to resolve work key from ISBN', error)
    }
  }

  const title = (book?.title ?? '').toString().trim()
  const author = (book?.author ?? '').toString().trim()
  if (!title) return null

  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1&fields=key,isbn`,
    )
    if (!response.ok) return null
    const data = await response.json()
    const workKey = data?.docs?.[0]?.key
    if (typeof workKey === 'string' && workKey.startsWith('/works/')) return workKey
  } catch (error) {
    console.error('Failed to resolve work key from search', error)
  }

  return null
}

// Updated RLS policies for Supabase users table:
/*
-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  friends TEXT[] DEFAULT '{}',
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
*/
const fetchUsers = async () => {
  if (!supabase) return []
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, friends, is_private, avatar_icon, avatar_url, top_books')
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching users:', error)
    return []
  }
}

const createUser = async (userData) => {
  if (!supabase) throw new Error('Supabase not configured')
  
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
    
    if (error) throw error
    return data[0]
  } catch (error) {
    console.error('Error creating user:', error)
    throw error
  }
}

const updateUserFriends = async (userId, friends) => {
  if (!supabase) throw new Error('Supabase not configured')
  
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.warn('Unable to read Supabase auth user:', authError)
    }
    const authUser = authData?.user ?? null

    const orFilters = []
    if (userId) orFilters.push(`id.eq.${userId}`)
    if (authUser?.id) orFilters.push(`id.eq.${authUser.id}`)
    if (authUser?.email) orFilters.push(`email.eq.${authUser.email}`)
    const filter = orFilters.join(',')

    const { data, error } = await supabase
      .from('users')
      .update({ friends, updated_at: new Date().toISOString() })
      .or(filter)
      .select('id, username, friends, is_private, avatar_icon, avatar_url, top_books')
    
    if (error) throw error

    const updated = Array.isArray(data) ? data[0] : data
    if (updated) return updated

    // No row returned. This usually means either the row didn't match filters (id mismatch)
    // or RLS blocked the update/return.
    const { data: visibleRows, error: visibleError } = await supabase
      .from('users')
      .select('id, username, email')
      .or(filter)
      .limit(1)

    if (visibleError) {
      throw visibleError
    }

    if (!visibleRows || visibleRows.length === 0) {
      throw new Error('Unable to find your user profile row to update (account id mismatch).')
    }

    throw new Error('Update blocked by Row Level Security (RLS).')
  } catch (error) {
    console.error('Error updating friends:', error)
    throw error
  }
}

const searchUsers = async (query) => {
  if (!supabase) return []
  
  try {
    const normalized = query.trim()
    const normalizedLower = normalized.toLowerCase()

    // Exact match first (fast path)
    const { data: eqData, error: eqError } = await supabase
      .from('users')
      .select('id, username, email')
      .or(`username.eq.${normalized},email.eq.${normalized},username.eq.${normalizedLower},email.eq.${normalizedLower}`)
      .limit(5)

    if (eqError) throw eqError
    if (Array.isArray(eqData) && eqData.length > 0) return eqData

    const { data: exactData, error: exactError } = await supabase
      .from('users')
      .select('id, username, email')
      .or(`username.ilike.${normalized},email.ilike.${normalized},username.ilike.${normalizedLower},email.ilike.${normalizedLower}`)
      .limit(5)
    
    if (exactError) throw exactError

    if (Array.isArray(exactData) && exactData.length > 0) return exactData

    const { data, error } = await supabase
      .from('users')
      .select('id, username, email')
      .or(`username.ilike.%${normalized}%,email.ilike.%${normalized}%,username.ilike.%${normalizedLower}%,email.ilike.%${normalizedLower}%`)
      .limit(10)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error searching users:', error)
    throw error
  }
}

// Fetch friend's reading data
const fetchFriendBooks = async (username, offset = 0, limit = 20) => {
  if (!supabase) return []
  
  try {
    const { data, error } = await supabase
      .from('bookmosh_books')
      .select('*')
      .eq('owner', username)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) throw error
    return (data || []).map((row) => ({
      ...row,
      cover: row?.cover ?? row?.cover_url ?? (row?.isbn ? openLibraryIsbnCoverUrl(row.isbn, 'M') : null),
    }))
  } catch (error) {
    console.error('Error fetching friend books:', error)
    return []
  }
}

const statusOptions = ['Reading', 'to-read', 'Read']
const statusTags = ['to-read', 'Reading', 'Read']
const allTags = ['to-read', 'Reading', 'Read', 'Owned']

const formatTimeAgo = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)
  
  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffWeek < 4) return `${diffWeek}w ago`
  if (diffMonth < 12) return `${diffMonth}mo ago`
  return date.toLocaleDateString()
}

const defaultUsers = []

const matchesIdentifier = (user, identifier) => {
  if (!identifier) return false
  const normalized = identifier.trim().toLowerCase()
  return (
    user.username.toLowerCase() === normalized ||
    user.email.toLowerCase() === normalized
  )
}

const splitCSV = (line) =>
  line
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((value) => value.replace(/^"|"$/g, '').trim())

const normalizeStatus = (status, progress = 0) => {
  const lower = (status ?? '').toLowerCase()
  if (lower.includes('read')) return 'Read'
  if (lower.includes('currently') || lower.includes('reading')) return 'Reading'
  if (lower.includes('want') || lower.includes('queue') || lower.includes('wish')) {
    return 'to-read'
  }
  if (progress >= 100) return 'Read'
  if (progress > 0) return 'Reading'
  return 'to-read'
}

const buildBookEntry = (book) => {
  const progress =
    Number(book.progress ?? book.percent ?? book.percentComplete ?? 0) || 0
  const status = normalizeStatus(book.status ?? book.shelf, progress)
  const entry = {
    title: book.title ?? book.name ?? 'Untitled',
    author:
      book.author ??
      book.authors?.[0] ??
      (Array.isArray(book.authors) ? book.authors[0] : null) ??
      'Unknown author',
    status,
    tags: [status],
    progress,
    rating: Number(book.rating ?? book.score ?? 0) || 0,
  }
  return entry
}

const parseGoodreadsCSV = (text) => {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (rows.length <= 1) return []
  const header = splitCSV(rows[0]).map((value) => value.toLowerCase())
  const getIndex = (key) => header.findIndex((column) => column.includes(key))
  const titleIdx = getIndex('title')
  const authorIdx = getIndex('author')
  const shelfIdx = getIndex('shelf')
  const exclusiveShelfIdx = getIndex('exclusive')
  const progressIdx = getIndex('percent')
  const ratingIdx = getIndex('rating')

  return rows.slice(1).reduce((acc, row) => {
    const values = splitCSV(row)
    if (!values.length) return acc
    const title = titleIdx >= 0 ? values[titleIdx] : values[0] ?? 'Untitled'
    const author =
      (authorIdx >= 0 ? values[authorIdx] : null) ?? 'Unknown author'
    const status = (exclusiveShelfIdx >= 0 ? values[exclusiveShelfIdx] : null) ?? (shelfIdx >= 0 ? values[shelfIdx] : '')
    const progress =
      progressIdx >= 0 ? Number(values[progressIdx]) || 0 : 0
    const rating = ratingIdx >= 0 ? Number(values[ratingIdx]) || 0 : 0
    acc.push(buildBookEntry({ title, author, status, progress, rating }))
    return acc
  }, [])
}

const parseStoryGraphCSV = (text) => {
  // Proper CSV parser that handles quoted fields with commas
  const parseCSVLine = (line) => {
    const result = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }
  
  const lines = text.split('\n').filter((line) => line.trim())
  if (lines.length < 2) return []
  
  const headers = parseCSVLine(lines[0])
  const dataRows = lines.slice(1)
  
  return dataRows
    .map((line) => {
      const values = parseCSVLine(line)
      if (values.length === 0) return null
      
      const obj = {}
      headers.forEach((header, index) => {
        obj[header] = values[index] || ''
      })
      
      return obj
    })
    .filter(Boolean)
    .map((item) => {
      // Map Storygraph status to our status
      let status = 'to-read'
      const readStatus = (item['Read Status'] || item.readStatus || '').toLowerCase()
      if (readStatus.includes('read') && !readStatus.includes('to-read') && !readStatus.includes('currently')) {
        status = 'Read'
      } else if (readStatus.includes('currently') || readStatus.includes('reading')) {
        status = 'Reading'
      } else if (readStatus.includes('to-read') || readStatus.includes('want')) {
        status = 'to-read'
      }
      
      // Check if book is owned (Storygraph uses "Owned?" as column name)
      const owned = (item['Owned?'] || item.Owned || item.owned || '').toLowerCase()
      const isOwned = owned === 'true' || owned === 'yes' || owned === '1' || owned === 'owned'
      
      // Build tags array with status and owned
      const tags = [status]
      if (isOwned) {
        tags.push('Owned')
      }
      
      return {
        title: item.Title || item.title || '',
        author: item.Authors || item.Author || item.author || '',
        status: status,
        tags: tags,
        rating: parseFloat(item['Star Rating'] || item['My Rating'] || item.rating) || 0,
        progress: parseInt(item['Read Progress'] || item.progress) || 0,
      }
    })
    .filter(book => book.title && book.author)
}

const parseStoryGraphJSON = (text) => {
  const data = JSON.parse(text)
  if (!Array.isArray(data)) {
    throw new Error('JSON data is not an array')
  }
  return data.map((item) => ({
    title: item.title || '',
    author: item.author || '',
    status: item.readStatus || 'to-read',
    rating: item.rating || 0,
    progress: item.progress || 0,
  }))
}

const matchBookInBackground = async (book, setTracker) => {
  try {
    const searchQuery = `${book.title} ${book.author}`.trim()
    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=1&fields=key,title,author_name,cover_i,isbn`
    )
    const data = await response.json()
    
    if (data.docs && data.docs.length > 0) {
      const match = data.docs[0]
      const cover = match.cover_i 
        ? `https://covers.openlibrary.org/b/id/${match.cover_i}-M.jpg`
        : null
      const isbn = match.isbn?.[0] || null
      
      if (cover || isbn) {
        setTracker((prev) => 
          prev.map((b) => 
            b.title === book.title && b.author === book.author
              ? { ...b, cover: cover || b.cover, isbn: isbn || b.isbn }
              : b
          )
        )
      }
    }
  } catch (error) {
    console.error('[IMPORT] Background match failed:', book.title, error)
  }
}

const startBackgroundMatching = (books, setTracker, username, setMatchingProgress) => {
  const queueKey = `bookmosh-match-queue-${username}`
  
  // Save queue to localStorage
  const booksToMatch = books.filter(b => !b.cover).map(b => ({ title: b.title, author: b.author }))
  if (booksToMatch.length > 0) {
    localStorage.setItem(queueKey, JSON.stringify(booksToMatch))
  }
  
  const totalBooks = booksToMatch.length
  let index = 0
  
  // Set initial progress
  if (setMatchingProgress && totalBooks > 0) {
    setMatchingProgress({ active: true, current: 0, total: totalBooks, currentBook: null })
  }
  
  const matchNext = () => {
    // Get current queue from localStorage
    const queueData = localStorage.getItem(queueKey)
    if (!queueData) {
      if (setMatchingProgress) {
        setMatchingProgress({ active: false, current: 0, total: 0, currentBook: null })
      }
      return
    }
    
    const queue = JSON.parse(queueData)
    if (index < queue.length) {
      const book = queue[index]
      
      // Update progress with current book
      if (setMatchingProgress) {
        setMatchingProgress({ 
          active: true, 
          current: totalBooks - queue.length + 1, 
          total: totalBooks, 
          currentBook: book.title 
        })
      }
      
      matchBookInBackground(book, setTracker).then(() => {
        // Remove matched book from queue
        queue.splice(index, 1)
        if (queue.length > 0) {
          localStorage.setItem(queueKey, JSON.stringify(queue))
        } else {
          localStorage.removeItem(queueKey)
          if (setMatchingProgress) {
            setMatchingProgress({ active: false, current: 0, total: 0, currentBook: null })
          }
        }
      })
      index++
      setTimeout(matchNext, 2000) // Wait 2 seconds between requests
    } else {
      localStorage.removeItem(queueKey)
      if (setMatchingProgress) {
        setMatchingProgress({ active: false, current: 0, total: 0, currentBook: null })
      }
    }
  }

  setTimeout(matchNext, 1000) // Start after 1 second
}

const mergeImportedBooks = (books, setMessage, setTracker) => {
  setTracker((prev) => {
    const seen = new Set(
      prev.map(
        (book) =>
          `${book.title.trim().toLowerCase()}|${(book.author ?? '').trim().toLowerCase()}`,
      ),
    )
    const unique = []
    for (const entry of books) {
      const key = `${entry.title.trim().toLowerCase()}|${(entry.author ?? '').trim().toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(entry)
    }
    if (!unique.length) {
      setMessage('No new titles were added from this import.')
      return prev
    }
    setMessage(`Imported ${unique.length} new title${unique.length === 1 ? '' : 's'}. Matching covers in background...`)
    
    return [...unique, ...prev]
  })
}

const SUPABASE_TABLE = 'bookmosh_books'

const deriveStatusFromTags = (tags = [], fallback = 'to-read') => {
  if (tags.includes('Reading')) return 'Reading'
  if (tags.includes('Read')) return 'Read'
  if (tags.includes('to-read')) return 'to-read'
  return fallback
}

const normalizeBookTags = (book) => {
  const existingTags = Array.isArray(book.tags) ? book.tags : []
  const status = book.status ?? deriveStatusFromTags(existingTags, 'to-read')
  const owned = existingTags.includes('Owned')
  const nextTags = Array.from(
    new Set([status, ...(owned ? ['Owned'] : [])].filter(Boolean)),
  )
  return {
    ...book,
    status,
    tags: nextTags,
  }
}

const mapSupabaseRow = (row) => ({
  title: row.title ?? 'Untitled',
  author: row.author ?? 'Unknown author',
  cover: row.cover ?? row.cover_url ?? null,
  tags: Array.isArray(row.tags) && row.tags.length ? row.tags : [row.status ?? 'to-read'],
  status: deriveStatusFromTags(
    Array.isArray(row.tags) && row.tags.length ? row.tags : [row.status ?? 'to-read'],
    row.status ?? 'to-read',
  ),
  progress: Number(row.progress ?? 0) || 0,
  rating: Number(row.rating ?? 0) || 0,
  read_at: row.read_at ?? null,
  status_updated_at: row.status_updated_at ?? null,
})

const buildSupabasePayload = (book, owner) => ({
  owner,
  title: book.title,
  author: book.author,
  cover: book.cover ?? null,
  status: book.status,
  tags: Array.isArray(book.tags) ? book.tags : undefined,
  progress: book.progress,
  rating: book.rating,
  read_at: book.read_at ?? null,
  status_updated_at: book.status_updated_at ?? null,
})

const loadSupabaseBooks = async (owner) => {
  if (!supabase || !owner) return []
  try {
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select('*')
      .eq('owner', owner)
      .order('updated_at', { ascending: false })
    if (error) {
      console.error('Supabase fetch failed', error)
      return []
    }
    return (data ?? []).map(mapSupabaseRow)
  } catch (error) {
    console.error('Supabase fetch failed', error)
    return []
  }
}

const persistTrackerToSupabase = async (owner, books) => {
  console.log('[LIBRARY] persistTrackerToSupabase called:', { owner, bookCount: books.length })
  if (!supabase) {
    console.error('[LIBRARY] No supabase client')
    return
  }
  if (!owner) {
    console.error('[LIBRARY] No owner provided')
    return
  }
  if (!books.length) {
    console.log('[LIBRARY] No books to persist')
    return
  }
  try {
    const payload = books.map((book) => buildSupabasePayload(book, owner))
    console.log('[LIBRARY] Upserting books to Supabase:', payload.length)
    const { error } = await supabase
      .from(SUPABASE_TABLE)
      .upsert(payload, {
        onConflict: ['owner', 'title'],
      })
    if (error) {
      console.error('[LIBRARY] Upsert error:', error)
      // Backwards compat: if the table doesn't have a tags column yet, retry without it.
      const message = String(error.message ?? '')
      if (message.toLowerCase().includes('tags') && message.toLowerCase().includes('column')) {
        const fallbackPayload = payload.map(({ tags, ...rest }) => rest)
        const { error: fallbackError } = await supabase
          .from(SUPABASE_TABLE)
          .upsert(fallbackPayload, { onConflict: ['owner', 'title'] })
        if (fallbackError) {
          console.error('[LIBRARY] Fallback upsert failed', fallbackError)
        } else {
          console.log('[LIBRARY] Fallback upsert succeeded')
        }
        return
      }
      console.error('[LIBRARY] Supabase upsert failed', error)
    } else {
      console.log('[LIBRARY] Books saved successfully to Supabase')
    }
  } catch (error) {
    console.error('[LIBRARY] Supabase upsert exception:', error)
  }
}

const deriveUsernameFromSupabase = (email = '', metadata = {}) => {
  if (metadata.username) return metadata.username
  if (!email) return 'reader'
  return email.split('@')[0]
}

const getOwnerId = (user) => user?.id ?? user?.username

// Wrapper component to handle missing supabase config before hooks are called
function AppWrapper() {
  if (!supabase) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-xs uppercase tracking-[0.4em] text-white/50 mb-2">Configuration error</div>
          <div className="text-xl font-extrabold mb-2">BookMosh is not configured</div>
          <div className="text-sm text-white/70 leading-relaxed">
            Missing <code className="text-white/90">VITE_SUPABASE_URL</code> or{' '}
            <code className="text-white/90">VITE_SUPABASE_ANON_KEY</code>. Add these environment variables to your
            deployment and redeploy.
          </div>
        </div>
      </div>
    )
  }
  return <App />
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()

  const isBookPage = location.pathname === '/book'

  const [tracker, setTracker] = useState(initialTracker)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)
  const [discoveryDisplayCount, setDiscoveryDisplayCount] = useState(6)
  const [searchDebounce, setSearchDebounce] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [modalRating, setModalRating] = useState(0)
  const [modalProgress, setModalProgress] = useState(0)
  const [modalStatus, setModalStatus] = useState('Reading')
  const [modalReview, setModalReview] = useState('')
  const [modalSpoilerWarning, setModalSpoilerWarning] = useState(false)
  const [modalDescription, setModalDescription] = useState('')
  const [modalDescriptionLoading, setModalDescriptionLoading] = useState(false)
  const [publicMoshesForBook, setPublicMoshesForBook] = useState([])
  const [publicMoshesForBookLoading, setPublicMoshesForBookLoading] = useState(false)
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(null)
  const [libraryStatusFilter, setLibraryStatusFilter] = useState('all')
  const [libraryOwnedOnly, setLibraryOwnedOnly] = useState(false)
  const [selectedAuthor, setSelectedAuthor] = useState(null)
  const [isAuthorModalOpen, setIsAuthorModalOpen] = useState(false)
  const [authorModalName, setAuthorModalName] = useState('')
  const [authorModalBooks, setAuthorModalBooks] = useState([])
  const [authorModalLoading, setAuthorModalLoading] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [friendBooks, setFriendBooks] = useState([])
  const [friendBooksLoading, setFriendBooksLoading] = useState(false)
  const [friendBooksHasMore, setFriendBooksHasMore] = useState(false)
  const [friendBooksOffset, setFriendBooksOffset] = useState(0)
  const [friendBooksStatusFilter, setFriendBooksStatusFilter] = useState('all')
  const [friendLists, setFriendLists] = useState([])
  const [friendListsLoading, setFriendListsLoading] = useState(false)
  const [profileAvatarIcon, setProfileAvatarIcon] = useState('pixel_book_1')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [profileTopBooks, setProfileTopBooks] = useState(['', '', '', ''])
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [isProfileTopBookModalOpen, setIsProfileTopBookModalOpen] = useState(false)
  const [profileTopBookSlotIndex, setProfileTopBookSlotIndex] = useState(0)
  const [profileTopBookSearch, setProfileTopBookSearch] = useState('')
  const [profileTopBookResults, setProfileTopBookResults] = useState([])
  const [profileTopBookLoading, setProfileTopBookLoading] = useState(false)
  const [profileTopBookError, setProfileTopBookError] = useState('')
  const [moshes, setMoshes] = useState([]) // Track book chats
  const [listsTab, setListsTab] = useState('mine')
  const [listsLoading, setListsLoading] = useState(false)
  const [listsMessage, setListsMessage] = useState('')
  const [ownedLists, setOwnedLists] = useState([])
  const [followedLists, setFollowedLists] = useState([])
  const [publicLists, setPublicLists] = useState([])
  const [pendingListInvites, setPendingListInvites] = useState([])
  const [outgoingListInvites, setOutgoingListInvites] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [selectedRecommendation, setSelectedRecommendation] = useState(null)
  const [recommendationComments, setRecommendationComments] = useState([])
  const [recommendationCommentsLoading, setRecommendationCommentsLoading] = useState(false)
  const [recommendationCommentDraft, setRecommendationCommentDraft] = useState('')
  const [isRecommendBookOpen, setIsRecommendBookOpen] = useState(false)
  const [recommendBookData, setRecommendBookData] = useState(null)
  const [recommendNote, setRecommendNote] = useState('')
  const [recommendRecipients, setRecommendRecipients] = useState([])
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [recommendFriendSearch, setRecommendFriendSearch] = useState('')
  const [reviewThread, setReviewThread] = useState(null)
  const [reviewThreadLoading, setReviewThreadLoading] = useState(false)
  const [reviewThreadLikes, setReviewThreadLikes] = useState({ count: 0, likedByMe: false, users: [] })
  const [reviewThreadComments, setReviewThreadComments] = useState([])
  const [reviewThreadCommentDraft, setReviewThreadCommentDraft] = useState('')
  const [reviewThreadShowSpoiler, setReviewThreadShowSpoiler] = useState(false)
  const [selectedList, setSelectedList] = useState(null)
  const [selectedListItems, setSelectedListItems] = useState([])
  const [selectedListItemsLoading, setSelectedListItemsLoading] = useState(false)
  const [newListTitle, setNewListTitle] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  const [newListIsPublic, setNewListIsPublic] = useState(true)
  const [listBookSearch, setListBookSearch] = useState('')
  const [listInviteUsername, setListInviteUsername] = useState('')
  const [listInviteError, setListInviteError] = useState('')
  const [isAddToListOpen, setIsAddToListOpen] = useState(false)
  const [addToListBook, setAddToListBook] = useState(null)
  const [addToListSearch, setAddToListSearch] = useState('')
  const [addToListLoading, setAddToListLoading] = useState(false)
  const [addToListStatusByListId, setAddToListStatusByListId] = useState({})
  const [addToListPendingByListId, setAddToListPendingByListId] = useState({})
  const [feedScope, setFeedScope] = useState('friends')
  const [feedItems, setFeedItems] = useState([])
  const [feedDisplayCount, setFeedDisplayCount] = useState(10)
  const [feedLikes, setFeedLikes] = useState({})
  const [bookActivityFeed, setBookActivityFeed] = useState([])
  const [bookActivityLoading, setBookActivityLoading] = useState(false)
  const [likeNotifications, setLikeNotifications] = useState([])
  const [activeMoshes, setActiveMoshes] = useState([])
  const [unreadByMoshId, setUnreadByMoshId] = useState({})
  const [isMoshPanelOpen, setIsMoshPanelOpen] = useState(false)
  const [activeMosh, setActiveMosh] = useState(null)
  const [showCreatePitModal, setShowCreatePitModal] = useState(false)
  const [newPitName, setNewPitName] = useState('')
  const [newPitMembers, setNewPitMembers] = useState([])
  const [newPitMemberQuery, setNewPitMemberQuery] = useState('')
  const [newPitMemberResults, setNewPitMemberResults] = useState([])
  const [creatingPit, setCreatingPit] = useState(false)
  const [showShareBookInPit, setShowShareBookInPit] = useState(false)
  const [shareBookInPitQuery, setShareBookInPitQuery] = useState('')
  const [shareBookInPitResults, setShareBookInPitResults] = useState([])
  const [showSharedBooksInPit, setShowSharedBooksInPit] = useState(false)
  const [sharedBooksInPit, setSharedBooksInPit] = useState([])
  const [activeMoshMessages, setActiveMoshMessages] = useState([])
  const [moshMessageReactions, setMoshMessageReactions] = useState({})
  const [isMoshCoverPickerOpen, setIsMoshCoverPickerOpen] = useState(false)
  const [moshCoverPickerLoading, setMoshCoverPickerLoading] = useState(false)
  const [moshCoverPickerCovers, setMoshCoverPickerCovers] = useState([])
  const [moshDraft, setMoshDraft] = useState('')
  const [moshMentionQuery, setMoshMentionQuery] = useState('')
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [isMoshInviteOpen, setIsMoshInviteOpen] = useState(false)
  const [moshInviteBook, setMoshInviteBook] = useState(null)
  const [moshInviteFriends, setMoshInviteFriends] = useState([])
  const [moshInviteSearch, setMoshInviteSearch] = useState('')
  const [moshInviteTitle, setMoshInviteTitle] = useState('')
  const [moshInviteIsPublic, setMoshInviteIsPublic] = useState(true)
  const [moshInviteError, setMoshInviteError] = useState('')
  const [moshInviteLoading, setMoshInviteLoading] = useState(false)
  const [isMoshAddFriendsOpen, setIsMoshAddFriendsOpen] = useState(false)
  const [moshAddFriends, setMoshAddFriends] = useState([])
  const [moshAddSearch, setMoshAddSearch] = useState('')
  const [moshAddError, setMoshAddError] = useState('')
  const [moshAddLoading, setMoshAddLoading] = useState(false)
  const [moshArchiveFilter, setMoshArchiveFilter] = useState('open')
  const [librarySearch, setLibrarySearch] = useState('')
  const [showAllLibrary, setShowAllLibrary] = useState(false)
  const [showFullLibrary, setShowFullLibrary] = useState(false)
  const [libraryDisplayCount, setLibraryDisplayCount] = useState(6)
  const [librarySort, setLibrarySort] = useState('recent')
  const [matchingProgress, setMatchingProgress] = useState({ active: false, current: 0, total: 0, currentBook: null })
  const [showFindMatch, setShowFindMatch] = useState(false)
  const [findMatchQuery, setFindMatchQuery] = useState('')
  const [findMatchResults, setFindMatchResults] = useState([])
  const [findMatchLoading, setFindMatchLoading] = useState(false)
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const [coverPickerLoading, setCoverPickerLoading] = useState(false)
  const [coverPickerCovers, setCoverPickerCovers] = useState([])
  const [showEditionPicker, setShowEditionPicker] = useState(false)
  const [editionPickerLoading, setEditionPickerLoading] = useState(false)
  const [editionPickerEditions, setEditionPickerEditions] = useState([])
  const brokenCoverKeysRef = useRef(new Set())
  const [brokenCoverKeysVersion, setBrokenCoverKeysVersion] = useState(0)
  const [moshLibrarySearch, setMoshLibrarySearch] = useState('')
  const messagesEndRef = useRef(null)
  const [users, setUsers] = useState(defaultUsers)
  const [currentUser, setCurrentUser] = useState(null)
  const [isScrolled, setIsScrolled] = useState(false)

  const markCoverBroken = (key) => {
    const k = String(key || '')
    if (!k) return
    if (brokenCoverKeysRef.current.has(k)) return
    brokenCoverKeysRef.current.add(k)
    setBrokenCoverKeysVersion((v) => v + 1)
  }
  const isUpdatingUserRef = useRef(false)
  const [authMode, setAuthMode] = useState('login')
  const [successModal, setSuccessModal] = useState({ show: false, book: null, list: '' })
  const [addedButtons, setAddedButtons] = useState({}) // Track which buttons show checkmark: { "bookKey:status": true }
  const showSuccessMessage = (message, timeoutMs = 2500) => {
    setSuccessModal({ show: true, book: null, list: message, alreadyAdded: false })
    setTimeout(() => setSuccessModal({ show: false, book: null, list: '' }), timeoutMs)
  }
  const markButtonAdded = (bookKey, status) => {
    const key = `${bookKey}:${status}`
    setAddedButtons((prev) => ({ ...prev, [key]: true }))
    setTimeout(() => {
      setAddedButtons((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }, 2000)
  }

  const [emailInvite, setEmailInvite] = useState('')
  const [emailInviteSending, setEmailInviteSending] = useState(false)
  const [emailInviteMessage, setEmailInviteMessage] = useState('')

  const openAddToList = (book) => {
    if (!book) return
    setAddToListBook(book)
    setAddToListSearch('')
    setAddToListStatusByListId({})
    setAddToListPendingByListId({})
    setIsAddToListOpen(true)
  }

  const closeAddToList = () => {
    setIsAddToListOpen(false)
    setAddToListBook(null)
    setAddToListSearch('')
    setAddToListLoading(false)
    setAddToListStatusByListId({})
    setAddToListPendingByListId({})
  }
  const [authIdentifier, setAuthIdentifier] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('')
  const [signupData, setSignupData] = useState({
    username: '',
    email: '',
    password: '',
  })
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [supabaseUser, setSupabaseUser] = useState(null)
  const [friendQuery, setFriendQuery] = useState('')
  const [friendMessage, setFriendMessage] = useState('')
  const [incomingFriendRequests, setIncomingFriendRequests] = useState([])
  const [outgoingFriendRequests, setOutgoingFriendRequests] = useState([])
  const [friendRequestsLoading, setFriendRequestsLoading] = useState(false)
  const [importFileType, setImportFileType] = useState('goodreads')
  const [importMessage, setImportMessage] = useState('')

  const [hoverRatingTitle, setHoverRatingTitle] = useState('')
  const [hoverRatingValue, setHoverRatingValue] = useState(0)
  const [draggingRating, setDraggingRating] = useState(null)

  const modalStarsRef = useRef(null)
  const pendingModalRatingRef = useRef(0)
  const modalRatingRafRef = useRef(null)
  const [friendsRatings, setFriendsRatings] = useState([])
  const [communityAvgRating, setCommunityAvgRating] = useState(null)
  const [showAddToPitDropdown, setShowAddToPitDropdown] = useState(false)
  const [userPitsForModal, setUserPitsForModal] = useState([])
  const [loadingPitsForModal, setLoadingPitsForModal] = useState(false)

  const calculateRatingFromClientX = (clientX, rect) => {
    if (!rect?.width) return 0
    const relativeX = clientX - rect.left
    const starWidth = rect.width / 5
    const rawRating = relativeX / starWidth
    const rounded = Math.round(rawRating * 2) / 2
    return Math.max(0, Math.min(5, rounded))
  }

  const totalUnreadMoshes = useMemo(() => {
    const values = Object.values(unreadByMoshId || {})
    return values.reduce((sum, n) => sum + (Number(n) || 0), 0)
  }, [unreadByMoshId])

  const scrollToSection = (id) => {
    if (typeof window === 'undefined') return
    // Close friend profile if open (but not if we're scrolling to community from closeFriendProfile)
    if (selectedFriend && id !== 'community') {
      closeFriendProfile()
    }
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Track scroll position for sticky header
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100)
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const ensureLocalUserProfile = (username, email) => {
    setUsers((prev) => {
      const existing = prev.find((item) => item.username === username)
      if (existing) {
        setCurrentUser(existing)
        return prev
      }
      const newProfile = {
        username,
        email,
        password: '',
        friends: [],
      }
      setCurrentUser(newProfile)
      return [newProfile, ...prev]
    })
  }

  const statusSummary = useMemo(() => {
    return tracker.reduce(
      (summary, book) => {
        summary[book.status] = (summary[book.status] ?? 0) + 1
        return summary
      },
      { Reading: 0, 'to-read': 0, Read: 0 },
    )
  }, [tracker])

  const filteredLibrary = useMemo(() => {
    const normalized = tracker.map(normalizeBookTags)
    const statusFiltered =
      libraryStatusFilter === 'all'
        ? normalized
        : normalized.filter((book) => book.status === libraryStatusFilter)

    const ownedFiltered = !libraryOwnedOnly
      ? statusFiltered
      : statusFiltered.filter((book) => (book.tags ?? []).includes('Owned'))

    const searchFiltered = !librarySearch.trim() 
      ? ownedFiltered 
      : ownedFiltered.filter(
          (book) =>
            book.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
            (book.author ?? '').toLowerCase().includes(librarySearch.toLowerCase()),
        )
    
    // Apply sorting
    const sorted = [...searchFiltered]
    switch (librarySort) {
      case 'recent':
        // Most recently added first (default order from tracker)
        break
      case 'oldest':
        sorted.reverse()
        break
      case 'title-asc':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
        break
      case 'title-desc':
        sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''))
        break
      case 'author-asc':
        sorted.sort((a, b) => (a.author || '').localeCompare(b.author || ''))
        break
      case 'author-desc':
        sorted.sort((a, b) => (b.author || '').localeCompare(a.author || ''))
        break
      default:
        break
    }
    
    return sorted
  }, [tracker, libraryStatusFilter, libraryOwnedOnly, librarySearch, librarySort])

  const paginatedLibrary = useMemo(() => {
    // Show libraryDisplayCount books (starts at 6, increases by 20)
    return filteredLibrary.slice(0, libraryDisplayCount)
  }, [filteredLibrary, libraryDisplayCount])

  const moshLibraryMatches = useMemo(() => {
    const query = moshLibrarySearch.trim().toLowerCase()
    const normalized = tracker.map(normalizeBookTags)
    const matches = query
      ? normalized.filter((book) => {
          const title = String(book.title ?? '').toLowerCase()
          const author = String(book.author ?? '').toLowerCase()
          return title.includes(query) || author.includes(query)
        })
      : normalized
    // Show only 4 most recent books by default, or 12 when searching
    return matches.slice(0, query ? 12 : 4)
  }, [tracker, moshLibrarySearch])

  useEffect(() => {
    if (!supabase || !currentUser) return
    persistTrackerToSupabase(currentUser.username, tracker)
  }, [tracker, currentUser])

  // Fetch all users when logged in to populate friend profiles
  useEffect(() => {
    if (!supabase || !currentUser) return
    
    const loadUsers = async () => {
      const allUsers = await fetchUsers()
      setUsers(allUsers)
    }
    
    loadUsers()
  }, [currentUser])

  const activeFriendProfiles = useMemo(() => {
    if (!currentUser) return []
    const resolved = (Array.isArray(currentUser.friends) ? currentUser.friends : [])
      .map((friendKey) =>
        users.find((user) => user.username === friendKey) || users.find((user) => String(user.id) === String(friendKey)),
      )
      .filter(Boolean)

    const seen = new Set()
    return resolved.filter((friend) => {
      const key = String(friend?.id ?? friend?.username ?? '')
      if (!key) return false
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [currentUser, users])

  useEffect(() => {
    // SIMPLE AUTH: Restore user from localStorage, then refresh from DB
    const storedUser = localStorage.getItem('bookmosh-user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        console.log('[AUTH] Restored user from localStorage:', user.username)
        setCurrentUser(user)
        
        // Immediately refresh from database to get latest friends list
        if (supabase && user?.id) {
          supabase
            .from('users')
            .select('id, username, email, friends, is_private, avatar_icon, avatar_url, top_books')
            .eq('id', user.id)
            .limit(1)
            .then(({ data, error }) => {
              if (!error && data?.[0]) {
                console.log('[AUTH] Refreshed user from DB:', data[0].username)
                setCurrentUser(data[0])
                localStorage.setItem('bookmosh-user', JSON.stringify(data[0]))
              }
            })
            .catch((err) => console.error('[AUTH] Failed to refresh user from DB:', err))
        }
      } catch (err) {
        console.error('[AUTH] Failed to restore user:', err)
        localStorage.removeItem('bookmosh-user')
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setTracker(JSON.parse(stored))
      } catch (error) {
        console.error('Failed to parse saved tracker', error)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tracker))
  }, [tracker])

  const refreshCurrentUser = async () => {
    if (!supabase || !currentUser?.id) return
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, friends, is_private, avatar_icon, avatar_url, top_books')
        .eq('id', currentUser.id)
        .limit(1)
      if (error) throw error
      const nextUser = data?.[0]
      if (!nextUser) return
      setCurrentUser(nextUser)
      localStorage.setItem('bookmosh-user', JSON.stringify(nextUser))
    } catch (error) {
      console.error('Failed to refresh current user', error)
    }
  }

  const loadBooksFromDatabase = async () => {
    if (!supabase || !currentUser?.username) return
    try {
      console.log('[LIBRARY] Loading books from database for:', currentUser.username)
      const { data, error } = await supabase
        .from('bookmosh_books')
        .select('*')
        .eq('owner', currentUser.username)
        .order('updated_at', { ascending: false })
      
      if (error) throw error
      
      const dbBooks = (data || []).map((row) => ({
        title: row.title,
        author: row.author,
        cover: row.cover ?? row.cover_url ?? null,
        status: row.status ?? 'to-read',
        tags: Array.isArray(row.tags) ? row.tags : [row.status ?? 'to-read'],
        progress: row.progress ?? 0,
        rating: row.rating ?? 0,
        review: row.review ?? '',
        spoiler_warning: row.spoiler_warning ?? false,
        isbn: row.isbn ?? null,
        olKey: row.ol_key ?? null,
        year: row.year ?? null,
      }))
      
      console.log('[LIBRARY] Loaded', dbBooks.length, 'books from database')
      
      // Merge with localStorage - database is source of truth
      setTracker((prev) => {
        // Create a map of database books by title
        const dbMap = new Map(dbBooks.map(b => [b.title.toLowerCase(), b]))
        
        // Keep local books that aren't in database (newly added offline)
        const localOnly = prev.filter(b => !dbMap.has(b.title.toLowerCase()))
        
        // Combine: database books + local-only books
        const merged = [...dbBooks, ...localOnly]
        console.log('[LIBRARY] Merged library:', merged.length, 'books')
        return merged
      })
    } catch (error) {
      console.error('[LIBRARY] Failed to load books from database:', error)
    }
  }

  // Load books from database when user is available
  useEffect(() => {
    if (currentUser?.username) {
      loadBooksFromDatabase()
    }
  }, [currentUser?.username])

  const fetchOutgoingListInvites = async (listId) => {
    if (!supabase || !currentUser || !listId) return
    try {
      const { data, error } = await supabase
        .from('list_invites')
        .select('id, list_id, inviter_id, inviter_username, invitee_id, invitee_username, status, created_at')
        .eq('list_id', listId)
        .eq('inviter_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      setOutgoingListInvites(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Outgoing list invites fetch failed', error)
      setOutgoingListInvites([])
    }
  }

  const fetchListItems = async (listId) => {
    if (!supabase || !currentUser || !listId) return
    setSelectedListItemsLoading(true)
    try {
      const { data, error } = await supabase
        .from('list_items')
        .select('id, list_id, added_by, book_title, book_author, book_cover, ol_key, isbn, created_at')
        .eq('list_id', listId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setSelectedListItems(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('List items fetch failed', error)
      setSelectedListItems([])
    } finally {
      setSelectedListItemsLoading(false)
    }
  }

  const openList = async (listRow, options = {}) => {
    if (!listRow?.id) return

    const skipUrlUpdate = Boolean(options?.skipUrlUpdate)

    if (!skipUrlUpdate && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      params.delete('profile')
      params.set('listId', String(listRow.id))
      const next = `${window.location.pathname}?${params.toString()}${window.location.hash || ''}`
      window.history.pushState({}, '', next)
    }

    setSelectedList(listRow)
    setListBookSearch('')
    setListInviteUsername('')
    setListInviteError('')
    setListsMessage('')
    setOutgoingListInvites([])
    await fetchListItems(listRow.id)
    if (listRow.owner_id === currentUser?.id) {
      await fetchOutgoingListInvites(listRow.id)
    }
  }

  const clearSelectedList = (useReplaceState = false) => {
    setSelectedList(null)
    setSelectedListItems([])

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      params.delete('listId')
      const qs = params.toString()
      const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`
      if (useReplaceState) {
        window.history.replaceState({}, '', next)
      } else {
        window.history.pushState({}, '', next)
      }
    }
  }

  const openListById = async (listId, options = {}) => {
    if (!supabase || !currentUser || !listId) return
    try {
      const { data, error } = await supabase
        .from('lists')
        .select('id, owner_id, owner_username, title, description, is_public, created_at, updated_at')
        .eq('id', listId)
        .limit(1)
      if (error) throw error
      const row = data?.[0]
      if (!row) {
        setListsMessage('List not found.')
        return
      }
      await openList(row, { skipUrlUpdate: Boolean(options?.skipUrlUpdate) })
      setTimeout(() => scrollToSection('lists'), 100)
    } catch (error) {
      console.error('Open list by id failed', error)
      setListsMessage(error?.message || 'Failed to open list.')
    }
  }

  const fetchRecommendations = async () => {
    if (!supabase || !currentUser) return
    setRecommendationsLoading(true)
    try {
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setRecommendations(data || [])
    } catch (error) {
      console.error('[RECOMMENDATIONS] Load error:', error)
      setRecommendations([])
    } finally {
      setRecommendationsLoading(false)
    }
  }

  const loadRecommendationComments = async (recommendationId) => {
    if (!supabase || !currentUser?.id || !recommendationId) return
    setRecommendationCommentsLoading(true)
    try {
      const { data, error } = await supabase
        .from('recommendation_comments')
        .select('*')
        .eq('recommendation_id', recommendationId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setRecommendationComments(data || [])
    } catch (error) {
      console.error('[RECOMMENDATION_COMMENTS] Load error:', error)
      setRecommendationComments([])
    } finally {
      setRecommendationCommentsLoading(false)
    }
  }

  const postRecommendationComment = async () => {
    if (!supabase || !currentUser?.id || !selectedRecommendation?.id) return
    const body = String(recommendationCommentDraft || '').trim()
    if (!body) return
    try {
      const { error } = await supabase.from('recommendation_comments').insert({
        recommendation_id: selectedRecommendation.id,
        commenter_id: currentUser.id,
        commenter_username: currentUser.username,
        body,
      })
      if (error) throw error
      setRecommendationCommentDraft('')
      await loadRecommendationComments(selectedRecommendation.id)
    } catch (error) {
      console.error('[RECOMMENDATION_COMMENTS] Insert error:', error)
      alert(error?.message || 'Failed to post comment')
    }
  }

  const openReviewThreadForEvent = async (eventItem) => {
    if (!supabase || !currentUser?.id || !eventItem?.owner_username || !eventItem?.book_title) return
    setReviewThreadLoading(true)
    setReviewThread(null)
    setReviewThreadComments([])
    setReviewThreadLikes({ count: 0, likedByMe: false, users: [] })
    setReviewThreadCommentDraft('')
    setReviewThreadShowSpoiler(false)
    try {
      const eventReviewId = eventItem?.review_id ?? null

      if (eventReviewId) {
        const { data: r, error: rErr } = await supabase
          .from('book_reviews')
          .select('*')
          .eq('id', eventReviewId)
          .maybeSingle()

        if (rErr) throw rErr
        if (!r?.id) {
          alert('Could not find this review in the database yet.')
          return
        }

        setReviewThread({
          ...r,
          title: r.book_title,
          author: r.book_author,
          cover: r.book_cover,
          review: r.body,
          reviewer_username: r.owner_username,
          __reviewTable: 'book_reviews',
        })

        const [likesRes, commentsRes] = await Promise.all([
          supabase.from('book_review_likes').select('review_id, user_id, username').eq('review_id', r.id),
          supabase
            .from('book_review_comments')
            .select('*')
            .eq('review_id', r.id)
            .order('created_at', { ascending: true }),
        ])

        const likes = likesRes.data || []
        setReviewThreadLikes({
          count: likes.length,
          likedByMe: likes.some((l) => l.user_id === currentUser.id),
          users: likes.map((l) => l.username),
        })
        setReviewThreadComments(commentsRes.data || [])
        return
      }

      const { data: bookRow, error: bookError } = await supabase
        .from('bookmosh_books')
        .select('id, owner, title, author, cover, review, spoiler_warning, created_at, updated_at')
        .eq('owner', eventItem.owner_username)
        .eq('title', eventItem.book_title)
        .limit(1)
        .maybeSingle()

      if (bookError) throw bookError
      if (!bookRow?.id) {
        alert('Could not find this review in the database yet.')
        return
      }

      setReviewThread({
        ...bookRow,
        reviewer_username: eventItem.owner_username,
        __reviewTable: 'bookmosh_books',
      })

      const reviewId = bookRow.id
      const [likesRes, commentsRes] = await Promise.all([
        supabase.from('review_likes').select('review_id, user_id, username').eq('review_id', reviewId),
        supabase.from('review_comments').select('*').eq('review_id', reviewId).order('created_at', { ascending: true }),
      ])

      const likes = likesRes.data || []
      setReviewThreadLikes({
        count: likes.length,
        likedByMe: likes.some((l) => l.user_id === currentUser.id),
        users: likes.map((l) => l.username),
      })
      setReviewThreadComments(commentsRes.data || [])
    } catch (error) {
      console.error('[REVIEW_THREAD] Open error:', error)
      alert(error?.message || 'Failed to load review thread')
    } finally {
      setReviewThreadLoading(false)
    }
  }

  const toggleReviewLike = async () => {
    if (!supabase || !currentUser?.id || !reviewThread?.id) return
    const reviewId = reviewThread.id
    const current = reviewThreadLikes ?? { count: 0, likedByMe: false, users: [] }
    const likesTable = reviewThread.__reviewTable === 'book_reviews' ? 'book_review_likes' : 'review_likes'
    try {
      if (current.likedByMe) {
        await supabase.from(likesTable).delete().eq('review_id', reviewId).eq('user_id', currentUser.id)
        setReviewThreadLikes((prev) => ({
          count: Math.max(0, (prev?.count ?? 1) - 1),
          likedByMe: false,
          users: (prev?.users ?? []).filter((u) => u !== currentUser.username),
        }))
      } else {
        const { error } = await supabase.from(likesTable).insert({
          review_id: reviewId,
          user_id: currentUser.id,
          username: currentUser.username,
        })
        if (error) throw error
        setReviewThreadLikes((prev) => ({
          count: (prev?.count ?? 0) + 1,
          likedByMe: true,
          users: [...(prev?.users ?? []), currentUser.username],
        }))
      }
    } catch (error) {
      console.error('[REVIEW_THREAD] Toggle like failed:', error)
    }
  }

  const postReviewComment = async () => {
    if (!supabase || !currentUser?.id || !reviewThread?.id) return
    const body = String(reviewThreadCommentDraft || '').trim()
    if (!body) return
    const commentsTable = reviewThread.__reviewTable === 'book_reviews' ? 'book_review_comments' : 'review_comments'
    try {
      const { error } = await supabase.from(commentsTable).insert({
        review_id: reviewThread.id,
        commenter_id: currentUser.id,
        commenter_username: currentUser.username,
        body,
      })
      if (error) throw error
      setReviewThreadCommentDraft('')
      const { data, error: loadErr } = await supabase
        .from(commentsTable)
        .select('*')
        .eq('review_id', reviewThread.id)
        .order('created_at', { ascending: true })
      if (loadErr) throw loadErr
      setReviewThreadComments(data || [])
    } catch (error) {
      console.error('[REVIEW_THREAD] Insert comment failed:', error)
      alert(error?.message || 'Failed to post comment')
    }
  }

  const sendRecommendation = async () => {
    if (!supabase || !currentUser || !recommendBookData || recommendRecipients.length === 0) return

    setRecommendLoading(true)
    try {
      const recommendations = recommendRecipients.map(recipientUsername => ({
        sender_id: currentUser.id,
        sender_username: currentUser.username,
        recipient_id: recipientUsername.id || currentUser.id,
        recipient_username: recipientUsername.username || recipientUsername,
        book_title: recommendBookData.title,
        book_author: recommendBookData.author,
        book_cover: recommendBookData.cover,
        note: recommendNote.trim() || null,
      }))

      const { error } = await supabase.from('recommendations').insert(recommendations)

      if (error) throw error

      // Fetch recipient emails from users table
      const recipientUsernames = recommendRecipients.map(r => r.username || r)
      const { data: recipientUsers, error: emailError } = await supabase
        .from('users')
        .select('username, email')
        .in('username', recipientUsernames)

      if (emailError) {
        console.error('[RECOMMENDATIONS] Failed to fetch recipient emails:', emailError)
      }

      // Send email notifications to recipients
      const emailMap = new Map((recipientUsers || []).map(u => [u.username, u.email]))
      for (const recipient of recommendRecipients) {
        const username = recipient.username || recipient
        const email = emailMap.get(username)
        if (email) {
          try {
            await sendRecommendationNotification(email, {
              senderName: currentUser.username,
              bookTitle: recommendBookData.title,
              bookAuthor: recommendBookData.author,
              note: recommendNote.trim() || null,
            })
            console.log(`[RECOMMENDATIONS] Email sent to ${username} (${email})`)
          } catch (emailError) {
            console.error(`[RECOMMENDATIONS] Email notification failed for ${username}:`, emailError)
            // Don't fail the whole operation if email fails
          }
        } else {
          console.warn(`[RECOMMENDATIONS] No email found for ${username}`)
        }
      }

      setIsRecommendBookOpen(false)
      setRecommendNote('')
      setRecommendRecipients([])
      showSuccessMessage(`Recommended "${recommendBookData.title}" to ${recommendRecipients.length} friend${recommendRecipients.length > 1 ? 's' : ''}!`)
      await fetchRecommendations()
    } catch (error) {
      console.error('[RECOMMENDATIONS] Send error:', error)
      alert(error.message || 'Failed to send recommendation')
    } finally {
      setRecommendLoading(false)
    }
  }

  const fetchLists = async () => {
    if (!supabase || !currentUser) return
    setListsLoading(true)
    setListsMessage('')
    try {
      const { data: mine, error: mineError } = await supabase
        .from('lists')
        .select('id, owner_id, owner_username, title, description, is_public, created_at, updated_at')
        .eq('owner_id', currentUser.id)
        .order('updated_at', { ascending: false })
      if (mineError) throw mineError
      const mineLists = Array.isArray(mine) ? mine : []

      const { data: follows, error: followsError } = await supabase
        .from('list_follows')
        .select('list_id')
        .eq('user_id', currentUser.id)
      if (followsError) throw followsError
      const followIds = (Array.isArray(follows) ? follows : []).map((f) => f.list_id).filter(Boolean)

      if (followIds.length) {
        const { data: followed, error: followedError } = await supabase
          .from('lists')
          .select('id, owner_id, owner_username, title, description, is_public, created_at, updated_at')
          .in('id', followIds)
          .order('updated_at', { ascending: false })
        if (followedError) throw followedError
        var followedListsRaw = (Array.isArray(followed) ? followed : []).filter((l) => l.owner_id !== currentUser.id)
      } else {
        var followedListsRaw = []
      }

      const { data: pub, error: pubError } = await supabase
        .from('lists')
        .select('id, owner_id, owner_username, title, description, is_public, created_at, updated_at')
        .eq('is_public', true)
        .order('updated_at', { ascending: false })
        .limit(50)
      if (pubError) throw pubError
      const pubLists = Array.isArray(pub) ? pub : []
      const followedSet = new Set(followIds)
      const publicListsRaw = pubLists.filter((l) => l.owner_id !== currentUser.id && !followedSet.has(l.id))

      const allListIds = Array.from(
        new Set([...mineLists, ...followedListsRaw, ...publicListsRaw].map((l) => l.id).filter(Boolean)),
      )

      let countsByListId = {}
      let previewCoversByListId = {}
      if (allListIds.length) {
        const { data: items, error: itemsError } = await supabase
          .from('list_items')
          .select('list_id, book_cover, created_at')
          .in('list_id', allListIds)
          .order('created_at', { ascending: false })

        if (itemsError) throw itemsError

        const rows = Array.isArray(items) ? items : []
        for (const row of rows) {
          const listId = row.list_id
          if (!listId) continue
          countsByListId[listId] = (countsByListId[listId] ?? 0) + 1
          if ((previewCoversByListId[listId]?.length ?? 0) >= 4) continue
          previewCoversByListId[listId] = previewCoversByListId[listId] ?? []
          if (row.book_cover) previewCoversByListId[listId].push(row.book_cover)
        }
      }

      const withPreview = (l) => ({
        ...l,
        item_count: countsByListId[l.id] ?? 0,
        preview_covers: previewCoversByListId[l.id] ?? [],
      })

      setOwnedLists(mineLists.map(withPreview))
      setFollowedLists(followedListsRaw.map(withPreview))
      setPublicLists(publicListsRaw.map(withPreview))

      const { data: invites, error: invitesError } = await supabase
        .from('list_invites')
        .select('id, list_id, inviter_id, inviter_username, invitee_id, invitee_username, status, created_at')
        .eq('invitee_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (invitesError) throw invitesError

      const inviteRows = Array.isArray(invites) ? invites : []
      const inviteListIds = Array.from(new Set(inviteRows.map((i) => i.list_id).filter(Boolean)))
      if (inviteListIds.length) {
        const { data: inviteLists, error: inviteListsError } = await supabase
          .from('lists')
          .select('id, title, owner_username')
          .in('id', inviteListIds)
        if (inviteListsError) throw inviteListsError
        const mapById = new Map((Array.isArray(inviteLists) ? inviteLists : []).map((l) => [l.id, l]))
        setPendingListInvites(
          inviteRows.map((inv) => {
            const meta = mapById.get(inv.list_id)
            return { ...inv, list_title: meta?.title ?? 'List', list_owner_username: meta?.owner_username ?? null }
          }),
        )
      } else {
        setPendingListInvites([])
      }
    } catch (error) {
      console.error('Lists fetch failed', error)
      setListsMessage(error?.message || 'Failed to load lists.')
      setOwnedLists([])
      setFollowedLists([])
      setPublicLists([])
      setPendingListInvites([])
    } finally {
      setListsLoading(false)
    }
  }

  const createList = async () => {
    if (!supabase || !currentUser) return
    const title = newListTitle.trim()
    if (!title) {
      setListsMessage('Add a title for your list.')
      return
    }
    setListsLoading(true)
    setListsMessage('')
    try {
      const payload = {
        owner_id: currentUser.id,
        owner_username: currentUser.username,
        title,
        description: newListDescription.trim() || null,
        is_public: Boolean(newListIsPublic),
      }
      const { data, error } = await supabase
        .from('lists')
        .insert(payload)
        .select('id, owner_id, owner_username, title, description, is_public, created_at, updated_at')
        .limit(1)
      if (error) throw error
      const created = data?.[0]
      setNewListTitle('')
      setNewListDescription('')
      setNewListIsPublic(true)
      await fetchLists()
      
      // Add list creation to feed
      if (created && created.is_public) {
        try {
          await supabase
            .from('book_events')
            .insert([
              {
                owner_id: currentUser.id,
                owner_username: currentUser.username,
                book_title: created.title,
                book_author: created.description || 'New list',
                book_cover: null,
                tags: ['list_created'],
                event_type: 'list_created',
                list_id: created.id,
              },
            ])
        } catch (feedError) {
          console.error('Failed to add list to feed', feedError)
        }
      }
      
      if (created) {
        setListsTab('mine')
        await openList(created)
      }
    } catch (error) {
      console.error('Create list failed', error)
      setListsMessage(error?.message || 'Failed to create list.')
    } finally {
      setListsLoading(false)
    }
  }

  const followList = async (listId) => {
    if (!supabase || !currentUser || !listId) return
    setListsMessage('')
    try {
      const { error } = await supabase
        .from('list_follows')
        .insert({ list_id: listId, user_id: currentUser.id })
      if (error) throw error
      await fetchLists()
    } catch (error) {
      console.error('Follow list failed', error)
      setListsMessage(error?.message || 'Failed to follow list.')
    }
  }

  const unfollowList = async (listId) => {
    if (!supabase || !currentUser || !listId) return
    setListsMessage('')
    try {
      const { error } = await supabase
        .from('list_follows')
        .delete()
        .eq('list_id', listId)
        .eq('user_id', currentUser.id)
      if (error) throw error
      if (selectedList?.id === listId) {
        setSelectedList(null)
        setSelectedListItems([])
      }
      await fetchLists()
    } catch (error) {
      console.error('Unfollow list failed', error)
      setListsMessage(error?.message || 'Failed to unfollow list.')
    }
  }

  const sendListInvite = async () => {
    if (!supabase || !currentUser || !selectedList?.id) return
    const username = listInviteUsername.trim()
    if (!username) return
    setListInviteError('')
    try {
      const { data: rows, error: userError } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', username)
        .limit(1)
      if (userError) throw userError
      const friend = rows?.[0]
      if (!friend) {
        setListInviteError('User not found.')
        return
      }
      if (friend.id === currentUser.id) {
        setListInviteError("You can't invite yourself.")
        return
      }

      const payload = {
        list_id: selectedList.id,
        inviter_id: currentUser.id,
        inviter_username: currentUser.username,
        invitee_id: friend.id,
        invitee_username: friend.username,
        status: 'pending',
      }
      const { error: inviteError } = await supabase.from('list_invites').insert(payload)
      if (inviteError) throw inviteError
      setListInviteUsername('')
      showSuccessMessage(`Invite sent to ${friend.username}`)
      await fetchOutgoingListInvites(selectedList.id)
    } catch (error) {
      console.error('Send list invite failed', error)
      setListInviteError(error?.message || 'Failed to send invite.')
    }
  }

  const revokeListInvite = async (inviteId) => {
    if (!supabase || !currentUser || !inviteId) return
    setListsMessage('')
    try {
      const invite = outgoingListInvites.find((inv) => inv.id === inviteId)
      const { error } = await supabase
        .from('list_invites')
        .delete()
        .eq('id', inviteId)
        .eq('inviter_id', currentUser.id)
      if (error) throw error
      if (selectedList?.id) {
        await fetchOutgoingListInvites(selectedList.id)
      }
      showSuccessMessage(`Invite removed${invite?.invitee_username ? ` for ${invite.invitee_username}` : ''}`)
    } catch (error) {
      console.error('Revoke invite failed', error)
      setListsMessage(error?.message || 'Failed to revoke invite.')
    }
  }

  const respondToListInvite = async (inviteId, status) => {
    if (!supabase || !currentUser || !inviteId) return
    setListsMessage('')
    try {
      const invite = pendingListInvites.find((inv) => inv.id === inviteId)
      const { error } = await supabase
        .from('list_invites')
        .update({ status })
        .eq('id', inviteId)
        .eq('invitee_id', currentUser.id)
      if (error) throw error
      await fetchLists()
      if (status === 'accepted') {
        showSuccessMessage(`Joined list: ${invite?.list_title ?? 'List'}`)
      } else {
        showSuccessMessage(`Invite declined${invite?.list_title ? `: ${invite.list_title}` : ''}`)
      }
    } catch (error) {
      console.error('Invite response failed', error)
      setListsMessage(error?.message || 'Failed to respond to invite.')
    }
  }

  const addBookToList = async (book) => {
    if (!supabase || !currentUser || !selectedList?.id || !book?.title) return
    setListsMessage('')
    try {
      const alreadyInList = selectedListItems.some((it) => {
        if (book.olKey && it.ol_key) return it.ol_key === book.olKey
        if (book.isbn && it.isbn) return it.isbn === book.isbn
        const t1 = String(it.book_title ?? '').trim().toLowerCase()
        const a1 = String(it.book_author ?? '').trim().toLowerCase()
        const t2 = String(book.title ?? '').trim().toLowerCase()
        const a2 = String(book.author ?? '').trim().toLowerCase()
        return Boolean(t1 && t2 && t1 === t2 && a1 === a2)
      })
      if (alreadyInList) {
        setListsMessage('That book is already in this list.')
        setListBookSearch('')
        return
      }
      const payload = {
        list_id: selectedList.id,
        added_by: currentUser.id,
        book_title: book.title,
        book_author: book.author ?? null,
        book_cover: book.cover ?? null,
        ol_key: book.olKey ?? null,
        isbn: book.isbn ?? null,
      }
      const { error } = await supabase.from('list_items').insert(payload)
      if (error) throw error
      setListBookSearch('')
      await fetchListItems(selectedList.id)
      setListsMessage(`Added to ${selectedList.title}`)
    } catch (error) {
      console.error('Add book to list failed', error)
      setListsMessage(error?.message || 'Failed to add book.')
    }
  }

  const addBookToSpecificList = async (listRow, book) => {
    if (!supabase || !currentUser || !listRow?.id || !book?.title) return
    setAddToListPendingByListId((prev) => ({ ...prev, [listRow.id]: true }))
    setAddToListStatusByListId((prev) => {
      const next = { ...prev }
      delete next[listRow.id]
      return next
    })
    try {
      const olKey = book.olKey ?? book.key ?? null
      const isbn = book.isbn ?? null
      const title = book.title
      const author = book.author ?? null

      let exists = false
      if (olKey) {
        const { data, error } = await supabase
          .from('list_items')
          .select('id')
          .eq('list_id', listRow.id)
          .eq('ol_key', olKey)
          .limit(1)
        if (error) throw error
        exists = Array.isArray(data) && data.length > 0
      } else if (isbn) {
        const { data, error } = await supabase
          .from('list_items')
          .select('id')
          .eq('list_id', listRow.id)
          .eq('isbn', isbn)
          .limit(1)
        if (error) throw error
        exists = Array.isArray(data) && data.length > 0
      } else {
        const { data, error } = await supabase
          .from('list_items')
          .select('id')
          .eq('list_id', listRow.id)
          .eq('book_title', title)
          .eq('book_author', author)
          .limit(1)
        if (error) throw error
        exists = Array.isArray(data) && data.length > 0
      }

      if (exists) {
        setAddToListStatusByListId((prev) => ({ ...prev, [listRow.id]: 'exists' }))
        return
      }

      const payload = {
        list_id: listRow.id,
        added_by: currentUser.id,
        book_title: title,
        book_author: author,
        book_cover: book.cover ?? null,
        ol_key: olKey,
        isbn,
      }

      const { error } = await supabase.from('list_items').insert(payload)
      if (error) throw error

      setAddToListStatusByListId((prev) => ({ ...prev, [listRow.id]: 'added' }))

      if (selectedList?.id === listRow.id) {
        await fetchListItems(listRow.id)
      }
    } catch (error) {
      console.error('Add book to specific list failed', error)
      setAddToListStatusByListId((prev) => ({ ...prev, [listRow.id]: 'error' }))
    } finally {
      setAddToListPendingByListId((prev) => {
        const next = { ...prev }
        delete next[listRow.id]
        return next
      })
      setAddToListLoading(false)
    }
  }

  const resolveOpenLibraryWorkKey = async (book) => {
    if (!book?.olKey) return null
    try {
      const response = await fetch(`https://openlibrary.org${book.olKey}.json`)
      if (response.ok) {
        const data = await response.json()
        return data.key
      }
    } catch (error) {
      console.error('Failed to resolve work key', error)
    }
    return null
  }

  const removeListItem = async (itemId) => {
    if (!supabase || !currentUser || !selectedList?.id || !itemId) return
    setListsMessage('')
    try {
      const item = selectedListItems.find((it) => it.id === itemId)
      const { error } = await supabase
        .from('list_items')
        .delete()
        .eq('id', itemId)
        .eq('list_id', selectedList.id)
      if (error) throw error
      await fetchListItems(selectedList.id)
      showSuccessMessage(`Removed${item?.book_title ? `: ${item.book_title}` : ''}`)
    } catch (error) {
      console.error('Remove list item failed', error)
      setListsMessage(error?.message || 'Failed to remove book.')
    }
  }

  useEffect(() => {
    if (!currentUser) return
    fetchLists()
    fetchRecommendations()
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser) return
    setIsPrivate(Boolean(currentUser.is_private))
    setProfileAvatarIcon(currentUser.avatar_icon || 'pixel_book_1')
    setProfileAvatarUrl(currentUser.avatar_url || '')
    const incoming = Array.isArray(currentUser.top_books) ? currentUser.top_books : []
    const slots = [incoming[0] ?? '', incoming[1] ?? '', incoming[2] ?? '', incoming[3] ?? '']
    setProfileTopBooks(slots)
  }, [currentUser?.id])

  const loadFriendRequests = async () => {
    if (!supabase || !currentUser?.id) return
    setFriendRequestsLoading(true)
    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select('id, requester_id, requester_username, recipient_id, recipient_username, status, created_at')
        .eq('status', 'pending')
        .or(`requester_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = Array.isArray(data) ? data : []
      const friendsSet = new Set((Array.isArray(currentUser?.friends) ? currentUser.friends : []).map((f) => (f ?? '').toLowerCase()))
      const filtered = rows.filter((r) => {
        const otherUsername = r.requester_id === currentUser.id ? r.recipient_username : r.requester_username
        if (!otherUsername) return true
        return !friendsSet.has(otherUsername.toLowerCase())
      })

      setIncomingFriendRequests(filtered.filter((r) => r.recipient_id === currentUser.id))
      setOutgoingFriendRequests(filtered.filter((r) => r.requester_id === currentUser.id))
    } catch (error) {
      console.error('Failed to load friend requests', error)
      setIncomingFriendRequests([])
      setOutgoingFriendRequests([])
    } finally {
      setFriendRequestsLoading(false)
    }
  }

  useEffect(() => {
    if (!currentUser?.id) return
    loadFriendRequests()
  }, [currentUser?.id])

  useEffect(() => {
    if (!supabase || !currentUser) return
    let canceled = false
    ;(async () => {
      console.log('[LIBRARY] Loading books for user:', currentUser.username)
      const rows = await loadSupabaseBooks(currentUser.username)
      if (!canceled) {
        console.log('[LIBRARY] Loaded books from Supabase:', rows.length)
        if (rows.length > 0) {
          setTracker(rows)
        }
      }
    })()
    return () => {
      canceled = true
    }
  }, [currentUser])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setTracker(JSON.parse(stored))
      } catch (error) {
        console.error('Failed to parse saved tracker', error)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tracker))
  }, [tracker])

  // Debounced search effect - matches mobile app behavior
  useEffect(() => {
    if (searchDebounce) {
      clearTimeout(searchDebounce)
    }
    
    // Don't search if query is empty or too short (minimum 2 characters)
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([])
      setHasSearched(false)
      return
    }
    
    setDiscoveryDisplayCount(6)
    const newDebounce = setTimeout(() => {
      fetchResults(searchQuery.trim(), 60)
    }, 500) // 500ms debounce to match mobile app
    setSearchDebounce(newDebounce)
    
    return () => {
      if (searchDebounce) {
        clearTimeout(searchDebounce)
      }
    }
  }, [searchQuery, showAllResults])

  const fetchResults = async (term, limit = 20) => {
    if (!term?.trim()) {
      setHasSearched(false)
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const trimmed = term.trim()
      const rawWords = trimmed
        .split(/\s+/)
        .map((w) => w.trim())
        .filter(Boolean)

      const normalizedWordsForQuery = rawWords.map((w) => {
        const lower = w.toLowerCase()
        if (w.length === 1 && /[a-z]/i.test(w)) return `${w}.`
        if ((lower === 'mrs' || lower === 'mr' || lower === 'ms' || lower === 'dr') && !w.endsWith('.')) return `${w}.`
        return w
      })

      const normalizedForQuery = normalizedWordsForQuery.join(' ')
      const termWithLanguage = normalizedForQuery.toLowerCase().includes('language:')
        ? normalizedForQuery
        : `${normalizedForQuery} language:eng`

      const termWithoutLanguage = normalizedForQuery
        .replace(/\blanguage\s*:\s*\w+/gi, '')
        .trim()

      const termWords = normalizedWordsForQuery
      const last1 = termWords.slice(-1).join(' ')
      const last2 = termWords.slice(-2).join(' ')
      const last3 = termWords.slice(-3).join(' ')

      const searchLower = normalizedForQuery.toLowerCase()
      const last1Lower = last1.toLowerCase()
      const last2Lower = last2.toLowerCase()
      const last3Lower = last3.toLowerCase()

      // Primary provider: ISBNdb (via Edge Function)
      const isbndbData = await invokeIsbndbSearch({ q: normalizedForQuery, pageSize: Math.min(50, limit) })
      let isbndbBooks = Array.isArray(isbndbData?.books)
        ? isbndbData.books
        : (Array.isArray(isbndbData?.data) ? isbndbData.data : [])

      if (termWords.length >= 4) {
        const titleOnlyQuery = termWords.slice(0, Math.max(2, termWords.length - 2)).join(' ').trim()
        if (titleOnlyQuery && titleOnlyQuery.toLowerCase() !== normalizedForQuery.toLowerCase()) {
          const extraData = await invokeIsbndbSearch({ q: titleOnlyQuery, pageSize: Math.min(50, limit) })
          const extraBooks = Array.isArray(extraData?.books)
            ? extraData.books
            : (Array.isArray(extraData?.data) ? extraData.data : [])
          if (Array.isArray(extraBooks) && extraBooks.length > 0) {
            isbndbBooks = [...isbndbBooks, ...extraBooks]
          }
        }

        const authorGuess = termWords.slice(-2).join(' ').trim()
        if (authorGuess && titleOnlyQuery) {
          const authorData = await invokeIsbndbSearch({ q: authorGuess, mode: 'author', pageSize: 50 })
          const authorBooks =
            (Array.isArray(authorData?.books) ? authorData.books : null) ||
            (Array.isArray(authorData?.data) ? authorData.data : null) ||
            (Array.isArray(authorData?.author?.books) ? authorData.author.books : null) ||
            (Array.isArray(authorData?.author?.data) ? authorData.author.data : null) ||
            []

          if (Array.isArray(authorBooks) && authorBooks.length > 0) {
            const titleWords = titleOnlyQuery
              .split(/\s+/)
              .map((w) => w.trim())
              .filter(Boolean)
            const filteredAuthorBooks = authorBooks.filter((b) => {
              const t = b?.title ?? b?.title_long ?? ''
              if (!t) return false
              return computeMeaningfulRelevance(t, '', titleWords) >= 2
            })
            if (filteredAuthorBooks.length > 0) {
              isbndbBooks = [...isbndbBooks, ...filteredAuthorBooks]
            }
          }
        }
      }

      const isbndbMapped = isbndbBooks
        .map((b) => {
          const result = mapIsbndbBookToResult(b, searchLower, last1Lower, last2Lower, last3Lower, termWords)
          if (!result) return null
          // Boost English editions in relevance scoring
          const lang = (b?.language || 'en').toLowerCase()
          const isEnglish = lang === 'en' || lang === 'eng' || lang.includes('english')
          if (isEnglish) {
            result.relevance = (result.relevance || 0) + 2
          }
          return result
        })
        .filter(Boolean)
        .filter((r) => (r.relevance ?? 0) >= 2)
        .sort((a, b) => {
          if (b.relevance !== a.relevance) return b.relevance - a.relevance
          return (b.year || 0) - (a.year || 0)
        })
        .slice(0, limit)

      // Fallback provider: Open Library
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(termWithLanguage)}&limit=${limit * 3}&fields=key,title,author_name,first_publish_year,cover_i,edition_count,ratings_average,subject,isbn,publisher,language`,
      )
      const data = await response.json()

      const primaryDocs = Array.isArray(data?.docs) ? data.docs : []
      let structuredDocs = []

      let englishEditionDocs = []
      try {
        const editionUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(normalizedForQuery)}&language=eng&limit=${limit * 2}&fields=key,title,author_name,first_publish_year,cover_i,edition_count,ratings_average,subject,isbn,publisher,language`
        const editionRes = await fetch(editionUrl)
        if (editionRes.ok) {
          const editionData = await editionRes.json()
          englishEditionDocs = Array.isArray(editionData?.docs) ? editionData.docs : []
        }
      } catch {
        englishEditionDocs = []
      }

      if (termWords.length >= 3) {
        const last1Word = String(termWords[termWords.length - 1] ?? '').trim()
        const last2Words = termWords.slice(-2).join(' ').trim()
        const titleGuess1 = termWords.slice(0, Math.max(1, termWords.length - 1)).join(' ').trim()
        const titleGuess2 = termWords.slice(0, Math.max(1, termWords.length - 2)).join(' ').trim()

        const queries = []
        if (titleGuess1 && last1Word && titleGuess1.toLowerCase() !== normalizedForQuery.toLowerCase()) {
          queries.push({ title: titleGuess1, author: last1Word })
        }
        if (titleGuess2 && last2Words && titleGuess2.toLowerCase() !== normalizedForQuery.toLowerCase()) {
          queries.push({ title: titleGuess2, author: last2Words })
        }

        if (queries.length > 0) {
          const structuredResults = await Promise.all(
            queries.map(async ({ title, author }) => {
              try {
                const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=${limit * 3}&fields=key,title,author_name,first_publish_year,cover_i,edition_count,ratings_average,subject,isbn,publisher,language`
                const res = await fetch(url)
                if (!res.ok) return []
                const json = await res.json()
                return Array.isArray(json?.docs) ? json.docs : []
              } catch {
                return []
              }
            }),
          )
          structuredDocs = structuredResults.flat()
        }
      }

      const openLibraryDocs = [...englishEditionDocs, ...primaryDocs, ...structuredDocs]

      // Filter and sort results for better relevance
      const mapped = openLibraryDocs
        .filter(doc => doc.title) // Only books with titles
        .map((doc) => ({
          key: doc.key,
          source: 'openlibrary',
          title: doc.title,
          author: doc.author_name?.[0] ?? 'Unknown author',
          year: doc.first_publish_year,
          cover: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : (doc.isbn?.[0] ? openLibraryIsbnCoverUrl(doc.isbn?.[0], 'M') : null),
          editionCount: doc.edition_count || 0,
          rating: doc.ratings_average || 0,
          subjects: doc.subject?.slice(0, 3) || [],
          isbn: doc.isbn?.[0] || null,
          publisher: doc.publisher?.[0] || null,
          language: doc.language?.[0] || null,
          // Calculate relevance score based on title and author match
          relevance: (() => {
            let score = computeMeaningfulRelevance(doc.title, doc.author_name?.[0] ?? '', termWords)
            if ((doc.language ?? []).includes('eng')) score += 1
            return score
          })()
        }))
        .filter((r) => (r.relevance ?? 0) >= 2)
        .sort((a, b) => {
          // Sort by relevance first, then by edition count
          if (b.relevance !== a.relevance) return b.relevance - a.relevance
          return b.editionCount - a.editionCount
        })
        .slice(0, limit) // Take only the requested limit after sorting

      // If English-bias yields very few hits, retry without language and merge.
      let merged = mapped
      if (merged.length < Math.min(12, limit) && termWithoutLanguage) {
        try {
          const fallbackRes = await fetch(
            `https://openlibrary.org/search.json?q=${encodeURIComponent(termWithoutLanguage)}&limit=${limit * 3}&fields=key,title,author_name,first_publish_year,cover_i,edition_count,ratings_average,subject,isbn,publisher,language`,
          )
          const fallbackData = await fallbackRes.json()
          const fallbackMapped = (fallbackData.docs || [])
            .filter((doc) => doc.title)
            .map((doc) => ({
              key: doc.key,
              title: doc.title,
              author: doc.author_name?.[0] ?? 'Unknown author',
              year: doc.first_publish_year,
              cover: doc.cover_i
                ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
                : (doc.isbn?.[0] ? openLibraryIsbnCoverUrl(doc.isbn?.[0], 'M') : null),
              editionCount: doc.edition_count || 0,
              rating: doc.ratings_average || 0,
              subjects: doc.subject?.slice(0, 3) || [],
              isbn: doc.isbn?.[0] || null,
              publisher: doc.publisher?.[0] || null,
              language: doc.language?.[0] || null,
              relevance: (() => {
                const titleLower = String(doc.title ?? '').toLowerCase()
                const authorLower = (doc.author_name ?? []).map((a) => String(a ?? '').toLowerCase())

                const titleMatchFull = titleLower.includes(searchLower)
                const titleMatchLast3 = last3Lower && titleLower.includes(last3Lower)
                const titleMatchLast2 = last2Lower && titleLower.includes(last2Lower)
                const titleMatchLast1 = last1Lower && titleLower.includes(last1Lower)

                const authorMatchAnyWord = termWords.some((w) => {
                  const wl = w.toLowerCase()
                  return wl.length >= 3 && authorLower.some((a) => a.includes(wl))
                })

                let score = 0
                if (titleMatchFull) score += 6
                if (titleMatchLast3) score += 6
                else if (titleMatchLast2) score += 5
                else if (titleMatchLast1) score += 4

                if (authorMatchAnyWord) score += 2

                if ((doc.language ?? []).includes('eng')) score += 1

                return score
              })(),
            }))

          const byKey = new Map()
          for (const r of [...merged, ...fallbackMapped]) {
            const k = r.key || `${r.title}|${r.author}`
            if (!byKey.has(k)) byKey.set(k, r)
          }
          merged = Array.from(byKey.values())
            .sort((a, b) => {
              if (b.relevance !== a.relevance) return b.relevance - a.relevance
              return b.editionCount - a.editionCount
            })
            .slice(0, limit)
        } catch (error) {
          console.error('Open Library fallback search failed', error)
        }
      }

      // Final merge: ISBNdb primary + Open Library fallback results.
      const byKey = new Map()
      for (const r of [...isbndbMapped, ...merged]) {
        const k = r.isbn ? `isbn:${r.isbn}` : (r.key || `${r.title}|${r.author}`)
        if (!byKey.has(k)) byKey.set(k, r)
      }
      merged = Array.from(byKey.values())
        .sort((a, b) => {
          if (b.relevance !== a.relevance) return b.relevance - a.relevance
          return (b.editionCount ?? 0) - (a.editionCount ?? 0)
        })
        .slice(0, limit)

      const queryAscii = normalizedForQuery === normalizedForQuery.replace(/[^\x00-\x7F]/g, '')
      const asciiRatio = (value) => {
        const s = String(value ?? '')
        if (!s) return 0
        const ascii = s.replace(/[^\x00-\x7F]/g, '').length
        return ascii / s.length
      }

      if (queryAscii) {
        const head = merged.slice(0, Math.min(6, merged.length))
        const tail = merged.slice(Math.min(6, merged.length))

        const upgradedHead = await Promise.all(
          head.map(async (r) => {
            if (r?.source !== 'openlibrary') return r
            const workKey = String(r?.key ?? '')
            if (!workKey.startsWith('/works/')) return r
            if (asciiRatio(r.title) >= 0.8) return r

            try {
              const url = `https://openlibrary.org${workKey}/editions.json?limit=50`
              const res = await fetch(url)
              if (!res.ok) return r
              const data = await res.json()
              const entries = Array.isArray(data?.entries) ? data.entries : []
              if (entries.length === 0) return r

              let best = { score: r.relevance ?? 0, title: r.title, isbn: r.isbn ?? null }
              for (const e of entries) {
                const t = String(e?.title ?? '').trim()
                if (!t) continue

                const languages = Array.isArray(e?.languages) ? e.languages : []
                const langKeys = languages.map((l) => String(l?.key ?? '')).filter(Boolean)
                const isEnglish = langKeys.some((k) => k.includes('/languages/eng'))

                let s = computeMeaningfulRelevance(t, r.author ?? '', termWords)
                if (isEnglish) s += 2
                if (asciiRatio(t) >= 0.9) s += 1

                if (s > best.score) {
                  const isbn =
                    (Array.isArray(e?.isbn_13) ? e.isbn_13[0] : null) ||
                    (Array.isArray(e?.isbn_10) ? e.isbn_10[0] : null) ||
                    null
                  best = { score: s, title: t, isbn }
                }
              }

              if (best.title && best.title !== r.title) {
                const next = { ...r, title: best.title, relevance: Math.max(r.relevance ?? 0, best.score) }
                if (best.isbn) {
                  next.isbn = best.isbn
                  next.cover = openLibraryIsbnCoverUrl(best.isbn, 'M')
                }
                return next
              }
            } catch {
              return r
            }

            return r
          }),
        )

        merged = [...upgradedHead, ...tail]
          .sort((a, b) => {
            if (b.relevance !== a.relevance) return b.relevance - a.relevance
            return (b.editionCount ?? 0) - (a.editionCount ?? 0)
          })
          .slice(0, limit)
      }
      
      setSearchResults(merged)
      setHasSearched(true)
    } catch (err) {
      console.error('Open Library search failed', err)
    } finally {
      setIsSearching(false)
    }
  }

  const openAuthorModal = async (authorName) => {
    const name = (authorName ?? '').trim()
    if (!name || name === 'Unknown author') return

    const normalize = (value) =>
      String(value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    const requestedTokens = normalize(name)
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
    const matchesRequestedAuthor = (candidateAuthor) => {
      const cand = normalize(candidateAuthor)
      if (!cand) return false
      if (requestedTokens.length === 0) return true
      return requestedTokens.every((t) => cand.includes(t))
    }

    setIsAuthorModalOpen(true)
    setAuthorModalName(name)
    setAuthorModalBooks([])
    setAuthorModalLoading(true)

    try {
      const isbndbData = await invokeIsbndbSearch({ q: name, mode: 'author', pageSize: 50 })
      const isbndbBooks =
        (Array.isArray(isbndbData?.books) ? isbndbData.books : null) ||
        (Array.isArray(isbndbData?.data) ? isbndbData.data : null) ||
        (Array.isArray(isbndbData?.author?.books) ? isbndbData.author.books : null) ||
        (Array.isArray(isbndbData?.author?.data) ? isbndbData.author.data : null) ||
        []

      const isbndbMapped = (Array.isArray(isbndbBooks) ? isbndbBooks : [])
        .map((b) => mapIsbndbBookToResult(b, name.toLowerCase(), '', '', '', []))
        .filter(Boolean)
        .filter((b) => matchesRequestedAuthor(b.author))

      if (isbndbMapped.length > 0) {
        setAuthorModalBooks(isbndbMapped)
        return
      }

      const response = await fetch(
        `https://openlibrary.org/search.json?author=${encodeURIComponent(name)}&limit=100&fields=key,title,author_name,first_publish_year,cover_i,edition_count,ratings_average,subject,isbn,publisher,language`,
      )
      const data = await response.json()

      const authorLower = name.toLowerCase()

      const mapped = (data.docs || [])
        .filter((doc) => {
          if (!doc.title) return false
          const title = doc.title.toLowerCase()
          if (
            title.includes('best of') ||
            title.includes('anthology') ||
            title.includes('collection') ||
            title.includes('complete works') ||
            title.includes('selected works')
          ) {
            return false
          }
          if (doc.author_name?.some((a) => matchesRequestedAuthor(a))) return true
          return false
        })
        .map((doc) => ({
          key: doc.key,
          title: doc.title,
          author: doc.author_name?.[0] ?? name,
          year: doc.first_publish_year,
          cover: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : (doc.isbn?.[0] ? openLibraryIsbnCoverUrl(doc.isbn?.[0], 'M') : null),
          editionCount: doc.edition_count || 0,
          rating: doc.ratings_average || 0,
          subjects: doc.subject?.slice(0, 3) || [],
          isbn: doc.isbn?.[0] || null,
          publisher: doc.publisher?.[0] || null,
          language: doc.language?.[0] || null,
        }))
        .sort((a, b) => {
          if (b.editionCount !== a.editionCount) return b.editionCount - a.editionCount
          return (b.year || 0) - (a.year || 0)
        })

      setAuthorModalBooks(mapped)
    } catch (error) {
      console.error('Author modal search failed', error)
      setAuthorModalBooks([])
    } finally {
      setAuthorModalLoading(false)
    }
  }

  const updateBook = async (title, updates) => {
    let finalUpdates = updates
    
    setTracker((prev) =>
      prev.map((book) => {
        if (book.title !== title) return book
        const merged = { ...book, ...updates }

        // Keep status/tags consistent.
        if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
          const nextTags = Array.isArray(merged.tags) ? merged.tags : []
          const status = deriveStatusFromTags(nextTags, merged.status ?? 'to-read')
          finalUpdates = { ...updates, status, tags: Array.from(new Set(nextTags)) }
          return { ...merged, status, tags: Array.from(new Set(nextTags)) }
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
          const existingTags = Array.isArray(book.tags) ? book.tags : []
          const owned = existingTags.includes('Owned')
          const nextTags = Array.from(
            new Set([updates.status, ...(owned ? ['Owned'] : [])].filter(Boolean)),
          )

          const nowIso = new Date().toISOString()
          const isMarkingRead = updates.status === 'Read' && book.status !== 'Read'
          const isLeavingRead = updates.status !== 'Read' && book.status === 'Read'
          const nextReadAt = isMarkingRead ? nowIso : isLeavingRead ? null : (book.read_at ?? null)
          const nextStatusUpdatedAt = updates.status !== book.status ? nowIso : (book.status_updated_at ?? null)

          finalUpdates = {
            ...updates,
            tags: nextTags,
            status: updates.status,
            read_at: nextReadAt,
            status_updated_at: nextStatusUpdatedAt,
          }
          return {
            ...merged,
            tags: nextTags,
            status: updates.status,
            read_at: nextReadAt,
            status_updated_at: nextStatusUpdatedAt,
          }
        }

        return normalizeBookTags(merged)
      }),
    )
    setSelectedBook((book) =>
      book?.title === title ? { ...book, ...updates } : book,
    )
    
    // Sync to database
    if (supabase && currentUser) {
      try {
        const dbUpdates = {}
        if (finalUpdates.status !== undefined) dbUpdates.status = finalUpdates.status
        if (finalUpdates.tags !== undefined) dbUpdates.tags = finalUpdates.tags
        if (finalUpdates.progress !== undefined) dbUpdates.progress = finalUpdates.progress
        if (finalUpdates.rating !== undefined) dbUpdates.rating = finalUpdates.rating
        if (finalUpdates.review !== undefined) dbUpdates.review = finalUpdates.review
        if (finalUpdates.spoiler_warning !== undefined) dbUpdates.spoiler_warning = finalUpdates.spoiler_warning
        if (finalUpdates.cover !== undefined) dbUpdates.cover = finalUpdates.cover
        if (finalUpdates.isbn !== undefined) dbUpdates.isbn = finalUpdates.isbn
        if (finalUpdates.read_at !== undefined) dbUpdates.read_at = finalUpdates.read_at
        if (finalUpdates.status_updated_at !== undefined) dbUpdates.status_updated_at = finalUpdates.status_updated_at
        
        if (Object.keys(dbUpdates).length > 0) {
          dbUpdates.updated_at = new Date().toISOString()
          await supabase
            .from('bookmosh_books')
            .update(dbUpdates)
            .eq('owner', currentUser.username)
            .eq('title', title)
        }
      } catch (error) {
        console.error('Failed to sync book update to database:', error)
      }
    }
  }

  const handleAddBook = async (book, status = 'to-read', showInlineSuccess = false) => {
    const incomingIsbn = (book?.isbn ?? '').toString().trim()
    const incomingTitle = String(book?.title ?? '').trim().toLowerCase()
    const incomingAuthor = String(book?.author ?? '').trim().toLowerCase()
    const bookKey = book.key || book.olKey || incomingIsbn || incomingTitle
    
    // Check if already in tracker
    const already = tracker.some((item) => {
      const existingIsbn = (item?.isbn ?? '').toString().trim()
      if (incomingIsbn && existingIsbn && incomingIsbn === existingIsbn) return true
      const t1 = String(item?.title ?? '').trim().toLowerCase()
      const a1 = String(item?.author ?? '').trim().toLowerCase()
      return Boolean(incomingTitle && t1 && incomingTitle === t1 && incomingAuthor && a1 && incomingAuthor === a1)
    })
    
    if (already) {
      if (showInlineSuccess) {
        markButtonAdded(bookKey, status)
      } else {
        setSuccessModal({ show: true, book, list: 'Already in Library', alreadyAdded: true })
        setTimeout(() => setSuccessModal({ show: false, book: null, list: '' }), 2000)
      }
      return
    }
    
    const entry = {
      title: book.title,
      author: book.author,
      status: status,
      tags: Array.from(new Set([status])),
      cover: book.cover ?? null,
      year: book.year ?? null,
      isbn: book.isbn ?? null,
      olKey: book.key ?? book.olKey ?? null,
      publisher: book.publisher ?? null,
      language: book.language ?? null,
      editionCount: book.editionCount ?? 0,
      progress: status === 'Reading' ? 0 : (status === 'Read' ? 100 : 0),
      rating: 0,
      read_at: status === 'Read' ? new Date().toISOString() : null,
      status_updated_at: new Date().toISOString(),
    }
    
    // Add to local tracker state
    setTracker((prev) => [entry, ...prev])
    
    // Show inline success or modal
    if (showInlineSuccess) {
      markButtonAdded(bookKey, status)
    } else {
      const listName = status === 'Read' ? 'Read List' : status === 'Reading' ? 'Reading List' : 'To-Read List'
      setSuccessModal({ show: true, book: entry, list: listName, alreadyAdded: false })
      setTimeout(() => setSuccessModal({ show: false, book: null, list: '' }), 2500)
    }
    
    // Sync to database
    if (supabase && currentUser) {
      try {
        await supabase.from('bookmosh_books').insert({
          owner: currentUser.username,
          title: entry.title,
          author: entry.author,
          cover: entry.cover,
          status: entry.status,
          tags: entry.tags,
          progress: entry.progress,
          rating: entry.rating,
          review: '',
          read_at: entry.read_at,
          status_updated_at: entry.status_updated_at,
        })
      } catch (error) {
        console.error('Failed to sync book to database:', error)
      }
    }
    
    logBookEvent(entry, 'created')
  }

  const handleAddBookOwned = async (book, showInlineSuccess = false) => {
    const incomingIsbn = (book?.isbn ?? '').toString().trim()
    const incomingTitle = String(book?.title ?? '').trim().toLowerCase()
    const incomingAuthor = String(book?.author ?? '').trim().toLowerCase()
    const bookKey = book.key || book.olKey || incomingIsbn || incomingTitle
    const existingIndex = tracker.findIndex((item) => {
      const existingIsbn = (item?.isbn ?? '').toString().trim()
      if (incomingIsbn && existingIsbn && incomingIsbn === existingIsbn) return true
      const t1 = String(item?.title ?? '').trim().toLowerCase()
      const a1 = String(item?.author ?? '').trim().toLowerCase()
      return Boolean(incomingTitle && t1 && incomingTitle === t1 && incomingAuthor && a1 && incomingAuthor === a1)
    })
    
    if (existingIndex >= 0) {
      // Book exists - add Owned tag if not already present
      const existing = tracker[existingIndex]
      const currentTags = Array.isArray(existing.tags) ? existing.tags : []
      if (currentTags.includes('Owned')) {
        if (showInlineSuccess) {
          markButtonAdded(bookKey, 'Owned')
        } else {
          setSuccessModal({ show: true, book: existing, list: 'Already Owned', alreadyAdded: true })
          setTimeout(() => setSuccessModal({ show: false, book: null, list: '' }), 2000)
        }
        return
      }
      const updatedTags = [...currentTags, 'Owned']
      const updated = { ...existing, tags: updatedTags }
      setTracker((prev) => {
        const next = [...prev]
        next[existingIndex] = updated
        return next
      })
      if (showInlineSuccess) {
        markButtonAdded(bookKey, 'Owned')
      } else {
        setSuccessModal({ show: true, book: updated, list: 'Owned Collection', alreadyAdded: false })
        setTimeout(() => setSuccessModal({ show: false, book: null, list: '' }), 2500)
      }
      
      // Update in database
      if (supabase && currentUser) {
        try {
          await supabase.from('bookmosh_books')
            .update({ tags: updatedTags })
            .eq('owner', currentUser.username)
            .eq('title', existing.title)
        } catch (error) {
          console.error('Failed to update book tags in database:', error)
        }
      }
      return
    }
    
    // New book - add with Owned tag
    const entry = {
      title: book.title,
      author: book.author,
      status: 'to-read',
      tags: ['to-read', 'Owned'],
      cover: book.cover ?? null,
      year: book.year ?? null,
      isbn: book.isbn ?? null,
      olKey: book.key ?? book.olKey ?? null,
      publisher: book.publisher ?? null,
      language: book.language ?? null,
      editionCount: book.editionCount ?? 0,
      progress: 0,
      rating: 0,
    }
    
    setTracker((prev) => [entry, ...prev])
    if (showInlineSuccess) {
      markButtonAdded(bookKey, 'Owned')
    } else {
      setSuccessModal({ show: true, book: entry, list: 'Owned Collection', alreadyAdded: false })
      setTimeout(() => setSuccessModal({ show: false, book: null, list: '' }), 2500)
    }
    
    // Sync to database
    if (supabase && currentUser) {
      try {
        await supabase.from('bookmosh_books').insert({
          owner: currentUser.username,
          title: entry.title,
          author: entry.author,
          cover: entry.cover,
          status: entry.status,
          tags: entry.tags,
          progress: entry.progress,
          rating: entry.rating,
          review: '',
        })
      } catch (error) {
        console.error('Failed to sync book to database:', error)
      }
    }
    
    logBookEvent(entry, 'created')
  }

  const setLibraryFilter = ({ status, owned }) => {
    if (typeof status === 'string') {
      setLibraryStatusFilter(status)
    }
    if (typeof owned === 'boolean') {
      setLibraryOwnedOnly(owned)
    }
  }

  const resolveUserId = async (username) => {
    if (!supabase || !username) return null
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single()
      if (error) return null
      return data?.id ?? null
    } catch {
      return null
    }
  }

  const logBookEvent = async (book, eventType = 'tags_updated') => {
    if (!supabase || !currentUser) return
    try {
      const normalized = normalizeBookTags(book)
      await supabase
        .from('book_events')
        .insert([
          {
            owner_id: currentUser.id,
            owner_username: currentUser.username,
            book_title: normalized.title,
            book_author: normalized.author,
            book_cover: normalized.cover ?? null,
            tags: normalized.tags ?? [],
            event_type: eventType,
          },
        ])
    } catch (error) {
      console.error('book_events insert failed', error)
    }
  }

  const fetchBookActivity = async (bookTitle) => {
    if (!supabase || !currentUser || !bookTitle) return
    setBookActivityLoading(true)
    try {
      // Get activity for this book from user and their friends
      const friends = Array.isArray(currentUser.friends) ? currentUser.friends : []
      const usernames = [currentUser.username, ...friends]
      
      const { data, error } = await supabase
        .from('book_events')
        .select('*')
        .eq('book_title', bookTitle)
        .in('owner_username', usernames)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (error) throw error
      setBookActivityFeed(data || [])
    } catch (error) {
      console.error('Failed to fetch book activity:', error)
      setBookActivityFeed([])
    } finally {
      setBookActivityLoading(false)
    }
  }

  const fetchFeed = async () => {
    if (!supabase || !currentUser) return
    try {
      let query = supabase
        .from('book_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (feedScope === 'me') {
        query = query.eq('owner_id', currentUser.id)
      } else if (feedScope === 'friends') {
        const friends = Array.isArray(currentUser.friends) ? currentUser.friends : []
        if (!friends.length) {
          setFeedItems([])
          return
        }
        query = query.in('owner_username', friends)
      }

      let recQuery = supabase
        .from('recommendations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (feedScope === 'me') {
        recQuery = recQuery.or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
      } else if (feedScope === 'friends') {
        const friends = Array.isArray(currentUser.friends) ? currentUser.friends : []
        if (!friends.length) {
          setFeedItems([])
          setFeedDisplayCount(10)
          setFeedLikes({})
          setLikeNotifications([])
          return
        }
        recQuery = recQuery.or(`sender_username.in.(${friends.join(',')}),recipient_username.in.(${friends.join(',')})`)
      }

      const [eventsRes, recsRes] = await Promise.all([query, recQuery])
      if (eventsRes.error) throw eventsRes.error
      if (recsRes.error) throw recsRes.error

      const mappedEvents = (eventsRes.data ?? []).map((e) => ({ ...e, item_type: 'book_event' }))
      const mappedRecs = (recsRes.data ?? []).map((r) => ({
        ...r,
        item_type: 'recommendation',
      }))

      const items = [...mappedEvents, ...mappedRecs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50)

      setFeedItems(items)
      setFeedDisplayCount(10)

      // Fetch likes for these feed items
      const bookEventIds = items.filter((i) => i.item_type !== 'recommendation').map((i) => i.id).filter(Boolean)
      if (bookEventIds.length > 0) {
        const { data: likesData } = await supabase
          .from('feed_likes')
          .select('book_id, user_id, username')
          .in('book_id', bookEventIds)
        const likesMap = {}
        for (const item of items) {
          if (item.item_type === 'recommendation') continue
          const itemLikes = (likesData ?? []).filter((l) => l.book_id === item.id)
          likesMap[item.id] = {
            count: itemLikes.length,
            likedByMe: itemLikes.some((l) => l.user_id === currentUser?.id),
            users: itemLikes.map((l) => l.username),
          }
        }
        setFeedLikes(likesMap)
      } else {
        setFeedLikes({})
      }

      // Fetch likes on current user's posts (for notifications)
      const { data: myBooks } = await supabase
        .from('bookmosh_books')
        .select('id, title, author, cover')
        .eq('owner', currentUser.username)
        .limit(100)
      const myBookIds = (myBooks ?? []).map((b) => b.id).filter(Boolean)
      
      if (myBookIds.length > 0) {
        const { data: likesOnMyPosts } = await supabase
          .from('feed_likes')
          .select('book_id, user_id, username, created_at')
          .in('book_id', myBookIds)
          .neq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(20)
        
        const notifications = (likesOnMyPosts ?? []).map((like) => {
          const book = (myBooks ?? []).find((b) => b.id === like.book_id)
          return {
            id: `${like.book_id}-${like.user_id}`,
            type: 'like',
            username: like.username,
            bookTitle: book?.title ?? 'a book',
            bookAuthor: book?.author ?? null,
            bookCover: book?.cover ?? null,
            createdAt: like.created_at,
          }
        })
        setLikeNotifications(notifications)
      } else {
        setLikeNotifications([])
      }
    } catch (error) {
      console.error('Feed fetch failed', error)
      setFeedItems([])
      setFeedDisplayCount(10)
      setFeedLikes({})
      setLikeNotifications([])
    }
  }

  const toggleFeedLike = async (bookId) => {
    if (!supabase || !currentUser?.id || !bookId) return
    const current = feedLikes[bookId] ?? { count: 0, likedByMe: false, users: [] }
    try {
      if (current.likedByMe) {
        // Unlike
        await supabase
          .from('feed_likes')
          .delete()
          .eq('book_id', bookId)
          .eq('user_id', currentUser.id)
        setFeedLikes((prev) => ({
          ...prev,
          [bookId]: {
            count: Math.max(0, (prev[bookId]?.count ?? 1) - 1),
            likedByMe: false,
            users: (prev[bookId]?.users ?? []).filter((u) => u !== currentUser.username),
          },
        }))
      } else {
        // Like
        await supabase.from('feed_likes').insert({
          book_id: bookId,
          user_id: currentUser.id,
          username: currentUser.username,
        })
        setFeedLikes((prev) => ({
          ...prev,
          [bookId]: {
            count: (prev[bookId]?.count ?? 0) + 1,
            likedByMe: true,
            users: [...(prev[bookId]?.users ?? []), currentUser.username],
          },
        }))

        // Send email notification to post owner
        const feedItem = feedItems.find(item => item.id === bookId)
        if (feedItem && feedItem.owner_username !== currentUser.username) {
          const { data: ownerData } = await supabase
            .from('users')
            .select('email')
            .eq('username', feedItem.owner_username)
            .single()
          
          if (ownerData?.email) {
            sendFeedLikeNotification(ownerData.email, {
              likerName: currentUser.username,
              bookTitle: feedItem.book_title,
              bookAuthor: feedItem.book_author
            }).catch(err => {
              console.error('[EMAIL] Failed to send feed like notification:', err)
            })
          }
        }
      }
    } catch (err) {
      console.error('Toggle like failed', err)
    }
  }

  useEffect(() => {
    setFeedDisplayCount(10)
  }, [feedScope])

  const fetchActiveMoshes = async () => {
    if (!supabase || !currentUser) return
    try {
      const { data, error } = await supabase
        .from('moshes')
        .select('*')
        .contains('participants_ids', [currentUser.id])
        .eq('archived', moshArchiveFilter === 'archived')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error

      const items = data ?? []
      setActiveMoshes(items)

      const unreadEntries = await Promise.all(
        items.map(async (mosh) => {
          const { data: reads } = await supabase
            .from('mosh_reads')
            .select('last_read_at')
            .eq('mosh_id', mosh.id)
            .eq('user_id', currentUser.id)
            .single()

          const lastReadAt = reads?.last_read_at ?? null
          let msgQuery = supabase
            .from('mosh_messages')
            .select('id', { count: 'exact', head: true })
            .eq('mosh_id', mosh.id)
            .neq('sender_id', currentUser.id)
          if (lastReadAt) {
            msgQuery = msgQuery.gt('created_at', lastReadAt)
          }
          const { count } = await msgQuery
          return [mosh.id, count ?? 0]
        }),
      )

      setUnreadByMoshId(Object.fromEntries(unreadEntries))
    } catch (error) {
      console.error('Active moshes fetch failed', error)
      setActiveMoshes([])
      setUnreadByMoshId({})
    }
  }

  const setMoshUrlState = ({ isOpen, moshId } = {}) => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (isOpen) params.set('mosh', '1')
    else params.delete('mosh')
    if (moshId) params.set('moshId', String(moshId))
    else params.delete('moshId')
    const qs = params.toString()
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`
    // Use pushState instead of replaceState so back button works
    window.history.pushState({}, '', next)
  }

  const closeMoshPanel = () => {
    setIsMoshPanelOpen(false)
    setActiveMosh(null)
    setActiveMoshMessages([])
    setMoshMessageReactions({})
    setMoshDraft('')
    setShowMentionDropdown(false)
    setMoshUrlState({ isOpen: false, moshId: null })
  }

  // Create new pit functions
  const searchNewPitMembers = async () => {
    if (!newPitMemberQuery.trim() || !currentUser) return
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, avatar_icon, avatar_url')
        .ilike('username', `%${newPitMemberQuery.trim()}%`)
        .neq('id', currentUser.id)
        .limit(10)
      if (error) throw error
      const filtered = (data || []).filter((u) => !newPitMembers.some((m) => m.id === u.id))
      setNewPitMemberResults(filtered)
    } catch (error) {
      console.error('Search members error:', error)
    }
  }

  const addNewPitMember = (user) => {
    if (newPitMembers.some((m) => m.id === user.id)) return
    setNewPitMembers([...newPitMembers, user])
    setNewPitMemberQuery('')
    setNewPitMemberResults([])
  }

  const addNewPitMemberByUsername = async (username) => {
    if (newPitMembers.some((m) => m.username === username)) return
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', username)
        .single()
      
      if (error || !data) {
        console.error('Failed to find user:', username, error)
        return
      }
      
      setNewPitMembers((prev) => [...prev, { id: data.id, username: data.username }])
      setNewPitMemberQuery('')
    } catch (err) {
      console.error('Add member error:', err)
    }
  }

  const removeNewPitMember = (userId) => {
    setNewPitMembers(newPitMembers.filter((m) => m.id !== userId))
  }

  const createNewPit = async () => {
    if (!newPitName.trim() || newPitMembers.length === 0 || !currentUser) return
    setCreatingPit(true)
    try {
      const participantIds = [currentUser.id, ...newPitMembers.map((m) => m.id)]
      const participantUsernames = [currentUser.username, ...newPitMembers.map((m) => m.username)]

      // Insert - ignore PGRST204 errors (no rows returned is fine for insert)
      const { error } = await supabase
        .from('moshes')
        .insert({
          title: newPitName.trim(),
          creator_id: currentUser.id,
          participants_ids: participantIds,
          participants_usernames: participantUsernames,
          archived: false,
        })

      // PGRST204 means no rows returned - that's OK for insert
      if (error && error.code !== 'PGRST204') throw error

      setShowCreatePitModal(false)
      setNewPitName('')
      setNewPitMembers([])
      setNewPitMemberQuery('')
      setNewPitMemberResults([])
      await fetchActiveMoshes()
    } catch (error) {
      // Ignore PGRST204 - it just means no rows returned which is fine
      if (error?.code === 'PGRST204') {
        setShowCreatePitModal(false)
        setNewPitName('')
        setNewPitMembers([])
        await fetchActiveMoshes()
        return
      }
      console.error('Create pit error:', error)
    } finally {
      setCreatingPit(false)
    }
  }

  const closeCreatePitModal = () => {
    setShowCreatePitModal(false)
    setNewPitName('')
    setNewPitMembers([])
    setNewPitMemberQuery('')
    setNewPitMemberResults([])
  }

  // Share book in pit functions
  const searchBooksToShareInPit = async () => {
    if (!shareBookInPitQuery.trim() || !currentUser) return
    try {
      const { data, error } = await supabase
        .from('bookmosh_books')
        .select('id, title, author, cover')
        .eq('owner', currentUser.username)
        .ilike('title', `%${shareBookInPitQuery.trim()}%`)
        .limit(10)
      if (error) throw error
      setShareBookInPitResults(data || [])
    } catch (error) {
      console.error('Search books error:', error)
    }
  }

  const shareBookInPit = async (book) => {
    if (!activeMosh?.id || !currentUser || !book) return
    try {
      const bookMessage = `📚 Shared a book: "${book.title}" by ${book.author}`
      const { error } = await supabase.from('mosh_messages').insert([{
        mosh_id: activeMosh.id,
        sender_id: currentUser.id,
        sender_username: currentUser.username,
        body: bookMessage,
        book_share: {
          title: book.title,
          author: book.author,
          cover: book.cover,
          book_id: book.id,
        },
      }])
      if (error) throw error
      setShowShareBookInPit(false)
      setShareBookInPitQuery('')
      setShareBookInPitResults([])
    } catch (error) {
      console.error('Share book error:', error)
    }
  }

  // View all shared books in pit
  const loadSharedBooksInPit = async () => {
    if (!activeMosh?.id) return
    try {
      const { data, error } = await supabase
        .from('mosh_messages')
        .select('*')
        .eq('mosh_id', activeMosh.id)
        .not('book_share', 'is', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      const books = (data || []).map((msg) => msg.book_share).filter(Boolean)
      setSharedBooksInPit(books)
      setShowSharedBooksInPit(true)
    } catch (error) {
      console.error('Load shared books error:', error)
      setSharedBooksInPit([])
    }
  }

  const closeSharedBooksInPit = () => {
    setShowSharedBooksInPit(false)
    setSharedBooksInPit([])
  }

  const backToMoshes = () => {
    setActiveMosh(null)
    setActiveMoshMessages([])
    setMoshMessageReactions({})
    setMoshDraft('')
    setShowMentionDropdown(false)
    setMoshUrlState({ isOpen: true, moshId: null })
  }

  const formatMoshTimestamp = (ts) => {
    const raw = ts ? new Date(ts) : null
    if (!raw || Number.isNaN(raw.getTime())) return ''
    return raw.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const loadMoshMessageReactions = async (messageIds) => {
    if (!supabase || !currentUser?.id) return
    const ids = Array.isArray(messageIds) ? messageIds.filter(Boolean) : []
    if (!ids.length) {
      setMoshMessageReactions({})
      return
    }
    try {
      const { data, error } = await supabase
        .from('mosh_message_reactions')
        .select('message_id, user_id, reaction')
        .in('message_id', ids)
      if (error) throw error

      const next = {}
      for (const id of ids) {
        const rows = (data ?? []).filter((r) => r.message_id === id)
        const up = rows.filter((r) => r.reaction === 'up').length
        const down = rows.filter((r) => r.reaction === 'down').length
        const mine = rows.find((r) => r.user_id === currentUser.id)?.reaction ?? null
        next[id] = { up, down, mine }
      }
      setMoshMessageReactions(next)
    } catch (error) {
      console.error('[MOSH] Failed to load message reactions:', error)
      setMoshMessageReactions({})
    }
  }

  const toggleMoshReaction = async (messageId, reaction) => {
    if (!supabase || !currentUser?.id || !messageId) return
    const id = String(messageId)
    const nextReaction = reaction === 'up' ? 'up' : 'down'
    const current = moshMessageReactions[id] ?? { up: 0, down: 0, mine: null }
    const mine = current.mine

    const applyLocal = (mineNext) => {
      const baseUp = current.up - (mine === 'up' ? 1 : 0)
      const baseDown = current.down - (mine === 'down' ? 1 : 0)
      const nextUp = baseUp + (mineNext === 'up' ? 1 : 0)
      const nextDown = baseDown + (mineNext === 'down' ? 1 : 0)
      setMoshMessageReactions((prev) => ({ ...prev, [id]: { up: Math.max(0, nextUp), down: Math.max(0, nextDown), mine: mineNext } }))
    }

    try {
      if (mine === nextReaction) {
        applyLocal(null)
        const { error } = await supabase
          .from('mosh_message_reactions')
          .delete()
          .eq('message_id', id)
          .eq('user_id', currentUser.id)
        if (error) throw error
        return
      }

      applyLocal(nextReaction)
      const { error } = await supabase
        .from('mosh_message_reactions')
        .upsert(
          [{ message_id: id, user_id: currentUser.id, username: currentUser.username, reaction: nextReaction }],
          { onConflict: 'message_id,user_id' },
        )
      if (error) throw error
    } catch (error) {
      console.error('[MOSH] Toggle reaction failed:', error)
      loadMoshMessageReactions(Object.keys(moshMessageReactions))
    }
  }

  const openMosh = async (mosh) => {
    if (!supabase || !currentUser || !mosh) return
    setIsMoshPanelOpen(true)
    setActiveMosh(mosh)
    setMoshUrlState({ isOpen: true, moshId: mosh?.id ?? null })
    try {
      const { data } = await supabase
        .from('mosh_messages')
        .select('*')
        .eq('mosh_id', mosh.id)
        .order('created_at')
      setActiveMoshMessages(data ?? [])
      await loadMoshMessageReactions((data ?? []).map((m) => m.id))
      await supabase
        .from('mosh_reads')
        .upsert(
          [{
            mosh_id: mosh.id,
            user_id: currentUser.id,
            username: currentUser.username,
            last_read_at: new Date().toISOString(),
          }],
          { onConflict: 'mosh_id,user_id' },
        )
      setUnreadByMoshId((prev) => ({ ...prev, [mosh.id]: 0 }))
    } catch (error) {
      console.error('[MOSH] Failed to load messages:', error)
    }
  }

  const openMoshById = async (moshId) => {
    if (!supabase || !currentUser) return
    const id = String(moshId ?? '').trim()
    if (!id) return
    try {
      const { data, error } = await supabase
        .from('moshes')
        .select('*')
        .eq('id', id)
        .limit(1)
      if (error) throw error
      const mosh = Array.isArray(data) ? data[0] : null
      if (mosh) {
        await openMosh(mosh)
      } else {
        setIsMoshPanelOpen(true)
        setActiveMosh(null)
        setMoshUrlState({ isOpen: true, moshId: null })
      }
    } catch (error) {
      console.error('Open mosh by id failed', error)
      setIsMoshPanelOpen(true)
      setActiveMosh(null)
      setMoshUrlState({ isOpen: true, moshId: null })
    }
  }

  useEffect(() => {
    if (!supabase || !currentUser?.id || !activeMosh?.id) return

    const moshId = String(activeMosh.id)

    const channel = supabase
      .channel(`mosh_messages:${moshId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mosh_messages',
          filter: `mosh_id=eq.${moshId}`,
        },
        (payload) => {
          const nextMsg = payload?.new
          const nextId = String(nextMsg?.id ?? '')
          if (!nextId) return

          setActiveMoshMessages((prev) => {
            const base = Array.isArray(prev) ? prev : []
            const has = base.some((m) => String(m?.id ?? '') === nextId)
            if (has) return base
            return [...base, nextMsg]
          })

          setMoshMessageReactions((prev) => {
            const base = prev ?? {}
            if (base[nextId]) return base
            return { ...base, [nextId]: { up: 0, down: 0, mine: null } }
          })
        },
      )
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch (e) {
        console.warn('[MOSH] Failed to remove realtime channel', e)
      }
    }
  }, [supabase, currentUser?.id, activeMosh?.id])

  useEffect(() => {
    if (!activeMosh?.id) return
    // When the initial message list loads for an open pit, jump to the bottom.
    const t = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    }, 0)
    return () => clearTimeout(t)
  }, [activeMosh?.id, activeMoshMessages.length])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const moshId = (params.get('moshId') ?? '').trim()
    const moshOpen = (params.get('mosh') ?? '').trim()
    if (!moshId && !moshOpen) return
    if (!currentUser || !supabase) return
    if (isMoshPanelOpen) return

    ;(async () => {
      if (moshId) {
        await openMoshById(moshId)
      } else {
        setIsMoshPanelOpen(true)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, supabase])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!isMoshPanelOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isMoshPanelOpen])

  const handleMoshDraftChange = (value) => {
    setMoshDraft(value)
    
    // Check for @ mentions
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const afterAt = value.slice(lastAtIndex + 1)
      const hasSpace = afterAt.includes(' ')
      
      if (!hasSpace && afterAt.length >= 0) {
        setMoshMentionQuery(afterAt.toLowerCase())
        setShowMentionDropdown(true)
      } else {
        setShowMentionDropdown(false)
      }
    } else {
      setShowMentionDropdown(false)
    }
  }

  const insertMention = (username) => {
    const lastAtIndex = moshDraft.lastIndexOf('@')
    const beforeAt = moshDraft.slice(0, lastAtIndex)
    setMoshDraft(beforeAt + '@' + username + ' ')
    setShowMentionDropdown(false)
  }

  const archiveMosh = async (moshId) => {
    if (!supabase || !currentUser) return
    
    try {
      const { error } = await supabase
        .from('moshes')
        .update({ archived: true })
        .eq('id', moshId)
      
      if (error) throw error
      
      // Refresh moshes list and close current mosh
      await fetchActiveMoshes()
      setActiveMosh(null)
    } catch (error) {
      console.error('[MOSH] Archive failed:', error)
    }
  }

  const sendMoshMessage = async () => {
    if (!supabase || !currentUser || !activeMosh) {
      console.error('[MOSH] Missing requirements for sending message')
      return
    }
    const body = moshDraft.trim()
    if (!body) return
    
    console.log('[MOSH] Sending message:', { moshId: activeMosh.id, body })
    setMoshDraft('')
    setShowMentionDropdown(false)
    
    try {
      const { data, error } = await supabase
        .from('mosh_messages')
        .insert([
          {
            mosh_id: activeMosh.id,
            sender_id: currentUser.id,
            sender_username: currentUser.username,
            body,
          },
        ])
        .select()
      
      if (error) {
        console.error('[MOSH] Message insert error:', error)
        throw error
      }
      
      console.log('[MOSH] Message sent successfully:', data)
      setActiveMoshMessages((prev) => {
        const base = Array.isArray(prev) ? prev : []
        const incoming = Array.isArray(data) ? data : []
        if (incoming.length === 0) return base
        const seen = new Set(base.map((m) => String(m?.id ?? '')))
        const merged = [...base]
        for (const msg of incoming) {
          const id = String(msg?.id ?? '')
          if (!id || seen.has(id)) continue
          seen.add(id)
          merged.push(msg)
        }
        console.log('[MOSH] Updated messages count:', merged.length)
        return merged
      })

      if (Array.isArray(data) && data.length > 0) {
        const nextId = data[0]?.id
        if (nextId) {
          setMoshMessageReactions((prev) => ({ ...prev, [nextId]: { up: 0, down: 0, mine: null } }))
        }
      }
      
      // Auto-scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
      
      await supabase
        .from('mosh_reads')
        .upsert(
          [{
            mosh_id: activeMosh.id,
            user_id: currentUser.id,
            username: currentUser.username,
            last_read_at: new Date().toISOString(),
          }],
          { onConflict: 'mosh_id,user_id' },
        )

      // Send email notifications to other participants
      const otherParticipants = (activeMosh.participants_usernames || []).filter(
        u => u !== currentUser.username
      )
      
      if (otherParticipants.length > 0) {
        const { data: participantEmails } = await supabase
          .from('users')
          .select('username, email')
          .in('username', otherParticipants)
        
        if (participantEmails && participantEmails.length > 0) {
          participantEmails.forEach(participant => {
            if (participant.email) {
              sendPitMessageNotification(participant.email, {
                senderName: currentUser.username,
                pitTitle: activeMosh.mosh_title || activeMosh.book_title,
                pitId: activeMosh.id,
                messagePreview: body.slice(0, 100)
              }).catch(err => {
                console.error('[EMAIL] Failed to send pit message notification:', err)
              })
            }
          })
        }
      }
      setUnreadByMoshId((prev) => ({ ...prev, [activeMosh.id]: 0 }))
    } catch (error) {
      console.error('[MOSH] Send message failed:', error)
    }
  }

  const sendMoshInvite = async (book, friendUsername, customTitle = '') => {
    if (!supabase || !currentUser) {
      console.error('[MOSH] Missing supabase or currentUser')
      return
    }
    if (!friendUsername) {
      console.error('[MOSH] Missing friendUsername')
      return
    }

    console.log('[MOSH] Starting mosh invite:', { book: book.title, friend: friendUsername, currentUserId: currentUser.id })

    const friendId = await resolveUserId(friendUsername)
    if (!friendId) {
      console.error('[MOSH] Could not resolve friend ID for:', friendUsername)
      setFriendMessage('Could not find that friend profile.')
      return
    }

    console.log('[MOSH] Resolved friend ID:', friendId)

    // Check for duplicate mosh
    const { data: existingMoshes } = await supabase
      .from('moshes')
      .select('*')
      .eq('book_title', book.title)
      .contains('participants_ids', [currentUser.id, friendId])
      .eq('archived', false)
    
    if (existingMoshes && existingMoshes.length > 0) {
      throw new Error(`You already have an active mosh for "${book.title}" with ${friendUsername}`)
    }

    try {
      const normalized = normalizeBookTags(book)
      const participantsIds = Array.from(new Set([currentUser.id, friendId]))
      const participantsUsernames = Array.from(new Set([currentUser.username, friendUsername]))

      console.log('[MOSH] Creating mosh with:', { participantsIds, participantsUsernames })

      const { data, error } = await supabase
        .from('moshes')
        .insert([
          {
            book_title: normalized.title,
            book_author: normalized.author,
            book_cover: normalized.cover ?? null,
            mosh_title: customTitle || normalized.title,
            created_by: currentUser.id,
            created_by_username: currentUser.username,
            participants_ids: participantsIds,
            participants_usernames: participantsUsernames,
            is_public: moshInviteIsPublic,
            archived: false,
          },
        ])
        .select()
      
      if (error) {
        console.error('[MOSH] Insert error:', error)
        throw error
      }

      console.log('[MOSH] Mosh created:', data)

      const created = data?.[0]
      if (created) {
        console.log('[MOSH] Creating mosh_reads entries')
        const { error: readsError } = await supabase
          .from('mosh_reads')
          .insert(
            participantsIds.map((id) => ({
              mosh_id: created.id,
              user_id: id,
              username: id === currentUser.id ? currentUser.username : friendUsername,
              last_read_at: new Date().toISOString(),
            })),
          )
        
        if (readsError) {
          console.error('[MOSH] mosh_reads insert error:', readsError)
        }

        await fetchActiveMoshes()
        setIsMoshPanelOpen(true)
        await openMosh(created)
        console.log('[MOSH] Mosh invite complete')
      }
    } catch (error) {
      console.error('[MOSH] Create mosh failed:', error)
      setFriendMessage('Failed to start pit.')
      throw error
    }
  }

  const openMoshInvite = (book) => {
    if (!currentUser) return
    setMoshInviteBook(normalizeBookTags(book))
    setMoshInviteFriends([])
    setMoshInviteSearch('')
    setMoshInviteTitle('')
    setMoshInviteIsPublic(true)
    setMoshInviteError('')
    setIsMoshInviteOpen(true)
  }

  const closeMoshInvite = () => {
    setIsMoshInviteOpen(false)
    setMoshInviteBook(null)
    setMoshInviteFriends([])
    setMoshInviteSearch('')
    setMoshInviteTitle('')
    setMoshInviteIsPublic(true)
    setMoshInviteError('')
    setMoshInviteLoading(false)
  }

  const openMoshAddFriends = () => {
    if (!currentUser || !activeMosh) return
    setMoshAddFriends([])
    setMoshAddSearch('')
    setMoshAddError('')
    setMoshAddLoading(false)
    setIsMoshAddFriendsOpen(true)
  }

  const closeMoshAddFriends = () => {
    setIsMoshAddFriendsOpen(false)
    setMoshAddFriends([])
    setMoshAddSearch('')
    setMoshAddError('')
    setMoshAddLoading(false)
  }

  const addMoshAddFriend = (username) => {
    if (!moshAddFriends.includes(username)) {
      setMoshAddFriends((prev) => [...prev, username])
      setMoshAddSearch('')
    }
  }

  const removeMoshAddFriend = (username) => {
    setMoshAddFriends((prev) => prev.filter((f) => f !== username))
  }

  const confirmMoshAddFriends = async () => {
    if (!supabase || !currentUser || !activeMosh) return
    if (moshAddFriends.length === 0) {
      setMoshAddError('Select at least one friend to add.')
      return
    }

    setMoshAddLoading(true)
    setMoshAddError('')

    try {
      const existingIds = Array.isArray(activeMosh.participants_ids) ? activeMosh.participants_ids : []
      const existingUsernames = Array.isArray(activeMosh.participants_usernames) ? activeMosh.participants_usernames : []

      const newIds = []
      for (const username of moshAddFriends) {
        const id = await resolveUserId(username)
        if (!id) {
          throw new Error(`Could not find user ${username}`)
        }
        newIds.push(id)
      }

      const nextParticipantsIds = Array.from(new Set([...existingIds, ...newIds]))
      const nextParticipantsUsernames = Array.from(new Set([...existingUsernames, ...moshAddFriends]))

      const { data: updatedRows, error: updateError } = await supabase
        .from('moshes')
        .update({
          participants_ids: nextParticipantsIds,
          participants_usernames: nextParticipantsUsernames,
        })
        .eq('id', activeMosh.id)
        .select('*')

      if (updateError) throw updateError

      const updatedMosh = Array.isArray(updatedRows) ? updatedRows[0] : null
      if (updatedMosh) {
        setActiveMosh(updatedMosh)
      } else {
        // Fallback refresh
        await fetchActiveMoshes()
      }

      const readsPayload = newIds
        .filter((id) => !existingIds.includes(id))
        .map((id, idx) => ({
          mosh_id: activeMosh.id,
          user_id: id,
          username: moshAddFriends[idx] ?? 'reader',
          last_read_at: new Date(0).toISOString(),
        }))

      if (readsPayload.length > 0) {
        const { error: readsError } = await supabase
          .from('mosh_reads')
          .upsert(readsPayload, { onConflict: 'mosh_id,user_id' })
        if (readsError) {
          console.error('[MOSH] Failed to create mosh_reads for new participants:', readsError)
        }
      }

      await fetchActiveMoshes()
      closeMoshAddFriends()
    } catch (error) {
      console.error('[MOSH] Add friends failed:', error)
      setMoshAddError(error?.message || 'Failed to add friends.')
      setMoshAddLoading(false)
    }
  }

  const addMoshInviteFriend = (friendUsername) => {
    if (!moshInviteFriends.includes(friendUsername)) {
      setMoshInviteFriends([...moshInviteFriends, friendUsername])
      setMoshInviteSearch('')
    }
  }

  const removeMoshInviteFriend = (friendUsername) => {
    setMoshInviteFriends(moshInviteFriends.filter(f => f !== friendUsername))
  }

  const confirmMoshInvite = async () => {
    if (!currentUser || !moshInviteBook) return
    if (moshInviteFriends.length === 0) {
      setMoshInviteError('Select at least one friend to invite.')
      return
    }
    setMoshInviteLoading(true)
    setMoshInviteError('')
    try {
      // Send invite to first friend for now (multi-participant moshes need backend support)
      await sendMoshInvite(moshInviteBook, moshInviteFriends[0], moshInviteTitle)
      closeMoshInvite()
    } catch (error) {
      setMoshInviteError(error.message || 'Failed to start pit.')
      setMoshInviteLoading(false)
    }
  }

  useEffect(() => {
    if (!supabase || !currentUser) return
    fetchFeed()
  }, [currentUser, feedScope])

  useEffect(() => {
    if (!supabase || !currentUser) return
    fetchActiveMoshes()
  }, [currentUser, moshArchiveFilter])

  // Handle initial URL params (on page load/refresh)
  useEffect(() => {
    if (!supabase || !currentUser) return
    if (typeof window === 'undefined') return
    
    const params = new URLSearchParams(window.location.search)
    const profileParam = params.get('profile')
    const listIdParam = params.get('listId')
    
    if (profileParam && !selectedFriend) {
      viewFriendProfile(profileParam, true)
    }

    if (listIdParam && !selectedList) {
      openListById(listIdParam, { skipUrlUpdate: true })
    }
  }, [currentUser, supabase])

  // Handle browser back/forward button
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const moshParam = params.get('mosh')
      const moshIdParam = params.get('moshId')
      const profileParam = params.get('profile')
      const listIdParam = params.get('listId')

      // Handle profile navigation
      if (profileParam) {
        // Open profile if not already viewing this one
        if (selectedFriend?.username !== profileParam) {
          viewFriendProfile(profileParam, true)
        }
      } else if (selectedFriend) {
        // Close profile if URL no longer has profile param
        setSelectedFriend(null)
        setFriendBooks([])
        setFriendBooksOffset(0)
        setFriendBooksHasMore(false)
        setFriendBooksStatusFilter('all')
        setFriendLists([])
      }

      // Handle list navigation
      if (listIdParam) {
        if (String(selectedList?.id) !== String(listIdParam)) {
          openListById(listIdParam, { skipUrlUpdate: true })
        }
      } else if (selectedList) {
        setSelectedList(null)
        setSelectedListItems([])
      }

      // If no mosh params in URL, close the pit panel
      if (!moshParam) {
        setIsMoshPanelOpen(false)
        setActiveMosh(null)
        setActiveMoshMessages([])
        setMoshDraft('')
        setShowMentionDropdown(false)
      } else if (moshParam && !moshIdParam) {
        // Show pit list
        setIsMoshPanelOpen(true)
        setActiveMosh(null)
        setActiveMoshMessages([])
      } else if (moshIdParam) {
        // Open specific pit
        openMoshById(moshIdParam)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [selectedFriend, selectedList])

  const setBookStatusTag = (title, nextStatus) => {
    const current = tracker.find((b) => b.title === title)
    const next = normalizeBookTags({ ...(current ?? { title }), status: nextStatus })
    // Auto-set progress to 100% when marking as Read
    if (nextStatus === 'Read') {
      updateBook(title, { status: nextStatus, progress: 100 })
    } else {
      updateBook(title, { status: nextStatus })
    }
    logBookEvent(next, 'status_changed')
  }

  const toggleBookOwned = (title) => {
    const current = tracker.find((b) => b.title === title)
    const tags = Array.isArray(current?.tags) ? current.tags : []
    const hasOwned = tags.includes('Owned')
    const status = deriveStatusFromTags(tags, current?.status ?? 'to-read')
    const nextTags = Array.from(
      new Set([status, ...(hasOwned ? [] : ['Owned'])].filter(Boolean)),
    )
    updateBook(title, { tags: nextTags })
    logBookEvent({ ...(current ?? { title }), tags: nextTags, status }, 'tags_updated')
    setSelectedBook((prev) => (prev && prev.title === title ? { ...prev, tags: nextTags } : prev))
  }

  const handleAuthModeSwitch = (mode) => {
    setAuthMode(mode)
    setAuthMessage('')
    if (mode !== 'reset') {
      setResetPassword('')
      setResetPasswordConfirm('')
    }
  }

  const handleForgotPassword = async () => {
    setAuthMessage('')
    if (!supabase) {
      setAuthMessage('Supabase not configured. Please check environment variables.')
      return
    }

    const email = authIdentifier.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      setAuthMessage('Enter your email above, then click Forgot password.')
      return
    }

    setAuthLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://bookmosh.com',
      })
      if (error) {
        setAuthMessage(error.message || 'Password reset failed')
        return
      }
      setAuthMessage('Check your email for a reset link.')
    } catch (error) {
      console.error('Reset password failed', error)
      setAuthMessage('Password reset failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setAuthMessage('')
    if (!supabase) {
      setAuthMessage('Supabase not configured. Please check environment variables.')
      return
    }

    const next = resetPassword.trim()
    if (!next || next.length < 6) {
      setAuthMessage('Password must be at least 6 characters.')
      return
    }
    if (next !== resetPasswordConfirm.trim()) {
      setAuthMessage('Passwords do not match.')
      return
    }

    setAuthLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) {
        setAuthMessage(error.message || 'Password update failed')
        return
      }
      await supabase.auth.signOut()
      setAuthIdentifier('')
      setAuthPassword('')
      setResetPassword('')
      setResetPasswordConfirm('')
      setAuthMode('login')
      setAuthMessage('Password updated. Please sign in.')
    } catch (error) {
      console.error('Password update failed', error)
      setAuthMessage('Password update failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const viewFriendProfile = async (friendUsername, skipPushState = false) => {
    try {
      // Navigate to new URL with profile parameter
      if (!skipPushState && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        params.set('profile', friendUsername)
        const next = `${window.location.pathname}?${params.toString()}${window.location.hash || ''}`
        window.location.href = next
        return // Exit early since we're navigating
      }

      // Get friend's user info
      const { data: profileRows, error: profileError } = await supabase
        .from('users')
        .select('id, username, is_private, avatar_icon, avatar_url, top_books')
        .eq('username', friendUsername)
        .limit(1)
      if (profileError) throw profileError
      const friend = profileRows?.[0]
      
      if (!friend) {
        setFriendMessage('Friend not found')
        return
      }

      setSelectedFriend(friend)
      setFriendBooks([])
      setFriendBooksOffset(0)
      setFriendBooksHasMore(false)
      setFriendBooksStatusFilter('all')
      setFriendLists([])

      const PAGE_SIZE = 20

      // Fetch Top 4 books specifically (if friend has top_books set)
      const topTitles = Array.isArray(friend.top_books) ? friend.top_books.filter(Boolean).slice(0, 4) : []
      let topBooksWithData = []
      if (topTitles.length > 0) {
        const { data: topBooksRows } = await supabase
          .from('bookmosh_books')
          .select('*')
          .eq('owner', friendUsername)
          .in('title', topTitles)
        topBooksWithData = Array.isArray(topBooksRows) ? topBooksRows : []
      }

      // Get first page of friend's books
      setFriendBooksLoading(true)
      try {
        const firstPage = await fetchFriendBooks(friendUsername, 0, PAGE_SIZE)
        const normalized = Array.isArray(firstPage) ? firstPage : []
        // Merge Top 4 books into friendBooks (dedupe by title)
        const topTitlesSet = new Set(topBooksWithData.map(b => b.title))
        const combined = [...topBooksWithData, ...normalized.filter(b => !topTitlesSet.has(b.title))]
        setFriendBooks(combined)
        setFriendBooksOffset(normalized.length)
        setFriendBooksHasMore(normalized.length === PAGE_SIZE)
      } finally {
        setFriendBooksLoading(false)
      }

      // Get friend's public lists
      setFriendListsLoading(true)
      try {
        const { data: listsRows, error: listsError } = await supabase
          .from('lists')
          .select('id, owner_id, owner_username, title, description, is_public, created_at, updated_at')
          .eq('owner_id', friend.id)
          .eq('is_public', true)
          .order('updated_at', { ascending: false })
          .limit(50)
        if (listsError) throw listsError
        const rawLists = Array.isArray(listsRows) ? listsRows : []

        const listIds = rawLists.map((l) => l.id).filter(Boolean)
        let countsByListId = {}
        let previewCoversByListId = {}
        if (listIds.length) {
          const { data: items, error: itemsError } = await supabase
            .from('list_items')
            .select('list_id, book_cover, created_at')
            .in('list_id', listIds)
            .order('created_at', { ascending: false })
          if (itemsError) throw itemsError
          const rows = Array.isArray(items) ? items : []
          for (const row of rows) {
            const listId = row.list_id
            if (!listId) continue
            countsByListId[listId] = (countsByListId[listId] ?? 0) + 1
            if ((previewCoversByListId[listId]?.length ?? 0) >= 4) continue
            previewCoversByListId[listId] = previewCoversByListId[listId] ?? []
            if (row.book_cover) previewCoversByListId[listId].push(row.book_cover)
          }
        }

        setFriendLists(
          rawLists.map((l) => ({
            ...l,
            item_count: countsByListId[l.id] ?? 0,
            preview_covers: previewCoversByListId[l.id] ?? [],
          })),
        )
      } finally {
        setFriendListsLoading(false)
      }
    } catch (error) {
      console.error('Error loading friend profile:', error)
      setFriendMessage('Failed to load friend profile')
    }
  }

  const loadMoreFriendBooks = async () => {
    if (!selectedFriend?.username || friendBooksLoading || !friendBooksHasMore) return
    const PAGE_SIZE = 20
    setFriendBooksLoading(true)
    try {
      const nextPage = await fetchFriendBooks(selectedFriend.username, friendBooksOffset, PAGE_SIZE)
      const incoming = Array.isArray(nextPage) ? nextPage : []
      setFriendBooks((prev) => [...(Array.isArray(prev) ? prev : []), ...incoming])
      setFriendBooksOffset((prev) => prev + incoming.length)
      setFriendBooksHasMore(incoming.length === PAGE_SIZE)
    } finally {
      setFriendBooksLoading(false)
    }
  }

  const closeFriendProfile = (skipHistoryBack = false, skipScroll = false) => {
    setSelectedFriend(null)
    setFriendBooks([])
    setFriendBooksOffset(0)
    setFriendBooksHasMore(false)
    setFriendBooksStatusFilter('all')
    setFriendLists([])

    // Clear profile from URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      params.delete('profile')
      const qs = params.toString()
      const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`
      if (skipHistoryBack) {
        window.history.replaceState({}, '', next)
      } else {
        window.history.pushState({}, '', next)
      }
      
      if (!skipScroll) {
        // Scroll back to community section
        setTimeout(() => scrollToSection('community'), 100)
      }
    }
  }

  const saveProfile = async () => {
    if (!supabase || !currentUser) return
    setProfileSaving(true)
    setProfileMessage('')
    try {
      await updateProfileFields({})
    } catch (error) {
      console.error('Profile save failed', error)
      setProfileMessage(error?.message || 'Failed to save.')
    } finally {
      setProfileSaving(false)
    }
  }

  const updateProfileFields = async (overrides) => {
    if (!supabase || !currentUser) return
    const payload = {
      avatar_icon: profileAvatarUrl ? null : profileAvatarIcon,
      avatar_url: profileAvatarUrl ? profileAvatarUrl : null,
      top_books: Array.isArray(profileTopBooks) ? profileTopBooks.slice(0, 4) : ['', '', '', ''],
      is_private: Boolean(isPrivate),
      updated_at: new Date().toISOString(),
      ...(overrides || {}),
    }
    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', currentUser.id)
      .select('id, username, friends, is_private, avatar_icon, avatar_url, top_books')
      .limit(1)

    if (error) throw error
    const nextUser = data?.[0]
    if (nextUser) {
      setCurrentUser(nextUser)
      localStorage.setItem('bookmosh-user', JSON.stringify(nextUser))
    }
    setProfileMessage('Saved.')
  }

  const onProfileUpload = async (file) => {
    if (!file) return
    const maxBytes = 1024 * 1024 * 1.5
    if (file.size > maxBytes) {
      setProfileMessage('Image too large. Please choose an image under ~1.5MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      setProfileAvatarUrl(result)
      ;(async () => {
        try {
          setProfileSaving(true)
          setProfileMessage('')
          await updateProfileFields({ avatar_url: result || null, avatar_icon: null })
        } catch (error) {
          console.error('Profile avatar upload save failed', error)
          setProfileMessage(error?.message || 'Failed to save.')
        } finally {
          setProfileSaving(false)
        }
      })()
    }
    reader.onerror = () => {
      setProfileMessage('Failed to read image.')
    }
    reader.readAsDataURL(file)
  }

  const addTopBook = (title) => {
    if (!title) return
    setProfileTopBooks((prev) => {
      const next = Array.isArray(prev) ? prev.slice(0, 4) : ['', '', '', '']
      const normalized = title.toLowerCase()
      if (next.some((t) => (t ?? '').toLowerCase() === normalized)) return next
      const idx = next.findIndex((t) => !t)
      if (idx === -1) return next
      next[idx] = title
      return next
    })
  }

  const setTopBookSlot = (slotIndex, title) => {
    setProfileTopBooks((prev) => {
      const next = Array.isArray(prev) ? prev.slice(0, 4) : ['', '', '', '']
      next[slotIndex] = title || ''
      ;(async () => {
        try {
          setProfileSaving(true)
          setProfileMessage('')
          await updateProfileFields({ top_books: next })
        } catch (error) {
          console.error('Profile top books save failed', error)
          setProfileMessage(error?.message || 'Failed to save.')
        } finally {
          setProfileSaving(false)
        }
      })()
      return next
    })
  }

  const clearTopBookSlot = (slotIndex) => {
    setTopBookSlot(slotIndex, '')
  }

  const openTopBookModal = (slotIndex, seed = '') => {
    setProfileTopBookSlotIndex(slotIndex)
    setProfileTopBookSearch(seed)
    setProfileTopBookResults([])
    setProfileTopBookError('')
    setProfileTopBookLoading(false)
    setIsProfileTopBookModalOpen(true)
  }

  const closeTopBookModal = () => {
    setIsProfileTopBookModalOpen(false)
    setProfileTopBookSearch('')
    setProfileTopBookResults([])
    setProfileTopBookError('')
    setProfileTopBookLoading(false)
  }

  const searchTopBook = async () => {
    const q = profileTopBookSearch.trim()
    if (!q) return
    setProfileTopBookLoading(true)
    setProfileTopBookError('')
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=key,title,author_name,cover_i,isbn,first_publish_year`,
      )
      if (!response.ok) throw new Error('Search failed')
      const data = await response.json()
      const docs = Array.isArray(data?.docs) ? data.docs : []
      setProfileTopBookResults(docs)
    } catch (error) {
      console.error('Top book search failed', error)
      setProfileTopBookResults([])
      setProfileTopBookError('Search failed.')
    } finally {
      setProfileTopBookLoading(false)
    }
  }

  const selectTopBookResult = (result) => {
    const title = (result?.title ?? '').toString().trim()
    if (!title) return
    const author = (result?.author_name?.[0] ?? 'Unknown author').toString()
    const cover = result?.cover_i ? `https://covers.openlibrary.org/b/id/${result.cover_i}-M.jpg` : null
    const isbn = result?.isbn?.[0] || null
    const olKey = result?.key || null
    const book = { title, author, cover, isbn, olKey }

    // Ensure it exists in library so cover editing works and cover choice persists.
    handleAddBook(book, 'to-read')

    // Set it into the chosen slot.
    setTopBookSlot(profileTopBookSlotIndex, title)
    closeTopBookModal()
  }

  const startMosh = async (bookTitle, friendUsername = null) => {
    const fromTracker = tracker.find((b) => b.title === bookTitle)
    const fallback = { title: bookTitle, author: fromTracker?.author ?? 'Unknown author', cover: fromTracker?.cover ?? null, tags: fromTracker?.tags ?? [fromTracker?.status ?? 'to-read'], status: fromTracker?.status ?? 'to-read' }
    const book = fromTracker ?? fallback
    if (friendUsername) {
      await sendMoshInvite(book, friendUsername)
      return
    }
    openMoshInvite(book)
  }

  const scrollToDiscovery = () => {
    if (typeof window === 'undefined') return
    document.getElementById('discovery')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleLogin = async () => {
    setAuthMessage('')
    if (!supabase) {
      setAuthMessage('Supabase not configured.')
      return
    }
    
    if (!authIdentifier || !authPassword) {
      setAuthMessage('Please enter email and password.')
      return
    }
    
    setAuthLoading(true)
    try {
      // SIMPLE AUTH: Just verify password and get user profile
      const identifier = authIdentifier.trim().toLowerCase()
      
      // Look up user by username or email
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .or(`username.eq.${identifier},email.eq.${identifier}`)
        .limit(1)
      
      if (error || !users || users.length === 0) {
        setAuthMessage('User not found')
        return
      }
      
      const user = users[0]
      
      // Verify password with Supabase auth (but don't use session)
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: authPassword,
      })
      
      if (authError) {
        setAuthMessage('Invalid password')
        return
      }
      
      // Store user profile directly in localStorage
      console.log('[AUTH] Login successful, storing user:', user.username)
      localStorage.setItem('bookmosh-user', JSON.stringify(user))
      
      setCurrentUser(user)
      setAuthIdentifier('')
      setAuthPassword('')
    } catch (error) {
      console.error('[AUTH] Login error:', error)
      setAuthMessage('Login failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignup = async () => {
    setAuthMessage('')
    if (!supabase) {
      setAuthMessage('Supabase not configured. Please check environment variables.')
      return
    }
    
    if (!signupData.username || !signupData.email || !signupData.password) {
      setAuthMessage('Please fill in all fields.')
      return
    }
    
    setAuthLoading(true)
    try {
      // Create auth user (email confirmation disabled in Supabase settings)
      const { data: { user }, error: authError } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            username: signupData.username,
          }
        }
      })
      
      if (authError) throw authError
      
      // Check if user was invited by someone
      const params = new URLSearchParams(window.location.search)
      const invitedBy = params.get('invitedBy')
      
      // Create user profile
      const userProfile = {
        id: user.id,
        username: signupData.username,
        email: signupData.email,
        password_hash: 'managed_by_supabase_auth',
        friends: invitedBy ? [invitedBy] : [],
        is_private: false,
      }
      
      try {
        await createUser(userProfile)
      } catch (profileError) {
        console.error('Profile creation failed:', profileError)
        // Continue anyway - profile might already exist
      }
      
      // If invited, send friend request to inviter
      if (invitedBy && supabase) {
        try {
          const inviterUser = await searchUsers(invitedBy)
          if (inviterUser.length > 0) {
            const inviter = inviterUser[0]
            await supabase.from('friend_requests').insert([{
              requester_id: user.id,
              requester_username: signupData.username,
              recipient_id: inviter.id,
              recipient_username: inviter.username,
              status: 'accepted',
            }])
            
            // Update inviter's friends list
            const inviterFriends = Array.isArray(inviter.friends) ? inviter.friends : []
            if (!inviterFriends.includes(signupData.username)) {
              await supabase
                .from('users')
                .update({ friends: [...inviterFriends, signupData.username] })
                .eq('id', inviter.id)
            }
            
            console.log('[AUTH] Auto-friended inviter:', invitedBy)
          }
        } catch (friendError) {
          console.error('[AUTH] Auto-friend failed:', friendError)
          // Don't block signup if friending fails
        }
      }
      
      // Log user in immediately
      localStorage.setItem('bookmosh-user', JSON.stringify(userProfile))
      setCurrentUser(userProfile)
      console.log('[AUTH] Signup successful, user logged in:', userProfile.username)
      
      setSignupData({ username: '', email: '', password: '' })
      setAuthMessage('')
      
      // Clean up invite param from URL
      if (invitedBy) {
        const newUrl = window.location.pathname + window.location.hash
        window.history.replaceState({}, '', newUrl)
      }
    } catch (error) {
      setAuthMessage(error.message || 'Signup failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const deleteAllBooks = async () => {
    if (!currentUser) return
    
    const confirmed = window.confirm('Are you sure you want to delete ALL books from your library? This cannot be undone.')
    if (!confirmed) return
    
    try {
      // Delete from Supabase
      if (supabase) {
        const { error } = await supabase
          .from(SUPABASE_TABLE)
          .delete()
          .eq('owner', currentUser.username)
        
        if (error) {
          console.error('[LIBRARY] Delete all failed:', error)
          alert('Failed to delete books from database')
          return
        }
      }
      
      // Clear local state
      setTracker([])
      alert('All books deleted successfully')
    } catch (error) {
      console.error('[LIBRARY] Delete all exception:', error)
      alert('Failed to delete books')
    }
  }

  const updateReadBooksProgress = async () => {
    if (!currentUser) return
    
    const confirmed = window.confirm('Update all books marked as "Read" to 100% progress?')
    if (!confirmed) return
    
    try {
      // Update local state first
      const updatedBooks = tracker.map(book => {
        if (book.status === 'Read' && book.progress !== 100) {
          return { ...book, progress: 100 }
        }
        return book
      })
      
      setTracker(updatedBooks)
      
      // Update in Supabase
      if (supabase) {
        const readBooks = tracker.filter(b => b.status === 'Read' && b.progress !== 100)
        
        for (const book of readBooks) {
          const { error } = await supabase
            .from(SUPABASE_TABLE)
            .update({ progress: 100 })
            .eq('owner', currentUser.username)
            .eq('title', book.title)
          
          if (error) {
            console.error('[LIBRARY] Update progress failed for:', book.title, error)
          }
        }
        
        // Show success modal
        setSuccessModal({ 
          show: true, 
          book: null, 
          list: `Updated ${readBooks.length} book${readBooks.length === 1 ? '' : 's'} to 100% progress`, 
          alreadyAdded: false 
        })
        setTimeout(() => setSuccessModal({ show: false, book: null, list: '' }), 2500)
      }
    } catch (error) {
      console.error('[LIBRARY] Update progress exception:', error)
      alert('Failed to update book progress')
    }
  }

  const handleLogout = async () => {
    console.log('[AUTH] Logging out')
    localStorage.removeItem('bookmosh-user')
    setCurrentUser(null)
  }

  // Resume background matching on mount if there's a queue
  useEffect(() => {
    if (!currentUser) return
    
    const queueKey = `bookmosh-match-queue-${currentUser.username}`
    const queueData = localStorage.getItem(queueKey)
    
    if (queueData) {
      try {
        const queue = JSON.parse(queueData)
        if (queue.length > 0) {
          console.log('[IMPORT] Resuming background matching for', queue.length, 'books')
          startBackgroundMatching(queue, setTracker, currentUser.username, setMatchingProgress)
        }
      } catch (error) {
        console.error('[IMPORT] Failed to resume background matching:', error)
        localStorage.removeItem(queueKey)
      }
    }
  }, [currentUser])

  const importHandler = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      const text = loadEvent.target?.result
      if (typeof text !== 'string') {
        setImportMessage('Unable to read this file.')
        return
      }
      console.log('[IMPORT] File type:', importFileType)
      console.log('[IMPORT] File size:', text.length, 'characters')
      console.log('[IMPORT] First 200 chars:', text.substring(0, 200))
      
      let imported = []
      if (importFileType === 'goodreads') {
        imported = parseGoodreadsCSV(text)
      } else if (importFileType === 'storygraph') {
        // Try JSON first, then CSV for StoryGraph
        try {
          imported = parseStoryGraphJSON(text)
          console.log('[IMPORT] JSON parse succeeded, entries:', imported.length)
        } catch (error) {
          console.log('[IMPORT] JSON parse failed, trying CSV:', error.message)
          // If JSON fails, try CSV
          try {
            imported = parseStoryGraphCSV(text)
            console.log('[IMPORT] CSV parse succeeded, entries:', imported.length)
          } catch (csvError) {
            console.error('[IMPORT] CSV parse failed:', csvError)
            setImportMessage('Unable to parse StoryGraph file. Please ensure it\'s a valid JSON or CSV export.')
            return
          }
        }
      }
      
      console.log('[IMPORT] Imported entries:', imported.length)
      if (imported.length > 0) {
        console.log('[IMPORT] First entry:', imported[0])
      }
      
      if (!imported.length) {
        setImportMessage('No readable entries were found in that file.')
        return
      }
      mergeImportedBooks(imported, setImportMessage, setTracker)
      
      // Start background matching for imported books
      if (currentUser) {
        startBackgroundMatching(imported, setTracker, currentUser.username, setMatchingProgress)
      }
    }
    reader.onerror = () => {
      setImportMessage('File reading failed.')
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const handleSendFriendInvite = async () => {
    if (!currentUser) {
      setFriendMessage('Log in to search for friends.')
      return
    }
    const query = friendQuery.trim()
    if (!query) {
      setFriendMessage('Enter a username or email to search.')
      return
    }
    
    try {
      // Prevent auth state changes during friend update
      isUpdatingUserRef.current = true

      const existingFriends = Array.isArray(currentUser.friends) ? currentUser.friends : []
      
      // Search for users
      let searchResults = []
      try {
        searchResults = await searchUsers(query)
      } catch (e) {
        const message = String(e?.message || '')
        const details = String(e?.details || e?.hint || '')
        const combined = [message, details].filter(Boolean).join(' - ')
        if (combined.toLowerCase().includes('row-level security') || combined.toLowerCase().includes('permission') || combined.toLowerCase().includes('not allowed')) {
          setFriendMessage('Unable to search users (database permission denied).')
        } else if (combined) {
          setFriendMessage(`Unable to search users: ${combined}`)
        } else {
          setFriendMessage('Unable to search users right now.')
        }
        return
      }
      
      if (searchResults.length === 0) {
        setFriendMessage(`No user found for "${query}".`)
        return
      }
      
      // Filter out current user and existing friends
      const queryLower = query.toLowerCase()
      const availableMatches = searchResults
        .filter(user => user.id !== currentUser.id)
        .filter(user => !existingFriends.includes(user.username))
      
      if (availableMatches.length === 0) {
        if (searchResults.some(user => user.id === currentUser.id)) {
          setFriendMessage('You cannot add yourself as a friend.')
        } else {
          setFriendMessage('Already connected with all matching users.')
        }
        return
      }
      
      // Add first available friend
      const exactUsername = availableMatches.find(u => (u.username ?? '').toLowerCase() === queryLower)
      const exactEmail = availableMatches.find(u => (u.email ?? '').toLowerCase() === queryLower)
      const friendToAdd = exactUsername || exactEmail || availableMatches[0]

      const { data: existingRequests, error: existingRequestError } = await supabase
        .from('friend_requests')
        .select('id, status, requester_id, recipient_id')
        .or(
          `and(requester_id.eq.${currentUser.id},recipient_id.eq.${friendToAdd.id}),and(requester_id.eq.${friendToAdd.id},recipient_id.eq.${currentUser.id})`,
        )
        .order('created_at', { ascending: false })
        .limit(1)

      if (existingRequestError) throw existingRequestError

      const existingRequest = Array.isArray(existingRequests) ? existingRequests[0] : null
      if (existingRequest?.status === 'pending') {
        if (existingRequest.requester_id === currentUser.id) {
          setFriendMessage(`Invite already sent to ${friendToAdd.username}.`)
        } else {
          setFriendMessage(`${friendToAdd.username} already invited you — check Incoming invites below.`)
        }
        return
      }

      const { error: inviteError } = await supabase
        .from('friend_requests')
        .insert([
          {
            requester_id: currentUser.id,
            requester_username: currentUser.username,
            recipient_id: friendToAdd.id,
            recipient_username: friendToAdd.username,
            status: 'pending',
          },
        ])

      if (inviteError) throw inviteError

      setFriendMessage(`Invite sent to ${friendToAdd.username}.`)
      setFriendQuery('')
      await loadFriendRequests()
    } catch (error) {
      console.error('Friend add error:', error)
      const message = String(error?.message || '')
      const details = String(error?.details || error?.hint || '')
      const combined = [message, details].filter(Boolean).join(' - ')
      if (combined.toLowerCase().includes('row-level security') || combined.toLowerCase().includes('permission') || combined.toLowerCase().includes('not allowed')) {
        setFriendMessage('Unable to add friend (database permission denied).')
      } else if (combined) {
        setFriendMessage(`Failed to add friend: ${combined}`)
      } else {
        setFriendMessage('Failed to add friend. Please try again.')
      }
    } finally {
      isUpdatingUserRef.current = false
    }
  }

  const handleSendEmailInvite = async () => {
    if (!currentUser) {
      setEmailInviteMessage('Log in to invite a friend.')
      return
    }

    const email = emailInvite.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      setEmailInviteMessage('Enter a valid email.')
      return
    }

    try {
      setEmailInviteSending(true)
      setEmailInviteMessage('')
      await sendFriendInviteNotification(email, {
        inviterName: currentUser.username,
        inviterEmail: currentUser.email,
      })

      setEmailInviteMessage(`Invite sent to ${email}.`)
      setEmailInvite('')
    } catch (error) {
      console.error('Email invite failed', error)
      const msg = String(error?.message || '')
      setEmailInviteMessage(msg || 'Failed to send invite.')
    } finally {
      setEmailInviteSending(false)
    }
  }

  const acceptFriendInvite = async (request) => {
    if (!supabase || !request?.id) return
    try {
      const { error } = await supabase.rpc('accept_friend_request', {
        request_id: request.id,
      })

      if (error) throw error

      await refreshCurrentUser()
      await loadFriendRequests()
      setFriendMessage(`Connected with ${request.requester_username}.`)
    } catch (error) {
      console.error('Accept friend invite failed', error)
      setFriendMessage('Failed to accept invite.')
    }
  }

  const handleUnfriend = async (friendUsername) => {
    if (!supabase || !currentUser) return
    if (!friendUsername) return

    const confirmed = window.confirm(`Unfriend ${friendUsername}?`)
    if (!confirmed) return

    setFriendMessage('')
    try {
      const friendId = await resolveUserId(friendUsername)
      if (!friendId) {
        setFriendMessage('Could not find that user.')
        return
      }

      // Preferred: Security-definer RPC that updates both users.
      // If it doesn't exist yet, fall back to updating current user only.
      const { error: rpcError } = await supabase.rpc('unfriend_users', {
        user_a: currentUser.id,
        user_b: friendId,
      })

      if (rpcError) {
        console.warn('[UNFRIEND] RPC unavailable or failed, falling back to local update:', rpcError)
        const nextFriends = (Array.isArray(currentUser.friends) ? currentUser.friends : []).filter(
          (u) => (u ?? '').toLowerCase() !== friendUsername.toLowerCase(),
        )
        const updatedUser = await updateUserFriends(currentUser.id, nextFriends)
        setCurrentUser(updatedUser)
        localStorage.setItem('bookmosh-user', JSON.stringify(updatedUser))
        setFriendMessage('Unfriended. (Other user may still see you until server sync is added.)')
      } else {
        await refreshCurrentUser()
        setFriendMessage('Unfriended.')
      }

      await loadFriendRequests()
    } catch (error) {
      console.error('Unfriend failed', error)
      setFriendMessage(error?.message || 'Failed to unfriend.')
    }
  }

  const declineFriendInvite = async (request) => {
    if (!supabase || !request?.id) return
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', request.id)
      if (error) throw error
      await loadFriendRequests()
      setFriendMessage('Invite declined.')
    } catch (error) {
      console.error('Decline friend invite failed', error)
      setFriendMessage('Failed to decline invite.')
    }
  }

  const cancelFriendInvite = async (request) => {
    if (!supabase || !request?.id) return
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'cancelled', responded_at: new Date().toISOString() })
        .eq('id', request.id)
      if (error) throw error
      await loadFriendRequests()
      setFriendMessage('Invite cancelled.')
    } catch (error) {
      console.error('Cancel friend invite failed', error)
      setFriendMessage('Failed to cancel invite.')
    }
  }

  const openModal = (book, options = {}) => {
    const normalized = normalizeBookTags(book)
    setSelectedBook(normalized)
    setModalRating(book.rating ?? 0)
    setModalProgress(book.progress ?? 0)
    setModalStatus(normalized.status ?? statusOptions[0])
    setModalReview(book.review ?? '')
    setModalSpoilerWarning(book.spoiler_warning ?? false)
    setModalDescription('')
    setModalDescriptionLoading(false)
    
    // Fetch book activity feed
    fetchBookActivity(normalized.title)
    
    // Load friends' ratings and community average
    loadFriendsRatingsForBook(normalized.title)
    loadCommunityAvgRatingForBook(normalized.title)

    if (options.skipNavigate) return

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams()
      const source = normalized?.source ?? null
      const olKey = source === 'isbndb' ? null : (normalized?.olKey ?? normalized?.key ?? null)
      const isbn = normalized?.isbn ?? null
      if (olKey) params.set('olKey', olKey)
      if (isbn) params.set('isbn', isbn)
      if (source) params.set('source', source)
      params.set('bookTitle', normalized?.title ?? '')
      params.set('bookAuthor', normalized?.author ?? '')
      navigate({ pathname: '/book', search: `?${params.toString()}` }, { replace: false })
    }
  }

  useEffect(() => {
    if (!selectedBook) return
    let canceled = false
    setModalDescriptionLoading(true)
    setModalDescription('')

    ;(async () => {
      try {
        // ISBNdb books already carry synopsis; don't overwrite it with empty Open Library results.
        const existingSynopsis = (selectedBook.synopsis ?? '').toString().trim()
        if ((selectedBook.source ?? null) === 'isbndb' && existingSynopsis) {
          if (!canceled) setModalDescription(existingSynopsis)
          return
        }

        const workKey = await resolveOpenLibraryWorkKey(selectedBook)
        if (!workKey) {
          // fallback: ISBNdb by ISBN if present
          const isbn = (selectedBook.isbn ?? '').toString().trim()
          if (isbn) {
            const isbndb = await invokeIsbndbSearch({ isbn })
            const b = isbndb?.book ?? null
            const syn = (b?.synopsis ?? b?.overview ?? '').toString().trim()
            if (!canceled) setModalDescription(syn)
          }
          return
        }

        const res = await fetch(`https://openlibrary.org${workKey}.json`)
        if (!res.ok) {
          const isbn = (selectedBook.isbn ?? '').toString().trim()
          if (isbn) {
            const isbndb = await invokeIsbndbSearch({ isbn })
            const b = isbndb?.book ?? null
            const syn = (b?.synopsis ?? b?.overview ?? '').toString().trim()
            if (!canceled) setModalDescription(syn)
          }
          return
        }

        const data = await res.json()
        const raw = data?.description
        const desc = typeof raw === 'string' ? raw : (raw?.value ?? '')
        const cleaned = (desc ?? '').toString().trim()
        if (cleaned) {
          if (!canceled) setModalDescription(cleaned)
          return
        }

        // Open Library had no description; try ISBNdb by ISBN.
        const isbn = (selectedBook.isbn ?? '').toString().trim()
        if (isbn) {
          const isbndb = await invokeIsbndbSearch({ isbn })
          const b = isbndb?.book ?? null
          const syn = (b?.synopsis ?? b?.overview ?? '').toString().trim()
          if (!canceled) setModalDescription(syn)
        } else {
          if (!canceled) setModalDescription('')
        }
      } catch (error) {
        console.error('Failed to load book description', error)
        if (!canceled) setModalDescription('')
      } finally {
        if (!canceled) setModalDescriptionLoading(false)
      }
    })()

    return () => {
      canceled = true
    }
  }, [selectedBook])

  useEffect(() => {
    if (!selectedBook) return
    const isbn = (selectedBook.isbn ?? '').toString().trim()
    if (selectedBook.cover) return
    const olKey = (selectedBook.olKey ?? selectedBook.key ?? '').toString().trim()
    const cacheKey = `${isbn || ''}|${olKey || ''}`
    if (isbndbCoverLookupRef.current.has(cacheKey)) return
    isbndbCoverLookupRef.current.add(cacheKey)

    let canceled = false
    ;(async () => {
      try {
        let cover = null

        if (isbn) {
          const data = await invokeIsbndbSearch({ isbn })
          const b = data?.book ?? null
          cover =
            b?.image ||
            b?.image_url ||
            b?.image_original ||
            b?.image_large ||
            b?.image_small ||
            null
          if (typeof cover === 'string' && cover.startsWith('http://')) {
            cover = `https://${cover.slice('http://'.length)}`
          }
        }

        if (!cover && isbn) {
          const olIsbnUrl = openLibraryIsbnCoverUrl(isbn, 'L')
          try {
            const res = await fetch(olIsbnUrl, { method: 'HEAD' })
            if (res.ok) cover = olIsbnUrl
          } catch (_) {
            // ignore
          }
        }

        if (!cover && olKey && olKey.startsWith('/works/')) {
          try {
            const workRes = await fetch(`https://openlibrary.org${olKey}.json`)
            if (workRes.ok) {
              const work = await workRes.json()
              const covers = Array.isArray(work?.covers) ? work.covers : []
              if (covers.length > 0) {
                const url = openLibraryCoverIdUrl(covers[0], 'L')
                if (url) cover = url
              }
            }
          } catch (_) {
            // ignore
          }
        }

        if (!canceled && cover) {
          updateBook(selectedBook.title, { cover })
          setSelectedBook((prev) => (prev ? { ...prev, cover } : prev))
        } else {
          isbndbCoverLookupRef.current.delete(cacheKey)
        }
      } catch (error) {
        console.error('Failed to load ISBNdb cover', error)
        isbndbCoverLookupRef.current.delete(cacheKey)
      }
    })()

    return () => {
      canceled = true
    }
  }, [selectedBook?.isbn, selectedBook?.cover])

  useEffect(() => {
    if (!supabase || !selectedBook) return
    let canceled = false
    setPublicMoshesForBookLoading(true)
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('moshes')
          .select('id, book_title, book_author, book_cover, mosh_title, created_at, participants_ids, participants_usernames, archived, is_public')
          .eq('book_title', selectedBook.title)
          .eq('archived', false)
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error
        const rows = Array.isArray(data) ? data : []
        const sorted = rows
          .slice()
          .sort((a, b) => (b.participants_usernames?.length ?? 0) - (a.participants_usernames?.length ?? 0))

        if (!canceled) {
          setPublicMoshesForBook(sorted)
        }
      } catch (err) {
        console.error('Failed to load public moshes for book', err)
        if (!canceled) setPublicMoshesForBook([])
      } finally {
        if (!canceled) setPublicMoshesForBookLoading(false)
      }
    })()

    return () => {
      canceled = true
    }
  }, [selectedBook, supabase])

  const toggleActiveMoshVisibility = async () => {
    if (!supabase || !activeMosh) return
    try {
      const next = !(activeMosh.is_public ?? true)
      const { data, error } = await supabase
        .from('moshes')
        .update({ is_public: next })
        .eq('id', activeMosh.id)
        .select('*')
      if (error) throw error
      const updated = Array.isArray(data) ? data[0] : null
      if (updated) setActiveMosh(updated)
      await fetchActiveMoshes()
    } catch (error) {
      console.error('Failed to toggle mosh visibility', error)
    }
  }

  const closeMoshCoverPicker = () => {
    setIsMoshCoverPickerOpen(false)
    setMoshCoverPickerLoading(false)
    setMoshCoverPickerCovers([])
  }

  const loadEditionCoversForActiveMosh = async () => {
    if (!activeMosh) return
    setMoshCoverPickerLoading(true)
    setMoshCoverPickerCovers([])
    try {
      const workKey = await resolveOpenLibraryWorkKey({
        title: activeMosh.book_title,
        author: activeMosh.book_author,
      })
      if (!workKey) {
        setMoshCoverPickerCovers([])
        return
      }

      const editionsUrl = `https://openlibrary.org${workKey}/editions.json?limit=100`
      const response = await fetch(editionsUrl)
      if (!response.ok) {
        setMoshCoverPickerCovers([])
        return
      }

      const data = await response.json()
      const entries = Array.isArray(data?.entries) ? data.entries : []
      const seen = new Set()
      const covers = []

      for (const edition of entries) {
        const coverIds = Array.isArray(edition?.covers) ? edition.covers : []
        const editionKey = typeof edition?.key === 'string' ? edition.key : null
        for (const coverId of coverIds) {
          const key = String(coverId)
          if (seen.has(key)) continue
          seen.add(key)
          covers.push({
            coverId,
            editionKey,
            urlM: `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`,
            urlS: `https://covers.openlibrary.org/b/id/${coverId}-S.jpg`,
          })
        }
      }

      setMoshCoverPickerCovers(covers)
    } catch (error) {
      console.error('Failed to load mosh edition covers', error)
      setMoshCoverPickerCovers([])
    } finally {
      setMoshCoverPickerLoading(false)
    }
  }

  const openMoshCoverPicker = async () => {
    if (!activeMosh) return
    setIsMoshCoverPickerOpen(true)
    await loadEditionCoversForActiveMosh()
  }

  const updateActiveMoshCover = async (coverUrl) => {
    if (!supabase || !activeMosh) return
    try {
      const { data, error } = await supabase
        .from('moshes')
        .update({ book_cover: coverUrl })
        .eq('id', activeMosh.id)
        .select('*')
      if (error) throw error
      const updated = Array.isArray(data) ? data[0] : null
      if (updated) setActiveMosh(updated)
      await fetchActiveMoshes()
      closeMoshCoverPicker()
    } catch (error) {
      console.error('Failed to update mosh cover', error)
    }
  }

  const setModalRatingValue = (value) => {
    pendingModalRatingRef.current = value
    setModalRating(value)
  }

  const setModalRatingValueThrottled = (value) => {
    pendingModalRatingRef.current = value
    if (modalRatingRafRef.current) return
    modalRatingRafRef.current = requestAnimationFrame(() => {
      modalRatingRafRef.current = null
      setModalRating(pendingModalRatingRef.current)
    })
  }

  const commitModalRating = () => {
    if (selectedBook) updateBook(selectedBook.title, { rating: pendingModalRatingRef.current })
  }

  // Load friends' ratings for selected book
  const loadFriendsRatingsForBook = async (bookTitle) => {
    if (!currentUser?.id || !bookTitle) return
    try {
      // Query both directions separately to avoid .or() filter issues
      const { data: friendships1 } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .eq('user_id', currentUser.id)
        .eq('status', 'accepted')

      const { data: friendships2 } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .eq('friend_id', currentUser.id)
        .eq('status', 'accepted')

      const friendships = [...(friendships1 || []), ...(friendships2 || [])]

      const friendIds = (friendships || []).map((f) =>
        f.user_id === currentUser.id ? f.friend_id : f.user_id
      )
      if (friendIds.length === 0) { setFriendsRatings([]); return }

      const { data: friendUsers } = await supabase
        .from('users')
        .select('id, username')
        .in('id', friendIds)

      const friendUsernames = (friendUsers || []).map((u) => u.username)
      if (friendUsernames.length === 0) { setFriendsRatings([]); return }

      const { data: ratings } = await supabase
        .from('bookmosh_books')
        .select('owner, rating')
        .in('owner', friendUsernames)
        .eq('title', bookTitle)
        .gt('rating', 0)

      setFriendsRatings(ratings || [])
    } catch (error) {
      console.error('Load friends ratings error:', error)
      setFriendsRatings([])
    }
  }

  // Load community average rating for selected book
  const loadCommunityAvgRatingForBook = async (bookTitle) => {
    if (!bookTitle) return
    try {
      const { data } = await supabase
        .from('bookmosh_books')
        .select('rating')
        .eq('title', bookTitle)
        .gt('rating', 0)

      if (data && data.length > 0) {
        const sum = data.reduce((acc, row) => acc + (row.rating || 0), 0)
        const avg = sum / data.length
        setCommunityAvgRating({ avg: Math.round(avg * 10) / 10, count: data.length })
      } else {
        setCommunityAvgRating(null)
      }
    } catch (error) {
      console.error('Load community avg rating error:', error)
      setCommunityAvgRating(null)
    }
  }

  // Load user's pits for "Add to Pit" feature in modal
  const loadUserPitsForModal = async () => {
    if (!currentUser?.id) return
    setLoadingPitsForModal(true)
    try {
      const { data, error } = await supabase
        .from('moshes')
        .select('*')
        .contains('participants_ids', [currentUser.id])
        .eq('archived', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      setUserPitsForModal(data || [])
    } catch (error) {
      console.error('Load pits error:', error)
      setUserPitsForModal([])
    } finally {
      setLoadingPitsForModal(false)
    }
  }

  const addBookToPitFromModal = async (pit) => {
    if (!pit?.id || !currentUser || !selectedBook) return
    try {
      const bookMessage = `📚 Shared a book: "${selectedBook.title}" by ${selectedBook.author}`
      const { error } = await supabase.from('mosh_messages').insert([{
        mosh_id: pit.id,
        sender_id: currentUser.id,
        sender_username: currentUser.username,
        body: bookMessage,
        book_share: {
          title: selectedBook.title,
          author: selectedBook.author,
          cover: selectedBook.cover,
          book_id: selectedBook.id,
        },
      }])
      if (error) throw error
      setShowAddToPitDropdown(false)
    } catch (error) {
      console.error('Add book to pit error:', error)
    }
  }

  const handleDeleteBook = async (title) => {
    if (!currentUser) return
    
    // Delete from local state
    setTracker(prev => prev.filter(book => book.title !== title))
    
    // Delete from Supabase
    if (supabase) {
      try {
        console.log('[LIBRARY] Deleting book from Supabase:', title)
        const { error } = await supabase
          .from(SUPABASE_TABLE)
          .delete()
          .eq('owner', currentUser.username)
          .eq('title', title)
        
        if (error) {
          console.error('[LIBRARY] Delete error:', error)
        } else {
          console.log('[LIBRARY] Book deleted successfully from Supabase')
        }
      } catch (error) {
        console.error('[LIBRARY] Delete exception:', error)
      }
    }
  }

  const handleModalSave = () => {
    if (!selectedBook) return
    updateBook(selectedBook.title, {
      progress: modalProgress,
      status: modalStatus,
      review: modalReview,
      spoiler_warning: modalSpoilerWarning,
      rating: modalRating,
    })
    logBookEvent(selectedBook, 'updated')
    closeModal()
  }

  const closeModal = () => {
    setSelectedBook(null)
    setShowFindMatch(false)
    setFindMatchQuery('')
    setFindMatchResults([])
    setFindMatchLoading(false)
    setShowCoverPicker(false)
    setCoverPickerCovers([])
    setShowEditionPicker(false)
    setEditionPickerEditions([])

    if (isBookPage) {
      navigate(-1)
    }
  }

  // Load book details when routed to /book?bookTitle=...
  useEffect(() => {
    if (!isBookPage) return
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(location.search)
    const bookTitle = (params.get('bookTitle') ?? '').trim()
    const bookAuthor = (params.get('bookAuthor') ?? '').trim()
    const olKey = (params.get('olKey') ?? '').trim()
    const isbn = (params.get('isbn') ?? '').trim()
    const source = (params.get('source') ?? '').trim()
    if (!bookTitle) return
    if (selectedBook) return

    if (source === 'isbndb' && isbn) {
      ;(async () => {
        const data = await invokeIsbndbSearch({ isbn })
        const book = data?.book ?? null
        if (!book) {
          openModal({ title: bookTitle, author: bookAuthor || 'Unknown author', isbn, source: 'isbndb' }, { skipNavigate: true })
          return
        }
        const mapped = mapIsbndbBookToResult(book, bookTitle.toLowerCase(), '', '', '', [])
        openModal(mapped || { title: bookTitle, author: bookAuthor || 'Unknown author', isbn, source: 'isbndb' }, { skipNavigate: true })
      })()
      return
    }

    openModal({ title: bookTitle, author: bookAuthor || 'Unknown author', olKey: olKey || null, isbn: isbn || null }, { skipNavigate: true })
  }, [isBookPage, location.search, selectedBook])

  useEffect(() => {
    if (!selectedBook) return
    if ((selectedBook.source ?? null) !== 'isbndb') return
    const synopsis = (selectedBook.synopsis ?? '').toString().trim()
    if (synopsis) {
      setModalDescription(synopsis)
    }
  }, [selectedBook?.source, selectedBook?.synopsis])

  const loadEditionCoversForSelectedBook = async () => {
    if (!selectedBook) return
    setCoverPickerLoading(true)
    setCoverPickerCovers([])

    try {
      const workKey = await resolveOpenLibraryWorkKey(selectedBook)
      if (!workKey) {
        setCoverPickerCovers([])
        return
      }

      updateBook(selectedBook.title, { olKey: workKey })
      setSelectedBook((prev) => (prev ? { ...prev, olKey: workKey } : prev))

      const editionsUrl = `https://openlibrary.org${workKey}/editions.json?limit=100`
      const response = await fetch(editionsUrl)
      if (!response.ok) {
        setCoverPickerCovers([])
        return
      }

      const data = await response.json()
      const entries = Array.isArray(data?.entries) ? data.entries : []

      const seen = new Set()
      const covers = []

      const pushCover = ({ key, coverId = null, editionKey = null, isbn = null, urlM, urlS }) => {
        if (!urlM) return
        const uniq = String(key || urlM)
        if (seen.has(uniq)) return
        seen.add(uniq)
        covers.push({
          key: uniq,
          coverId,
          editionKey,
          isbn,
          urlM,
          urlS: urlS || urlM,
        })
      }

      for (const edition of entries) {
        const coverIds = Array.isArray(edition?.covers) ? edition.covers : []
        const editionKey = typeof edition?.key === 'string' ? edition.key : null
        const isbn = edition?.isbn_13?.[0] || edition?.isbn_10?.[0] || null

        // Prefer explicit cover IDs when present.
        for (const coverId of coverIds) {
          pushCover({
            key: `olid:${coverId}`,
            coverId,
            editionKey,
            isbn,
            urlM: `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`,
            urlS: `https://covers.openlibrary.org/b/id/${coverId}-S.jpg`,
          })
        }

        // If edition has an ISBN but no cover IDs, use the OL ISBN cover endpoint.
        if (isbn) {
          pushCover({
            key: `olisbn:${isbn}`,
            editionKey,
            isbn,
            urlM: openLibraryIsbnCoverUrl(isbn, 'M'),
            urlS: openLibraryIsbnCoverUrl(isbn, 'S'),
          })
        }
      }

      // If still sparse, enrich with ISBNdb editions (often has images even when OL doesn't).
      if (covers.length < 24) {
        const title = (selectedBook.title ?? '').toString().trim()
        const author = (selectedBook.author ?? '').toString().trim()
        const q = `${title} ${author}`.trim()
        if (q) {
          const isbndbData = await invokeIsbndbSearch({ q, pageSize: 50 })
          const isbndbBooks = Array.isArray(isbndbData?.books)
            ? isbndbData.books
            : (Array.isArray(isbndbData?.data) ? isbndbData.data : [])

          for (const b of isbndbBooks) {
            const isbn13 = b?.isbn13 ?? null
            const isbn10 = b?.isbn10 ?? null
            const isbn = (isbn13 || isbn10 || b?.isbn || null)?.toString?.() ?? null
            let url = b?.image || b?.image_url || b?.image_original || b?.image_large || b?.image_small || null
            if (typeof url === 'string' && url.startsWith('http://')) {
              url = `https://${url.slice('http://'.length)}`
            }
            if (!url) continue
            pushCover({ key: `isbndb:${isbn || url}`, isbn, urlM: url, urlS: url })
          }
        }
      }

      setCoverPickerCovers(covers)
    } catch (error) {
      console.error('Failed to load edition covers', error)
      setCoverPickerCovers([])
    } finally {
      setCoverPickerLoading(false)
    }
  }

  const loadEditionsForSelectedBook = async () => {
    if (!selectedBook) return
    console.log('[EDITIONS] Loading editions for:', selectedBook.title, 'by', selectedBook.author)
    setEditionPickerLoading(true)
    setEditionPickerEditions([])

    try {
      const byIsbn = new Map()
      const pushEdition = (e) => {
        const isbn = (e?.isbn ?? '').toString().trim()
        // Use ISBN as primary key, but fall back to editionKey or generated key
        const key = isbn || e?.editionKey || `${e?.source}-${e?.publisher}-${e?.publishDate}`
        if (!key || key === '--') {
          console.log('[EDITIONS] Skipping edition with no identifier:', e)
          return
        }
        if (!byIsbn.has(key)) {
          byIsbn.set(key, { ...e, isbn: isbn || 'No ISBN' })
        }
      }

      const workKey = await resolveOpenLibraryWorkKey(selectedBook)
      console.log('[EDITIONS] Work key:', workKey)
      if (workKey) {
        updateBook(selectedBook.title, { olKey: workKey })
        setSelectedBook((prev) => (prev ? { ...prev, olKey: workKey } : prev))

        const editionsUrl = `https://openlibrary.org${workKey}/editions.json?limit=200`
        console.log('[EDITIONS] Fetching from:', editionsUrl)
        const response = await fetch(editionsUrl)
        if (response.ok) {
          const data = await response.json()
          const entries = Array.isArray(data?.entries) ? data.entries : []
          console.log('[EDITIONS] Open Library entries:', entries.length)
          for (const edition of entries) {
            const isbn = edition?.isbn_13?.[0] || edition?.isbn_10?.[0] || null
            const coverId = Array.isArray(edition?.covers) ? edition.covers[0] : null
            const coverUrl = coverId ? openLibraryCoverIdUrl(coverId, 'L') : openLibraryIsbnCoverUrl(isbn, 'L')
            const languages = Array.isArray(edition?.languages) ? edition.languages.map(l => l.key || l).join(', ') : null
            const isEnglish = languages?.includes('eng') || languages?.includes('/languages/eng') || !languages
            const editionTitle = edition?.title || selectedBook.title
            console.log('[EDITIONS] OL edition:', { title: editionTitle, isbn, lang: languages, isEnglish })
            pushEdition({
              source: 'openlibrary',
              isbn,
              title: editionTitle,
              author: Array.isArray(edition?.authors) ? edition.authors.map(a => a.name || a.key?.replace('/authors/', '') || '').filter(Boolean).join(', ') : (selectedBook.author || null),
              editionKey: typeof edition?.key === 'string' ? edition.key : null,
              publisher: Array.isArray(edition?.publishers) ? edition.publishers[0] : null,
              publishDate: edition?.publish_date ?? null,
              coverUrl,
              language: languages || 'Unknown',
              isEnglish,
            })
          }
        }
      }

      const title = (selectedBook.title ?? '').toString().trim()
      const author = (selectedBook.author ?? '').toString().trim()
      const q = `${title} ${author}`.trim()
      console.log('[EDITIONS] ISBNdb query:', q)
      if (q) {
        const isbndbData = await invokeIsbndbSearch({ q, pageSize: 50 })
        const isbndbBooks = Array.isArray(isbndbData?.books)
          ? isbndbData.books
          : (Array.isArray(isbndbData?.data) ? isbndbData.data : [])
        console.log('[EDITIONS] ISBNdb results:', isbndbBooks.length)
        for (const b of isbndbBooks) {
          const isbn13 = b?.isbn13 ?? null
          const isbn10 = b?.isbn10 ?? null
          const isbn = (isbn13 || isbn10 || b?.isbn || null)?.toString?.() ?? null
          let url = b?.image || b?.image_url || b?.image_original || b?.image_large || b?.image_small || null
          if (typeof url === 'string' && url.startsWith('http://')) {
            url = `https://${url.slice('http://'.length)}`
          }
          const lang = b?.language || 'en'
          const bookTitle = (b?.title || b?.title_long || '').toLowerCase()
          // Detect English: check language field OR if title contains English words (not Italian/other)
          const isEnglish = lang === 'en' || lang === 'eng' || lang.toLowerCase().includes('english') || 
                           (!lang || lang === 'en') // Default to English if no language specified
          
          const edition = {
            source: 'isbndb',
            isbn,
            title: b?.title || b?.title_long || selectedBook.title,
            author: (Array.isArray(b?.authors) ? b.authors.join(', ') : b?.authors) || selectedBook.author || null,
            publisher: (Array.isArray(b?.publisher) ? b.publisher[0] : b?.publisher) ?? null,
            publishDate: b?.date_published ?? null,
            coverUrl: url || null,
            language: lang,
            isEnglish,
          }
          console.log('[EDITIONS] ISBNdb edition:', { title: edition.title, isbn: edition.isbn, lang, isEnglish })
          pushEdition(edition)
        }
      }

      const editions = Array.from(byIsbn.values()).sort((a, b) => {
        // Prioritize English editions
        if (a.isEnglish !== b.isEnglish) return a.isEnglish ? -1 : 1
        // Then prioritize editions with covers
        const aHasCover = Boolean(a.coverUrl)
        const bHasCover = Boolean(b.coverUrl)
        if (aHasCover !== bHasCover) return aHasCover ? -1 : 1
        // Then prefer ISBNdb (usually better metadata)
        const as = String(a.source ?? '')
        const bs = String(b.source ?? '')
        if (as !== bs) return as === 'isbndb' ? -1 : 1
        // Finally sort by ISBN
        return String(a.isbn).localeCompare(String(b.isbn))
      })

      console.log('[EDITIONS] Total unique editions found:', editions.length)
      setEditionPickerEditions(editions)
    } catch (error) {
      console.error('Failed to load editions', error)
      setEditionPickerEditions([])
    } finally {
      setEditionPickerLoading(false)
    }
  }

  const mapFeedItemToBook = (item) => {
    const tags = Array.isArray(item?.tags) ? item.tags : []
    const status = deriveStatusFromTags(tags, tags[0] ?? 'to-read')
    return normalizeBookTags({
      title: item.book_title,
      author: item.book_author ?? 'Unknown author',
      cover: item.book_cover ?? null,
      tags,
      status,
      rating: 0,
      progress: status === 'Read' ? 100 : 0,
    })
  }

  const applyFeedQuickStatus = (book, nextStatus) => {
    if (!book?.title) return
    const incomingTitle = String(book.title ?? '').trim().toLowerCase()
    const incomingAuthor = String(book.author ?? '').trim().toLowerCase()

    const existing = (Array.isArray(tracker) ? tracker : []).find((b) => {
      const t1 = String(b?.title ?? '').trim().toLowerCase()
      const a1 = String(b?.author ?? '').trim().toLowerCase()
      return Boolean(incomingTitle && t1 && incomingTitle === t1 && incomingAuthor && a1 && incomingAuthor === a1)
    })

    if (!existing) {
      handleAddBook(book, nextStatus)
      return
    }

    setBookStatusTag(existing.title, nextStatus)
  }

  if (isBookPage) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-midnight via-[#050916] to-black text-white overflow-x-hidden">
        {selectedBook ? (
          <div className="min-h-screen bg-[#0b1225]/95 overflow-auto pt-[env(safe-area-inset-top)]">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1225]/95 backdrop-blur">
              <div className="mx-auto w-full max-w-3xl px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.4em] text-white/40">Book Details</p>
                    <h2 className="text-xl font-semibold text-white break-words">{selectedBook.title}</h2>
                    <p className="text-sm text-white/60 break-words">{selectedBook.author}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this book?')) {
                          handleDeleteBook(selectedBook.title)
                          closeModal()
                        }
                      }}
                      className="rounded-full border border-rose-500/30 p-2 text-rose-400 transition hover:border-rose-500/60 hover:bg-rose-500/10"
                      title="Delete book"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window === 'undefined') return
                        const url = window.location.href
                        if (navigator?.clipboard?.writeText) {
                          navigator.clipboard.writeText(url)
                        }
                      }}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                    >
                      Copy link
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                    >
                      Back
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-3xl px-4 py-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Activity</label>
                  {bookActivityLoading ? (
                    <p className="text-sm text-white/60">Loading activity…</p>
                  ) : bookActivityFeed.length > 0 ? (
                    <div className="space-y-2">
                      {bookActivityFeed.map((item) => (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openReviewThreadForEvent(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openReviewThreadForEvent(item)
                            }
                          }}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/30 cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-white/80">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  viewFriendProfile(item.owner_username)
                                }}
                                className="font-semibold text-white hover:text-aurora hover:underline transition"
                              >
                                {item.owner_username}
                              </button>
                              <span className="text-white/60">
                                {item.event_type === 'created' ? ' added this book' :
                                 item.event_type === 'tags_updated' ? ' updated tags' :
                                 item.event_type === 'status_changed' ? ' changed status' :
                                 ' updated this book'}
                              </span>
                              {item.tags && item.tags.length > 0 && (
                                <span className="text-white/60"> to </span>
                              )}
                              {item.tags && item.tags.map((tag, idx) => (
                                <span key={idx}>
                                  <span className="font-semibold text-white">{tag}</span>
                                  {idx < item.tags.length - 1 && <span className="text-white/60">, </span>}
                                </span>
                              ))}
                            </p>
                            <span className="text-[10px] text-white/40 whitespace-nowrap">{formatTimeAgo(item.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/60">No activity yet for this book.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Moshes</label>
                  {publicMoshesForBookLoading ? (
                    <p className="text-sm text-white/60">Loading public moshes…</p>
                  ) : (
                    <>
                      <p className="text-sm text-white/60">{publicMoshesForBook.length} public moshes</p>
                      {publicMoshesForBook.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Popular public</p>
                          {publicMoshesForBook.slice(0, 3).map((mosh) => (
                            <div key={mosh.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white line-clamp-1">{mosh.mosh_title || mosh.book_title}</p>
                                <p className="text-xs text-white/50">by {mosh.created_by_username || 'reader'}</p>
                              </div>
                              <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                                {(mosh.participants_usernames?.length ?? 0)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Progress: {modalProgress}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={modalProgress}
                    onChange={(e) => setModalProgress(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Rating</label>
                  <div className="flex gap-1 items-center select-none">
                    <button
                      type="button"
                      onClick={() => {
                        pendingModalRatingRef.current = 0
                        setModalRating(0)
                        commitModalRating()
                      }}
                      className="mr-2 text-sm text-white/30 hover:text-white/60 transition"
                    >
                      ✕
                    </button>
                    <div
                      ref={modalStarsRef}
                      className="flex gap-1 items-center touch-none"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDraggingRating('modal')
                        const rect = modalStarsRef.current?.getBoundingClientRect()
                        const next = calculateRatingFromClientX(e.clientX, rect)
                        setModalRatingValue(next)
                        if (typeof e.currentTarget?.setPointerCapture === 'function') {
                          e.currentTarget.setPointerCapture(e.pointerId)
                        }
                      }}
                      onPointerMove={(e) => {
                        if (draggingRating !== 'modal') return
                        const rect = modalStarsRef.current?.getBoundingClientRect()
                        const next = calculateRatingFromClientX(e.clientX, rect)
                        setModalRatingValueThrottled(next)
                      }}
                      onPointerUp={(e) => {
                        if (draggingRating !== 'modal') return
                        e.preventDefault()
                        e.stopPropagation()
                        setDraggingRating(null)
                        if (typeof e.currentTarget?.releasePointerCapture === 'function') {
                          try {
                            e.currentTarget.releasePointerCapture(e.pointerId)
                          } catch {}
                        }
                        commitModalRating()
                      }}
                      onPointerCancel={() => {
                        if (draggingRating !== 'modal') return
                        setDraggingRating(null)
                        commitModalRating()
                      }}
                    >
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isFull = modalRating >= star
                        const isHalf = !isFull && modalRating >= star - 0.5
                        return (
                          <div key={star} className="relative w-8 h-8 flex items-center justify-center">
                            <StarSvg fraction={isFull ? 1 : isHalf ? 0.5 : 0} className="w-8 h-8 pointer-events-none" />
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Community Average Rating */}
                  {communityAvgRating && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-white/50">Community Avg:</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const isFull = communityAvgRating.avg >= star
                          const isHalf = !isFull && communityAvgRating.avg >= star - 0.5
                          return (
                            <div key={star} className="w-4 h-4">
                              <StarSvg fraction={isFull ? 1 : isHalf ? 0.5 : 0} className="w-4 h-4" />
                            </div>
                          )
                        })}
                      </div>
                      <span className="text-xs text-white/60">
                        {communityAvgRating.avg} ({communityAvgRating.count} {communityAvgRating.count === 1 ? 'rating' : 'ratings'})
                      </span>
                    </div>
                  )}

                  {/* Friends' Ratings */}
                  {friendsRatings.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-xs text-white/50 mb-2">Friends' Ratings:</p>
                      <div className="space-y-1">
                        {friendsRatings.map((fr, idx) => (
                          <div key={`${fr.owner}-${idx}`} className="flex items-center gap-2">
                            <span className="text-xs text-blue-400 min-w-[70px]">@{fr.owner}</span>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => {
                                const isFull = fr.rating >= star
                                const isHalf = !isFull && fr.rating >= star - 0.5
                                return (
                                  <div key={star} className="w-3 h-3">
                                    <StarSvg fraction={isFull ? 1 : isHalf ? 0.5 : 0} className="w-3 h-3" />
                                  </div>
                                )
                              })}
                            </div>
                            <span className="text-xs text-white/50">{fr.rating}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add to Pit */}
                  <div className="mt-4 pt-4 border-t border-white/10 relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (!showAddToPitDropdown) loadUserPitsForModal()
                        setShowAddToPitDropdown(!showAddToPitDropdown)
                      }}
                      className="w-full rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-400 transition hover:bg-blue-500/20"
                    >
                      Add to Pit
                    </button>
                    {showAddToPitDropdown && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#0b1225] border border-white/10 rounded-xl shadow-lg max-h-60 overflow-y-auto z-10">
                        {loadingPitsForModal ? (
                          <p className="text-xs text-white/50 p-4 text-center">Loading pits...</p>
                        ) : userPitsForModal.length > 0 ? (
                          userPitsForModal.map((pit) => (
                            <button
                              key={pit.id}
                              type="button"
                              onClick={() => addBookToPitFromModal(pit)}
                              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition border-b border-white/5 last:border-b-0"
                            >
                              <div>
                                <p className="text-sm text-white font-medium">{pit.title || 'Unnamed Pit'}</p>
                                <p className="text-xs text-white/50">{pit.participants_usernames?.length || 0} members</p>
                              </div>
                              <span className="text-blue-400">→</span>
                            </button>
                          ))
                        ) : (
                          <p className="text-xs text-white/50 p-4 text-center">No pits yet. Create one in Pits.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 py-10">
            <p className="text-sm text-white/60">Loading…</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight via-[#050916] to-black text-white overflow-x-hidden">
      {/* Sticky Header - appears on scroll */}
      {currentUser && !selectedFriend && isScrolled && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-[#0b1225]/98 to-[#050914]/95 backdrop-blur-lg border-b border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  if (selectedFriend) closeFriendProfile()
                  setSelectedStatusFilter(null)
                  setSelectedAuthor(null)
                  setSearchQuery('')
                  setSearchResults([])
                  setHasSearched(false)
                }}
                className="flex-shrink-0 transition-opacity hover:opacity-80"
              >
                <img
                  src="/bookmosh-logo.png"
                  alt="BookMosh"
                  className="h-10 w-auto"
                />
              </button>
              
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'discovery', label: 'Discovery' },
                  { id: 'library', label: 'Library' },
                  { id: 'moshes', label: 'Pits', badge: totalUnreadMoshes },
                  { id: 'feed', label: 'Feed' },
                  { id: 'community', label: 'Community', badge: incomingFriendRequests.length },
                  { id: 'lists', label: 'Lists' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/50 hover:text-white relative"
                  >
                    {item.label}
                    {item.badge > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
                
                {/* Profile Button */}
                <button
                  type="button"
                  onClick={() => scrollToSection('community')}
                  className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 pl-1.5 pr-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/50 hover:text-white"
                >
                  <div className="h-5 w-5 overflow-hidden rounded-full border border-white/10 bg-white/5 flex-shrink-0">
                    <img src={getProfileAvatarUrl(currentUser)} alt="Avatar" className="h-full w-full object-cover" />
                  </div>
                  <span>{currentUser.username}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10">
        {currentUser && (
          <header className="flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <button
              onClick={() => {
                // Close friend profile if open
                if (selectedFriend) {
                  closeFriendProfile()
                }
                setSelectedStatusFilter(null)
                setSelectedAuthor(null)
                setSearchQuery('')
                setSearchResults([])
                setHasSearched(false)
              }}
              className="transition-opacity hover:opacity-80"
            >
              <img
                src="/bookmosh-vert.png"
                alt="BookMosh"
                className="h-48 w-auto"
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { id: 'discovery', label: 'Discovery' },
              { id: 'library', label: 'Library' },
              { id: 'moshes', label: 'Pits', badge: totalUnreadMoshes },
              { id: 'feed', label: 'Feed' },
              { id: 'community', label: 'Community', badge: incomingFriendRequests.length },
              { id: 'lists', label: 'Lists' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/50 hover:text-white relative"
              >
                {item.label}
                {item.badge > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
            
            {/* Profile Button */}
            <button
              type="button"
              onClick={() => scrollToSection('community')}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 pl-2 pr-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/50 hover:text-white"
            >
              <div className="h-6 w-6 overflow-hidden rounded-full border border-white/10 bg-white/5 flex-shrink-0">
                <img src={getProfileAvatarUrl(currentUser)} alt="Avatar" className="h-full w-full object-cover" />
              </div>
              <span>{currentUser.username}</span>
            </button>
          </div>
          </header>
        )}

        {currentUser && activeMosh && isMoshAddFriendsOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeMoshAddFriends()
              }
            }}
          >
            <div className="w-full h-full sm:h-auto sm:w-[clamp(320px,80vw,620px)] rounded-none sm:rounded-3xl border border-white/15 bg-[#0b1225]/95 p-4 sm:p-6 flex flex-col pt-[env(safe-area-inset-top)]">
              <div className="sticky top-0 z-10 -mx-4 sm:mx-0 px-4 sm:px-0 pb-3 bg-[#0b1225]/95 backdrop-blur">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/40">Pit</p>
                    <h2 className="text-xl font-semibold text-white">Add friends</h2>
                    <p className="text-sm text-white/60 line-clamp-1">{activeMosh.mosh_title || activeMosh.book_title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeMoshAddFriends}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-3 flex-1 overflow-auto">
                {moshAddFriends.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {moshAddFriends.map((friend) => (
                      <div key={friend} className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1">
                        <span className="text-sm text-white">{friend}</span>
                        <button
                          type="button"
                          onClick={() => removeMoshAddFriend(friend)}
                          className="text-white/60 hover:text-white transition"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  value={moshAddSearch}
                  onChange={(e) => setMoshAddSearch(e.target.value)}
                  placeholder="Type to search friends..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                />

                <div className="max-h-48 space-y-2 overflow-auto rounded-2xl border border-white/10 bg-[#050914]/60 p-3">
                  {(Array.isArray(currentUser?.friends) ? currentUser.friends : [])
                    .filter((f) => {
                      const alreadyInMosh = (activeMosh?.participants_usernames || []).includes(f)
                      const matches = f.toLowerCase().includes(moshAddSearch.toLowerCase())
                      const notSelected = !moshAddFriends.includes(f)
                      return matches && notSelected && !alreadyInMosh
                    })
                    .map((friend) => (
                      <button
                        key={friend}
                        type="button"
                        onClick={() => addMoshAddFriend(friend)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:border-white/30 hover:bg-white/10"
                      >
                        {friend}
                      </button>
                    ))}

                  {(Array.isArray(currentUser?.friends) ? currentUser.friends : [])
                    .filter((f) => {
                      const alreadyInMosh = (activeMosh?.participants_usernames || []).includes(f)
                      const matches = f.toLowerCase().includes(moshAddSearch.toLowerCase())
                      const notSelected = !moshAddFriends.includes(f)
                      return matches && notSelected && !alreadyInMosh
                    }).length === 0 && (
                    <p className="text-sm text-white/60">{moshAddSearch ? 'No matching friends' : 'No friends available to add'}</p>
                  )}
                </div>

                <p className="text-sm text-rose-200 min-h-[1.25rem]">{moshAddError}</p>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeMoshAddFriends}
                  className="rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmMoshAddFriends}
                  disabled={moshAddLoading}
                  className="rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80 disabled:opacity-60"
                >
                  {moshAddLoading ? 'Adding…' : 'Add to mosh'}
                </button>
              </div>
            </div>
          </div>
        )}

        {reviewThread && (
          <div className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-sm">
            <div className="absolute inset-0 bg-[#0b1225]/95 overflow-auto pt-[env(safe-area-inset-top)]">
              <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1225]/95 backdrop-blur">
                <div className="mx-auto w-full max-w-3xl px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.4em] text-white/40">Review</p>
                      <h2 className="text-xl font-semibold text-white break-words">{reviewThread.title}</h2>
                      <p className="text-sm text-white/60 break-words">{reviewThread.author}</p>
                      <p className="text-xs text-white/50 mt-1">by @{reviewThread.reviewer_username || reviewThread.owner}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewThread(null)}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-3xl px-4 py-6">
                {reviewThreadLoading ? (
                  <p className="text-sm text-white/60">Loading…</p>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Review text</p>
                        <button
                          type="button"
                          onClick={toggleReviewLike}
                          className={`group flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                            reviewThreadLikes?.likedByMe
                              ? 'text-pink-400'
                              : 'text-white/50 hover:text-pink-400'
                          }`}
                          title={reviewThreadLikes?.users?.length ? `Liked by ${reviewThreadLikes.users.join(', ')}` : 'Like this review'}
                        >
                          <span>{reviewThreadLikes?.likedByMe ? '♥' : '♡'}</span>
                          {(reviewThreadLikes?.count ?? 0) > 0 ? <span>{reviewThreadLikes.count}</span> : null}
                        </button>
                      </div>

                      {reviewThread.spoiler_warning && !reviewThreadShowSpoiler ? (
                        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
                          <p className="text-sm text-white/80">This review contains spoilers.</p>
                          <button
                            type="button"
                            onClick={() => setReviewThreadShowSpoiler(true)}
                            className="mt-3 rounded-full border border-rose-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-rose-200 transition hover:border-rose-500 hover:bg-rose-500/10"
                          >
                            Show spoiler
                          </button>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-white/80 whitespace-pre-wrap">
                          {reviewThread.review ? reviewThread.review : 'No review text yet.'}
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Comments</p>
                        <p className="text-xs text-white/40">{reviewThreadComments.length}</p>
                      </div>

                      <div className="mt-4 space-y-3">
                        {reviewThreadComments.length > 0 ? (
                          reviewThreadComments.map((c) => (
                            <div key={c.id} className="rounded-2xl border border-white/10 bg-[#050914]/40 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm text-white/80">
                                  <span className="font-semibold text-white">@{c.commenter_username}</span>
                                  <span className="text-white/60"> · {formatTimeAgo(c.created_at)}</span>
                                </p>
                              </div>
                              <p className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{c.body}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-white/60">No comments yet.</p>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <input
                          value={reviewThreadCommentDraft}
                          onChange={(e) => setReviewThreadCommentDraft(e.target.value)}
                          placeholder="Write a comment…"
                          className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={postReviewComment}
                          disabled={!String(reviewThreadCommentDraft || '').trim()}
                          className="rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80 disabled:opacity-50"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!currentUser && (
          <header className="flex items-center justify-center pt-6 pb-2">
            <img
              src="/bookmosh-center.png"
              alt="BookMosh"
              className="h-40 w-auto sm:h-52 md:h-64"
            />
          </header>
        )}

        {currentUser && !selectedFriend && (
          <>
            {/* Discovery */}
            <section id="discovery" className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Discovery</p>
                  <h2 className="text-2xl font-semibold text-white">
                    {selectedAuthor ? `Books by ${selectedAuthor}` : 'Search the open shelves'}
                  </h2>
                  {selectedAuthor && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAuthor(null)
                        setSearchQuery('')
                        setSearchResults([])
                        setHasSearched(false)
                        setShowAllResults(false)
                      }}
                      className="mt-1 text-xs uppercase tracking-[0.3em] text-white/60 transition hover:text-white"
                    >
                      ← Back to search
                    </button>
                  )}
                </div>
                <p className="text-sm text-white/60">
                  {selectedAuthor ? `${searchResults.length} books by popularity` : 'Instant results'}
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                {!selectedAuthor && (
                  <>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setShowAllResults(false)
                        }}
                        placeholder="Search authors, titles, or themes..."
                        className="w-full bg-transparent px-4 py-3 pr-10 text-white placeholder:text-white/40 focus:outline-none"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('')
                            setSearchResults([])
                            setHasSearched(false)
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {searchQuery && (
                      <div className="flex items-center justify-between text-xs text-white/60">
                        <span>{isSearching ? 'Searching...' : `${searchResults.length} results`}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {hasSearched && searchResults.length > 0 && (
                <div className="mt-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    {(selectedAuthor || showAllResults ? searchResults : searchResults.slice(0, discoveryDisplayCount)).map((book) => (
                      <div
                        key={book.key}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#141b2d]/70 p-4 transition hover:border-white/40 cursor-pointer"
                        onClick={() => openModal(book)}
                      >
                        <div className="flex items-start gap-4">
                          {book.cover ? (
                            <img src={book.cover} alt={book.title} className="h-20 w-16 rounded-xl object-cover flex-shrink-0" />
                          ) : (
                            <div className="flex h-20 w-16 items-center justify-center rounded-xl bg-white/5 text-xs uppercase tracking-[0.2em] text-white/60 flex-shrink-0">Cover</div>
                          )}
                          <div className="flex flex-1 flex-col gap-2 min-w-0">
                            <p className="text-base font-semibold text-white line-clamp-2">{book.title}</p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openAuthorModal(book.author)
                              }}
                              className="text-sm text-white/60 hover:text-white hover:underline transition text-left cursor-pointer"
                            >
                              {book.author}
                            </button>
                            <div className="flex items-center gap-4 text-xs text-white/50">
                              {book.year && <span>{book.year}</span>}
                              {book.editionCount > 0 && <span>{book.editionCount} editions</span>}
                              {book.rating > 0 && <span>★ {book.rating.toFixed(1)}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          {(() => {
                            const bookKey = book.key || book.olKey || book.isbn || book.title?.toLowerCase()
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAddBook(book, 'to-read', true)
                                  }}
                                  className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                                    addedButtons[`${bookKey}:to-read`]
                                      ? 'border-green-500/60 bg-green-500/20 text-green-400'
                                      : 'border-white/20 text-white hover:border-white/60'
                                  }`}
                                >
                                  {addedButtons[`${bookKey}:to-read`] ? '✓' : '+ to-read'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAddBook(book, 'Reading', true)
                                  }}
                                  className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                                    addedButtons[`${bookKey}:Reading`]
                                      ? 'border-green-500/60 bg-green-500/20 text-green-400'
                                      : 'border-white/20 text-white hover:border-white/60'
                                  }`}
                                >
                                  {addedButtons[`${bookKey}:Reading`] ? '✓' : '+ Reading'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAddBook(book, 'Read', true)
                                  }}
                                  className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                                    addedButtons[`${bookKey}:Read`]
                                      ? 'border-green-500/60 bg-green-500/20 text-green-400'
                                      : 'border-white/20 text-white hover:border-white/60'
                                  }`}
                                >
                                  {addedButtons[`${bookKey}:Read`] ? '✓' : '+ Read'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAddBookOwned(book, true)
                                  }}
                                  className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                                    addedButtons[`${bookKey}:Owned`]
                                      ? 'border-green-500/60 bg-green-500/20 text-green-400'
                                      : 'border-[#ee6bfe]/40 text-[#ee6bfe] hover:border-[#ee6bfe]/80 hover:bg-[#ee6bfe]/10'
                                  }`}
                                >
                                  {addedButtons[`${bookKey}:Owned`] ? '✓' : '+ Own'}
                                </button>
                              </>
                            )
                          })()}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openAddToList(book)
                          }}
                          className="w-full rounded-2xl border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/60"
                        >
                          Add to list
                        </button>
                      </div>
                    ))}
                  </div>

                  {!selectedAuthor && !showAllResults && discoveryDisplayCount < searchResults.length && (
                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setDiscoveryDisplayCount((prev) => Math.min(searchResults.length, prev + 20))}
                        className="rounded-2xl border border-white/20 px-8 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:bg-white/5"
                      >
                        Show 20 more ({searchResults.length - discoveryDisplayCount} remaining)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {isAddToListOpen && addToListBook && (
              <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm">
                <div className="absolute inset-0 bg-[#0b1225]/95 overflow-auto pt-[env(safe-area-inset-top)]">
                  <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1225]/95 backdrop-blur">
                    <div className="mx-auto w-full max-w-2xl px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.4em] text-white/40">Add to list</p>
                          <h2 className="text-lg font-semibold text-white break-words">{addToListBook.title}</h2>
                          <p className="text-sm text-white/60 break-words">{addToListBook.author}</p>
                        </div>
                        <button
                          type="button"
                          onClick={closeAddToList}
                          className="flex-shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-4">
                        <input
                          value={addToListSearch}
                          onChange={(e) => setAddToListSearch(e.target.value)}
                          placeholder="Search your lists…"
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mx-auto w-full max-w-2xl px-4 py-6">
                    <div className="space-y-3">
                      {[...ownedLists, ...followedLists]
                        .filter((l) => {
                          const q = addToListSearch.trim().toLowerCase()
                          if (!q) return true
                          return (
                            String(l.title ?? '').toLowerCase().includes(q) ||
                            String(l.owner_username ?? '').toLowerCase().includes(q)
                          )
                        })
                        .map((l) => (
                          (() => {
                            const status = addToListStatusByListId?.[l.id] ?? null
                            const pending = Boolean(addToListPendingByListId?.[l.id])
                            const disabled = pending || status === 'added' || status === 'exists'
                            const cta = pending
                              ? 'Adding…'
                              : status === 'added'
                                ? '✓ Added'
                                : status === 'exists'
                                  ? '✓ Already'
                                  : status === 'error'
                                    ? 'Retry'
                                    : 'Add'

                            return (
                              <button
                                key={l.id}
                                type="button"
                                disabled={disabled}
                                onClick={() => addBookToSpecificList(l, addToListBook)}
                                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-white/30 hover:bg-white/10 disabled:opacity-60"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-white line-clamp-1">{l.title}</p>
                                  <p className="text-xs text-white/60 line-clamp-1">by {l.owner_username}</p>
                                </div>
                                <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                                  {cta}
                                </div>
                              </button>
                            )
                          })()
                        ))}

                      {[...ownedLists, ...followedLists].length === 0 && (
                        <p className="text-sm text-white/60">No lists yet. Create one in the Lists section first.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Library */}
            <section id="library" className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Library</p>
                  <h3 className="text-2xl font-semibold text-white">{tracker.length}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFullLibrary(!showFullLibrary)
                      if (!showFullLibrary) {
                        setTimeout(() => scrollToSection('library-search'), 100)
                      }
                    }}
                    className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                  >
                    {showFullLibrary ? '− Collapse' : '+ Browse All'}
                  </button>
                  <button
                    type="button"
                    onClick={scrollToDiscovery}
                    className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                  >
                    + Add book
                  </button>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - 2/3 width */}
                <div className="lg:col-span-2 space-y-6">
                  {/* To-Read Module */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm uppercase tracking-[0.4em] text-cyan-400">To-Read Pile</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setLibraryFilter({ status: 'to-read', owned: false })
                          setShowFullLibrary(true)
                          setTimeout(() => scrollToSection('library-search'), 100)
                        }}
                        className="text-white/60 hover:text-white transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {tracker.filter(b => b.status === 'to-read').slice(0, 6).map((book) => (
                        <button
                          key={book.title}
                          type="button"
                          onClick={() => openModal(book)}
                          title={`${book.title} by ${book.author}`}
                          className="flex-shrink-0 w-24 h-36 rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-white/30 transition"
                        >
                          {book.cover ? (
                            <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60 p-2 text-center">
                              {book.title}
                            </div>
                          )}
                        </button>
                      ))}
                      {tracker.filter(b => b.status === 'to-read').length === 0 && (
                        <p className="text-sm text-white/50">No books to read yet</p>
                      )}
                    </div>
                  </div>

                  {/* Read Module */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm uppercase tracking-[0.4em] text-green-400">Read</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setLibraryFilter({ status: 'Read', owned: false })
                          setShowFullLibrary(true)
                          setTimeout(() => scrollToSection('library-search'), 100)
                        }}
                        className="text-white/60 hover:text-white transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {[...tracker]
                        .filter((b) => b.status === 'Read')
                        .sort((a, b) => {
                          const aKey = new Date(a.read_at ?? a.status_updated_at ?? a.updated_at ?? 0).getTime()
                          const bKey = new Date(b.read_at ?? b.status_updated_at ?? b.updated_at ?? 0).getTime()
                          return bKey - aKey
                        })
                        .slice(0, 6)
                        .map((book) => (
                        <button
                          key={book.title}
                          type="button"
                          onClick={() => openModal(book)}
                          title={`${book.title} by ${book.author}`}
                          className="flex-shrink-0 w-24 h-36 rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-white/30 transition"
                        >
                          {book.cover ? (
                            <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60 p-2 text-center">
                              {book.title}
                            </div>
                          )}
                        </button>
                      ))}
                      {tracker.filter((b) => b.status === 'Read').length === 0 && (
                        <p className="text-sm text-white/50">No books read yet</p>
                      )}
                    </div>
                  </div>

                  {/* Owned Module */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm uppercase tracking-[0.4em] text-purple-400">Owned</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setLibraryFilter({ status: 'all', owned: true })
                          setShowFullLibrary(true)
                          setTimeout(() => scrollToSection('library-search'), 100)
                        }}
                        className="text-white/60 hover:text-white transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {tracker.filter(b => (b.tags ?? []).includes('Owned')).slice(0, 6).map((book) => (
                        <button
                          key={book.title}
                          type="button"
                          onClick={() => openModal(book)}
                          title={`${book.title} by ${book.author}`}
                          className="flex-shrink-0 w-24 h-36 rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-white/30 transition"
                        >
                          {book.cover ? (
                            <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60 p-2 text-center">
                              {book.title}
                            </div>
                          )}
                        </button>
                      ))}
                      {tracker.filter(b => (b.tags ?? []).includes('Owned')).length === 0 && (
                        <p className="text-sm text-white/50">No owned books yet</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - 1/3 width */}
                <div className="space-y-6">
                  {/* Currently Reading Module */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h4 className="text-sm uppercase tracking-[0.4em] text-pink-400 mb-4">Currently Reading ({tracker.filter(b => b.status === 'Reading').length})</h4>
                    <div className="space-y-4">
                      {tracker.filter(b => b.status === 'Reading').slice(0, 3).map((book) => (
                        <button
                          key={book.title}
                          type="button"
                          onClick={() => openModal(book)}
                          className="flex gap-3 w-full text-left hover:bg-white/5 rounded-xl p-2 transition"
                        >
                          <div className="flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden border border-white/10 bg-white/5">
                            {book.cover ? (
                              <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[8px] uppercase tracking-[0.2em] text-white/60 p-1 text-center">
                                {book.title}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white line-clamp-2">{book.title}</p>
                            <p className="text-xs text-white/60 line-clamp-1 mt-1">{book.author}</p>
                          </div>
                        </button>
                      ))}
                      {tracker.filter(b => b.status === 'Reading').length === 0 && (
                        <p className="text-sm text-white/50">No books currently reading</p>
                      )}
                    </div>
                    {tracker.filter(b => b.status === 'Reading').length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setLibraryFilter({ status: 'Reading', owned: false })
                          setShowFullLibrary(true)
                          setTimeout(() => scrollToSection('library-search'), 100)
                        }}
                        className="mt-4 w-full rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:bg-white/5"
                      >
                        View All
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Always visible library search at bottom of carousels */}
              <div id="library-search-bottom" className="mt-6 relative">
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => {
                    setLibrarySearch(e.target.value)
                    if (e.target.value.trim() && !showFullLibrary) {
                      setShowFullLibrary(true)
                    }
                  }}
                  placeholder="Search your library..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
                {librarySearch && (
                  <button
                    type="button"
                    onClick={() => setLibrarySearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Full Library View */}
              {showFullLibrary && (
                <>
                  <div className="mt-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setShowFullLibrary(false)}
                        className="flex items-center gap-2 text-white/60 hover:text-white transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Overview
                      </button>
                      {((libraryStatusFilter !== 'all') || libraryOwnedOnly || librarySearch) && (
                        <p className="text-sm text-white/60">
                          Showing <span className="text-white font-semibold">{filteredLibrary.length}</span> of <span className="text-white font-semibold">{tracker.length}</span> books
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={librarySort}
                        onChange={(e) => setLibrarySort(e.target.value)}
                        className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 focus:outline-none"
                      >
                        <option value="recent">Most Recent</option>
                        <option value="oldest">Oldest First</option>
                        <option value="title-asc">Title A-Z</option>
                        <option value="title-desc">Title Z-A</option>
                        <option value="author-asc">Author A-Z</option>
                        <option value="author-desc">Author Z-A</option>
                      </select>
                    </div>
                  </div>

                  {matchingProgress.active && (
                    <div className="mt-5 rounded-2xl border border-aurora/30 bg-aurora/5 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-aurora">Matching Covers</p>
                        <p className="text-xs text-white/60">{matchingProgress.current} / {matchingProgress.total}</p>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                        <div 
                          className="h-full bg-gradient-to-r from-aurora to-white/70 transition-all duration-300"
                          style={{ width: `${(matchingProgress.current / matchingProgress.total) * 100}%` }}
                        />
                      </div>
                      {matchingProgress.currentBook && (
                        <p className="text-xs text-white/50 line-clamp-1">
                          Matching: {matchingProgress.currentBook}
                        </p>
                      )}
                    </div>
                  )}

                  <div id="library-search" className="mt-5 relative">
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search your library..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
                {librarySearch && (
                  <button
                    type="button"
                    onClick={() => setLibrarySearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'Reading', label: 'Reading' },
                  { key: 'to-read', label: 'To Read' },
                  { key: 'Read', label: 'Read' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setLibraryStatusFilter(opt.key)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                      libraryStatusFilter === opt.key
                        ? 'border-white/60 bg-white/10 text-white'
                        : 'border-white/10 text-white/60 hover:border-white/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setLibraryOwnedOnly((v) => !v)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                    libraryOwnedOnly
                      ? 'border-white/60 bg-white/10 text-white'
                      : 'border-white/10 text-white/60 hover:border-white/40'
                  }`}
                >
                  Owned
                </button>

                {(libraryStatusFilter !== 'all' || libraryOwnedOnly) && (
                  <button
                    type="button"
                    onClick={() => {
                      setLibraryStatusFilter('all')
                      setLibraryOwnedOnly(false)
                    }}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60 transition hover:border-white/40 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="mt-6 space-y-3">
                {paginatedLibrary.length > 0 ? (
                  paginatedLibrary.map((book) => (
                    <div key={book.title} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <button
                        type="button"
                        onClick={() => openModal(book)}
                        className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5"
                      >
                        {book.cover ? (
                          <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">Cover</div>
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm uppercase tracking-[0.4em] text-white/40">{book.status}</p>
                        <p className="mt-1 text-xs text-white/40">
                          Marked {book.status}{' '}
                          {formatTimeAgo(book.status_updated_at ?? book.read_at ?? book.updated_at)}
                        </p>
                        <button
                          type="button"
                          onClick={() => openModal(book)}
                          className="text-lg font-semibold text-white line-clamp-2 hover:text-white/80 transition text-left"
                        >
                          {book.title}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openAuthorModal(book.author)
                          }}
                          className="text-sm text-white/60 line-clamp-1 hover:text-white hover:underline transition text-left cursor-pointer"
                        >
                          {book.author}
                        </button>
                        
                        <div
                          className="mt-1 flex items-center gap-0.5 select-none"
                          onMouseLeave={() => {
                            setHoverRatingTitle('')
                            setHoverRatingValue(0)
                            setDraggingRating(null)
                          }}
                          onMouseUp={() => {
                            if (draggingRating === book.title && hoverRatingValue > 0) {
                              updateBook(book.title, { rating: hoverRatingValue })
                            }
                            setDraggingRating(null)
                          }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              updateBook(book.title, { rating: 0 })
                            }}
                            className="mr-1 text-xs text-white/30 hover:text-white/60 transition"
                          >
                            ✕
                          </button>
                          {[1, 2, 3, 4, 5].map((star) => {
                            const currentRating = hoverRatingTitle === book.title ? hoverRatingValue : (book.rating || 0)
                            const isFull = currentRating >= star
                            const isHalf = !isFull && currentRating >= star - 0.5
                            return (
                              <div key={star} className="relative w-5 h-5 flex items-center justify-center">
                                <div
                                  className="absolute left-0 top-0 w-1/2 h-full z-10 cursor-pointer"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    setDraggingRating(book.title)
                                    setHoverRatingTitle(book.title)
                                    setHoverRatingValue(star - 0.5)
                                  }}
                                  onMouseEnter={() => {
                                    setHoverRatingTitle(book.title)
                                    setHoverRatingValue(star - 0.5)
                                    if (draggingRating === book.title) {
                                      // Live update while dragging
                                    }
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    updateBook(book.title, { rating: star - 0.5 })
                                  }}
                                />
                                <div
                                  className="absolute right-0 top-0 w-1/2 h-full z-10 cursor-pointer"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    setDraggingRating(book.title)
                                    setHoverRatingTitle(book.title)
                                    setHoverRatingValue(star)
                                  }}
                                  onMouseEnter={() => {
                                    setHoverRatingTitle(book.title)
                                    setHoverRatingValue(star)
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    updateBook(book.title, { rating: star })
                                  }}
                                />
                                <StarSvg
                                  fraction={isFull ? 1 : isHalf ? 0.5 : 0}
                                  className="w-4 h-4 pointer-events-none"
                                />
                              </div>
                            )
                          })}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {(book.tags ?? []).map((tag) => (
                            <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">{tag}</span>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {statusTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setBookStatusTag(book.title, tag)}
                              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                                book.status === tag
                                  ? 'border-white/60 bg-white/10 text-white'
                                  : 'border-white/10 text-white/60 hover:border-white/40'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => toggleBookOwned(book.title)}
                            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                              (book.tags ?? []).includes('Owned')
                                ? 'border-white/60 bg-white/10 text-white'
                                : 'border-white/10 text-white/60 hover:border-white/40'
                            }`}
                          >
                            Owned
                          </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openModal(book)}
                            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => openAddToList(book)}
                            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/60"
                          >
                            Add to list
                          </button>
                          <button
                            type="button"
                            onClick={() => openMoshInvite(book)}
                            className="rounded-full bg-gradient-to-r from-aurora to-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                          >
                            Send Pit invite
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/60">No books yet. Add one from Discovery.</p>
                )}
              </div>

                  {libraryDisplayCount < filteredLibrary.length && (
                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setLibraryDisplayCount(prev => prev + 20)}
                        className="rounded-2xl border border-white/20 px-8 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:bg-white/5"
                      >
                        Load More ({Math.min(20, filteredLibrary.length - libraryDisplayCount)} more)
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Active Pits (below Library) */}
            <section id="moshes" className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Pits</p>
                  <h3 className="text-2xl font-semibold text-white">{activeMoshes.length}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreatePitModal(true)}
                    className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                  >
                    + New
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMoshPanelOpen(true)}
                    className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                  >
                    Open
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeMoshes.length > 0 ? (
                  activeMoshes.map((mosh) => (
                    <button
                      key={mosh.id}
                      type="button"
                      onClick={() => openMosh(mosh)}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#050914]/60 p-3 text-left transition hover:border-white/40"
                    >
                      <div className="h-14 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex-shrink-0 flex items-center justify-center">
                        <span className="text-xl">💬</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white line-clamp-1">{mosh.title || mosh.mosh_title || 'Pit'}</p>
                        <p className="text-xs text-white/60 line-clamp-1">{mosh.participants_usernames?.length || 0} members</p>
                      </div>
                      {(unreadByMoshId[mosh.id] ?? 0) > 0 && (
                        <span className="rounded-full bg-rose-500/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                          {unreadByMoshId[mosh.id]}
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-white/60">No pits yet. Create one to start chatting!</p>
                )}
              </div>
            </section>

            {/* Feed (below Active Pits) */}
            <section id="feed" className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Feed</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['everyone', 'friends', 'me'].map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setFeedScope(scope)}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                        feedScope === scope
                          ? 'border-white/60 bg-white/10 text-white'
                          : 'border-white/10 text-white/60 hover:border-white/40'
                      }`}
                    >
                      {scope}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={fetchFeed}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60 transition hover:border-white/40 hover:text-white"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Like notifications */}
              {likeNotifications.length > 0 && (
                <div className="mt-4 space-y-2">
                  {likeNotifications.slice(0, 5).map((notif) => (
                    <div key={notif.id} className="rounded-xl border border-pink-500/20 bg-pink-500/5 px-4 py-3 text-sm text-white/80">
                      <span className="inline-flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-pink-400">
                          <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                        <button
                          type="button"
                          onClick={() => viewFriendProfile(notif.username)}
                          className="font-semibold text-aurora hover:underline"
                        >
                          {notif.username}
                        </button>
                        <span className="text-white/60">liked your addition of</span>
                        <button
                          type="button"
                          onClick={() => openModal({ title: notif.bookTitle, author: notif.bookAuthor, cover: notif.bookCover })}
                          className="font-semibold text-aurora hover:underline"
                        >
                          {notif.bookTitle}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 space-y-2">
                {feedItems.length > 0 ? (
                  feedItems.slice(0, feedDisplayCount).map((item) => {
                    if (item.item_type === 'recommendation') {
                      const isSent = Boolean(currentUser?.id && item.sender_id === currentUser.id)
                      const headline = isSent
                        ? `You recommended to @${item.recipient_username}`
                        : `@${item.sender_username} recommended to you`

                      return (
                        <button
                          key={`recommendation:${item.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedRecommendation(item)
                            setRecommendationComments([])
                            setRecommendationCommentDraft('')
                            loadRecommendationComments(item.id)
                          }}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-white/30"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-white/80">
                              <span className="font-semibold text-white">{headline}</span>
                            </p>
                            <span className="text-[10px] text-white/40 whitespace-nowrap">{formatTimeAgo(item.created_at)}</span>
                          </div>

                          <div className="mt-3 flex gap-4">
                            {item.book_cover ? (
                              <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                <img src={item.book_cover} alt={item.book_title} className="h-full w-full object-cover" />
                              </div>
                            ) : (
                              <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-2xl">
                                📚
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white line-clamp-2">{item.book_title}</p>
                              {item.book_author && <p className="text-xs text-white/60 mt-1 line-clamp-1">{item.book_author}</p>}
                              {item.note && <p className="text-xs text-white/50 mt-2 line-clamp-2 italic">&quot;{item.note}&quot;</p>}
                            </div>
                          </div>
                        </button>
                      )
                    }

                    // Check if this is a list creation event
                    if (item.event_type === 'list_created') {
                      return (
                        <div
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-white/80">
                              <button
                                type="button"
                                onClick={() => viewFriendProfile(item.owner_username)}
                                className="font-semibold text-white hover:text-aurora hover:underline transition"
                              >
                                {item.owner_username}
                              </button>
                              <span className="text-white/60"> created a new list: </span>
                              <span className="font-semibold text-white">
                                {item.book_title}
                              </span>
                            </p>
                            <span className="text-[10px] text-white/40 whitespace-nowrap">{formatTimeAgo(item.created_at)}</span>
                          </div>
                        </div>
                      )
                    }
                    
                    // Regular book event
                    const book = mapFeedItemToBook(item)
                    const status = (book.tags ?? []).find(t => ['to-read', 'Reading', 'Read'].includes(t)) || 'their library'
                    const statusText = status === 'to-read' ? 'to read list' : status === 'Reading' ? 'currently reading' : status === 'Read' ? 'read list' : 'library'
                    
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-white/80">
                            <button
                              type="button"
                              onClick={() => viewFriendProfile(item.owner_username)}
                              className="font-semibold text-white hover:text-aurora hover:underline transition"
                            >
                              {item.owner_username}
                            </button>
                            <span className="text-white/60"> added </span>
                            <button
                              type="button"
                              onClick={() => openModal(book)}
                              className="font-semibold text-white hover:text-aurora hover:underline transition"
                            >
                              {book.title}
                            </button>
                            <span className="text-white/60"> by </span>
                            <button
                              type="button"
                              onClick={() => {
                                scrollToDiscovery()
                                openAuthorModal(book.author)
                              }}
                              className="font-semibold text-white hover:text-aurora hover:underline transition"
                            >
                              {book.author}
                            </button>
                            <span className="text-white/60"> to {statusText}</span>
                          </p>
                          <span className="text-[10px] text-white/40 whitespace-nowrap">{formatTimeAgo(item.created_at)}</span>
                        </div>
                        
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleFeedLike(item.id)}
                            className={`group flex items-center gap-1 text-xs transition ${
                              feedLikes[item.id]?.likedByMe
                                ? 'text-pink-400'
                                : 'text-white/50 hover:text-pink-400'
                            }`}
                            title={feedLikes[item.id]?.users?.length ? `Liked by ${feedLikes[item.id].users.join(', ')}` : 'Like this post'}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill={feedLikes[item.id]?.likedByMe ? 'currentColor' : 'none'}
                              stroke="currentColor"
                              strokeWidth={2}
                              className="h-4 w-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                              />
                            </svg>
                            {(feedLikes[item.id]?.count ?? 0) > 0 && (
                              <span>{feedLikes[item.id].count}</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openReviewThreadForEvent(item)}
                            className="text-xs text-white/50 hover:text-white transition"
                          >
                            Review
                          </button>
                          <button
                            type="button"
                            onClick={() => openMoshInvite(book)}
                            className="text-xs text-white/50 hover:text-white transition"
                          >
                            Send Pit invite
                          </button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-white/60">No feed activity yet.</p>
                )}
              </div>

              {feedItems.length > feedDisplayCount && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setFeedDisplayCount((prev) => prev + 10)}
                    className="rounded-2xl border border-white/20 px-8 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:bg-white/5"
                  >
                    Show 10 more
                  </button>
                </div>
              )}
            </section>

            {/* Community */}
            <section id="community" className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Community</p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchFeed()}
                  className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
                <div className="space-y-3 rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Profile</p>
                        <p className="text-sm text-white/60">Customize your avatar + top books</p>
                      </div>
                      <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                        <img
                          src={getProfileAvatarUrl({ avatar_icon: profileAvatarIcon, avatar_url: profileAvatarUrl })}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Username</p>
                      {editingUsername ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            placeholder="Enter new username"
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!newUsername.trim()) return
                                try {
                                  setProfileSaving(true)
                                  setProfileMessage('')
                                  await updateProfileFields({ username: newUsername.trim() })
                                  setEditingUsername(false)
                                  setProfileMessage('Username updated successfully!')
                                } catch (error) {
                                  console.error('Username update failed', error)
                                  setProfileMessage(error?.message || 'Failed to update username.')
                                } finally {
                                  setProfileSaving(false)
                                }
                              }}
                              disabled={profileSaving || !newUsername.trim()}
                              className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUsername(false)
                                setNewUsername('')
                              }}
                              className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <span className="text-white font-semibold">{currentUser?.username}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewUsername(currentUser?.username || '')
                              setEditingUsername(true)
                            }}
                            className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Pick an icon</p>
                      <div className="grid grid-cols-6 gap-2">
                        {PROFILE_ICONS.map((icon) => (
                          <button
                            key={icon.id}
                            type="button"
                            onClick={() => {
                              setProfileAvatarIcon(icon.id)
                              setProfileAvatarUrl('')
                              ;(async () => {
                                try {
                                  setProfileSaving(true)
                                  setProfileMessage('')
                                  await updateProfileFields({ avatar_icon: icon.id, avatar_url: null })
                                } catch (error) {
                                  console.error('Profile avatar icon save failed', error)
                                  setProfileMessage(error?.message || 'Failed to save.')
                                } finally {
                                  setProfileSaving(false)
                                }
                              })()
                            }}
                            className={`h-10 w-10 overflow-hidden rounded-xl border bg-white/5 transition ${
                              profileAvatarUrl
                                ? 'border-white/10 opacity-60'
                                : profileAvatarIcon === icon.id
                                  ? 'border-white/60'
                                  : 'border-white/10 hover:border-white/40'
                            }`}
                          >
                            <img src={iconDataUrl(icon.svg)} alt={icon.id} className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Or upload</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          onProfileUpload(f)
                          e.target.value = ''
                        }}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                      />
                      {profileAvatarUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileAvatarUrl('')
                            ;(async () => {
                              try {
                                setProfileSaving(true)
                                setProfileMessage('')
                                await updateProfileFields({ avatar_icon: profileAvatarIcon, avatar_url: null })
                              } catch (error) {
                                console.error('Profile switch to icon save failed', error)
                                setProfileMessage(error?.message || 'Failed to save.')
                              } finally {
                                setProfileSaving(false)
                              }
                            })()
                          }}
                          className="mt-2 w-full rounded-2xl border border-white/20 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                        >
                          Use icon instead
                        </button>
                      )}
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Top 4 books</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {profileTopBooks.map((slotValue, idx) => {
                          const isCover = isCoverUrlValue(slotValue)
                          const title = isCover ? '' : String(slotValue ?? '').trim()
                          const book = title
                            ? tracker.find((b) => normalizeTitleValue(b.title) === normalizeTitleValue(title))
                            : null
                          const cover = isCover ? String(slotValue) : (book?.cover ?? null)
                          return (
                            <div
                              key={`${idx}-${String(slotValue || 'empty')}`}
                              className="rounded-2xl border border-white/10 bg-white/5 p-2 flex flex-col"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (!slotValue) {
                                    openTopBookModal(idx)
                                    return
                                  }
                                  // Default action = edit cover/details
                                  const fallbackTitle = title || 'Top book'
                                  openModal(book ?? { title: fallbackTitle, author: 'Unknown author', cover })
                                }}
                                className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 aspect-[2/3]"
                              >
                                {slotValue ? (
                                  cover ? (
                                    <img src={cover} alt={title || 'Top book'} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">No cover</div>
                                  )
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-2xl text-white/50">+</div>
                                )}
                              </button>

                              {slotValue && (
                                <div className="mt-2 flex flex-col gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openTopBookModal(idx, isCover ? '' : `${title}`)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40"
                                  >
                                    Change
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const fallbackTitle = title || 'Top book'
                                      openModal(book ?? { title: fallbackTitle, author: 'Unknown author', cover })
                                    }}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40"
                                  >
                                    Cover
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => clearTopBookSlot(idx)}
                                    className="w-full rounded-xl border border-rose-500/30 bg-rose-500/10 px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300 transition hover:border-rose-500/60"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {Array.from({ length: Math.max(0, 4 - profileTopBooks.length) }).map((_, idx) => (
                          <div key={idx} className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-2">
                            <div className="w-full rounded-xl border border-white/10 bg-white/5 aspect-[2/3]" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={saveProfile}
                      disabled={profileSaving}
                      className="w-full rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80 disabled:opacity-60"
                    >
                      {profileSaving ? 'Saving…' : 'Save Profile'}
                    </button>
                    <p className="text-xs text-white/60 min-h-[1.25rem]">{profileMessage}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Friends</p>
                      <p className="text-sm text-white/60">{activeFriendProfiles.length} connections</p>
                    </div>
                    <div className="text-xs text-white/50">{activeFriendProfiles.length} online</div>
                  </div>
                  <div className="space-y-2">
                    {activeFriendProfiles.length > 0 ? (
                      activeFriendProfiles.map((friend) => {
                        const friendBooks = users.find(u => u.username === friend.username)?.library || []
                        const recentBooks = friendBooks.filter(b => b.status === 'Read').slice(0, 3)
                        
                        return (
                          <div key={friend.username} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <button
                                type="button"
                                onClick={() => viewFriendProfile(friend.username)}
                                className="text-left text-sm font-semibold text-white hover:text-white/80 transition-colors"
                              >
                                {friend.username}
                              </button>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => viewFriendProfile(friend.username)}
                                  className="text-xs uppercase tracking-[0.3em] text-white/60 hover:text-white transition"
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUnfriend(friend.username)}
                                  className="text-[10px] uppercase tracking-[0.3em] text-rose-300/80 hover:text-rose-200 transition"
                                >
                                  Unfriend
                                </button>
                              </div>
                            </div>
                            {recentBooks.length > 0 && (
                              <div className="space-y-1 mt-2 pt-2 border-t border-white/10">
                                <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Last 3 Read</p>
                                {recentBooks.map((book, idx) => (
                                  <div key={idx} className="flex items-center gap-1 text-xs text-white/50">
                                    <span className="text-white/30">•</span>
                                    <span className="line-clamp-1">{book.title}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-sm text-white/60">No friends yet.</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={friendQuery}
                      onChange={(e) => setFriendQuery(e.target.value)}
                      placeholder="Search by username or email"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendFriendInvite}
                      className="w-full rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                    >
                      Request connection
                    </button>
                    <p className="text-xs text-white/60">{friendMessage}</p>
                  </div>

                  <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Invite by email</p>
                      <p className="text-sm text-white/60">Send a BookMosh invite.</p>
                    </div>
                    <input
                      type="email"
                      value={emailInvite}
                      onChange={(e) => setEmailInvite(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSendEmailInvite()
                        }
                      }}
                      placeholder="friend@email.com"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendEmailInvite}
                      disabled={emailInviteSending}
                      className="w-full rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80 disabled:opacity-60"
                    >
                      {emailInviteSending ? 'Sending…' : 'Send email invite'}
                    </button>
                    <p className="text-xs text-white/60 min-h-[1.25rem]">{emailInviteMessage}</p>
                  </div>

                  <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Invites</p>
                      <button
                        type="button"
                        onClick={loadFriendRequests}
                        className="text-[10px] uppercase tracking-[0.3em] text-white/50 hover:text-white transition"
                      >
                        Refresh
                      </button>
                    </div>

                    {friendRequestsLoading && (
                      <p className="text-sm text-white/60">Loading invites…</p>
                    )}

                    {!friendRequestsLoading && incomingFriendRequests.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Incoming</p>
                        {incomingFriendRequests.map((req) => (
                          <div key={req.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white line-clamp-1">{req.requester_username}</p>
                              <p className="text-xs text-white/50">wants to connect</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => acceptFriendInvite(req)}
                                className="rounded-full bg-gradient-to-r from-aurora to-white/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => declineFriendInvite(req)}
                                className="rounded-full border border-white/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!friendRequestsLoading && outgoingFriendRequests.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Outgoing</p>
                        {outgoingFriendRequests.map((req) => (
                          <div key={req.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white line-clamp-1">{req.recipient_username}</p>
                              <p className="text-xs text-white/50">pending</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => cancelFriendInvite(req)}
                              className="rounded-full border border-white/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                            >
                              Cancel
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {!friendRequestsLoading && incomingFriendRequests.length === 0 && outgoingFriendRequests.length === 0 && (
                      <p className="text-sm text-white/60">No pending friend requests.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Privacy</p>
                        <p className="text-sm text-white/60">{isPrivate ? 'Private profile' : 'Public profile'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPrivate(!isPrivate)}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40"
                      >
                        {isPrivate ? 'Make Public' : 'Make Private'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">Import</p>
                    <div className="flex gap-2 text-[10px] uppercase tracking-[0.3em]">
                      <button
                        type="button"
                        onClick={() => {
                          setImportFileType('goodreads')
                          setImportMessage('')
                        }}
                        className={`rounded-full px-3 py-1 transition ${importFileType === 'goodreads' ? 'bg-white/10 text-white' : 'text-white/50'}`}
                      >
                        Goodreads
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImportFileType('storygraph')
                          setImportMessage('')
                        }}
                        className={`rounded-full px-3 py-1 transition ${importFileType === 'storygraph' ? 'bg-white/10 text-white' : 'text-white/50'}`}
                      >
                        StoryGraph
                      </button>
                    </div>
                    <input
                      type="file"
                      accept={importFileType === 'goodreads' ? '.csv' : '.csv,.json'}
                      onChange={importHandler}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    />
                    <p className="text-[10px] text-rose-300 min-h-[1rem]">{importMessage}</p>
                  </div>
                  
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">Danger Zone</p>
                    <button
                      type="button"
                      onClick={deleteAllBooks}
                      className="w-full rounded-2xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-rose-400 transition hover:border-rose-500 hover:bg-rose-500/20"
                    >
                      Delete All Books
                    </button>
                    <p className="text-[10px] text-white/50">This will permanently delete all books from your library.</p>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:bg-white/10"
                    >
                      Log Out
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section id="lists" className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Lists</p>
                </div>
                <button
                  type="button"
                  onClick={fetchLists}
                  className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                >
                  Refresh
                </button>
              </div>

              {listsMessage && <p className="mt-3 text-sm text-rose-200">{listsMessage}</p>}

              <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr] overflow-hidden">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">Create a list</p>
                    <div className="mt-3 space-y-3">
                      <input
                        value={newListTitle}
                        onChange={(e) => setNewListTitle(e.target.value)}
                        placeholder="List title"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                      />
                      <textarea
                        value={newListDescription}
                        onChange={(e) => setNewListDescription(e.target.value)}
                        placeholder="Description (optional)"
                        rows={3}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewListIsPublic(true)}
                          className={`flex-1 rounded-2xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                            newListIsPublic
                              ? 'border-white/60 bg-white/10 text-white'
                              : 'border-white/20 text-white/70 hover:border-white/60'
                          }`}
                        >
                          Public
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewListIsPublic(false)}
                          className={`flex-1 rounded-2xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                            !newListIsPublic
                              ? 'border-white/60 bg-white/10 text-white'
                              : 'border-white/20 text-white/70 hover:border-white/60'
                          }`}
                        >
                          Private
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={createList}
                        disabled={listsLoading}
                        className="w-full rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80 disabled:opacity-60"
                      >
                        {listsLoading ? 'Creating…' : 'Create list'}
                      </button>
                    </div>
                  </div>

                  {pendingListInvites.length > 0 && (
                    <div className="rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Invites</p>
                      <div className="mt-3 space-y-2">
                        {pendingListInvites.map((inv) => (
                          <div key={inv.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <p className="text-sm text-white">
                              <span className="text-white/60">From</span> {inv.inviter_username}
                            </p>
                            <p className="text-xs text-white/50 line-clamp-1">{inv.list_title}</p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                              <button
                                type="button"
                                onClick={() => respondToListInvite(inv.id, 'accepted')}
                                className="flex-1 rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => respondToListInvite(inv.id, 'declined')}
                                className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/50"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Browse</p>
                      <div className="flex gap-2">
                        {[
                          { id: 'mine', label: 'Mine' },
                          { id: 'following', label: 'Following' },
                          { id: 'public', label: 'Public' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setListsTab(t.id)}
                            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] transition ${
                              listsTab === t.id
                                ? 'bg-white/10 border border-white/40 text-white'
                                : 'border border-white/10 text-white/60 hover:border-white/30'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {(listsTab === 'mine' ? ownedLists : listsTab === 'following' ? followedLists : publicLists).map((l) => (
                        <div key={l.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <button type="button" onClick={() => openList(l)} className="w-full text-left">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white line-clamp-1">{l.title}</p>
                                <p className="text-xs text-white/60 line-clamp-1">by {l.owner_username}</p>
                                {l.description && <p className="mt-1 text-xs text-white/50 line-clamp-2">{l.description}</p>}
                              </div>

                              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                <div className="flex items-center">
                                  {Array.from({ length: Math.min(4, (l.preview_covers ?? []).length || 0) }).map((_, idx) => {
                                    const cover = l.preview_covers[idx]
                                    return (
                                      <div
                                        key={`${l.id}-preview-${idx}`}
                                        className="h-14 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5"
                                        style={{ marginLeft: idx === 0 ? 0 : -12 }}
                                      >
                                        <img src={cover} alt="Cover" className="h-full w-full object-cover" />
                                      </div>
                                    )
                                  })}
                                  {(l.preview_covers ?? []).length === 0 && (
                                    <div className="h-14 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {listsTab === 'mine' ? (
                              <>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
                                  {l.is_public ? 'Public' : 'Private'}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
                                  {l.item_count ?? 0}
                                </span>
                              </>
                            ) : listsTab === 'following' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => unfollowList(l.id)}
                                  className="rounded-full border border-rose-500/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-300 transition hover:border-rose-500 hover:bg-rose-500/10"
                                >
                                  Unfollow
                                </button>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
                                  {l.item_count ?? 0}
                                </span>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => followList(l.id)}
                                  className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                                >
                                  Follow
                                </button>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
                                  {l.item_count ?? 0}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}

                      {(listsTab === 'mine' ? ownedLists : listsTab === 'following' ? followedLists : publicLists).length === 0 && (
                        <p className="text-sm text-white/60">{listsLoading ? 'Loading…' : 'Nothing here yet.'}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                    {!selectedList ? (
                      <p className="text-sm text-white/60">Create or open a list, then use the search below to add books from your library.</p>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Selected list</p>
                            <h4 className="text-xl font-semibold text-white">{selectedList.title}</h4>
                            <p className="text-sm text-white/60">by {selectedList.owner_username}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              clearSelectedList()
                            }}
                            className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                          >
                            Close
                          </button>
                        </div>

                        {selectedList.owner_id === currentUser?.id && (
                          <div className="mt-5">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Invite a friend</p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                value={listInviteUsername}
                                onChange={(e) => setListInviteUsername(e.target.value)}
                                placeholder="Friend username"
                                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={sendListInvite}
                                className="rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                              >
                                Send invite
                              </button>
                            </div>
                            {listInviteError && <p className="mt-2 text-sm text-rose-200">{listInviteError}</p>}

                            {outgoingListInvites.length > 0 && (
                              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Pending invites</p>
                                <div className="mt-2 space-y-2">
                                  {outgoingListInvites.map((inv) => (
                                    <div key={inv.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#050914]/40 px-3 py-2">
                                      <div className="min-w-0">
                                        <p className="text-sm text-white line-clamp-1">{inv.invitee_username}</p>
                                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Pending</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => revokeListInvite(inv.id)}
                                        className="rounded-full border border-rose-500/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-300 transition hover:border-rose-500 hover:bg-rose-500/10"
                                      >
                                        Uninvite
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-6">
                          <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Add a book from your library</p>
                          <input
                            value={listBookSearch}
                            onChange={(e) => setListBookSearch(e.target.value)}
                            placeholder="Search your library…"
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                          />
                          {listBookSearch.trim() && (
                            <div className="mt-3 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-[#0b1225]/40 p-2">
                              {tracker
                                .filter((b) => {
                                  const q = listBookSearch.toLowerCase()
                                  return (
                                    (b.title || '').toLowerCase().includes(q) ||
                                    (b.author || '').toLowerCase().includes(q)
                                  )
                                })
                                .slice(0, 25)
                                .map((b) => (
                                  <button
                                    key={`${b.title}-${b.author}`}
                                    type="button"
                                    onClick={() => addBookToList(b)}
                                    className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:border-white/30 hover:bg-white/10"
                                  >
                                    <div className="h-12 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/5 flex-shrink-0">
                                      {b.cover ? (
                                        <img src={b.cover} alt={b.title} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">Cover</div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold line-clamp-1">{b.title}</p>
                                      <p className="text-xs text-white/60 line-clamp-1">{b.author}</p>
                                    </div>
                                  </button>
                                ))}
                              {tracker.filter((b) => {
                                const q = listBookSearch.toLowerCase()
                                return (
                                  (b.title || '').toLowerCase().includes(q) ||
                                  (b.author || '').toLowerCase().includes(q)
                                )
                              }).length === 0 && <p className="p-3 text-sm text-white/60">No matches.</p>}
                            </div>
                          )}
                        </div>

                        <div className="mt-6">
                          <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Books</p>
                          {selectedListItemsLoading ? (
                            <p className="text-sm text-white/60">Loading…</p>
                          ) : selectedListItems.length > 0 ? (
                            <div className="space-y-2">
                              {selectedListItems.map((it) => (
                                <button
                                  key={it.id}
                                  type="button"
                                  onClick={() =>
                                    openModal({
                                      title: it.book_title,
                                      author: it.book_author || 'Unknown author',
                                      cover: it.book_cover ?? null,
                                      olKey: it.ol_key ?? null,
                                      isbn: it.isbn ?? null,
                                    })
                                  }
                                  className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/30 hover:bg-white/10"
                                >
                                  <div className="h-14 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex-shrink-0">
                                    {it.book_cover ? (
                                      <img src={it.book_cover} alt={it.book_title} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">Cover</div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-white line-clamp-1">{it.book_title}</p>
                                    <p className="text-xs text-white/60 line-clamp-1">{it.book_author || '—'}</p>
                                  </div>
                                  {(selectedList.owner_id === currentUser?.id || it.added_by === currentUser?.id) && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        removeListItem(it.id)
                                      }}
                                      className="rounded-full border border-rose-500/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-300 transition hover:border-rose-500 hover:bg-rose-500/10"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-white/60">No books yet.</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section id="recommendations" className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Recommendations</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecommendModal(true)
                      setRecommendBookData(null)
                      setRecommendRecipients([])
                      setRecommendNote('')
                      setRecommendFriendSearch('')
                    }}
                    className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                    title="Create recommendation"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={fetchRecommendations}
                    className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-5">
                {recommendationsLoading ? (
                  <p className="text-sm text-white/60">Loading recommendations…</p>
                ) : recommendations.length > 0 ? (
                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-3">
                      {recommendations.map((rec) => {
                        const isSent = Boolean(currentUser?.id && rec.sender_id === currentUser.id)
                        const headline = isSent
                          ? `To @${rec.recipient_username}`
                          : `From @${rec.sender_username}`

                        return (
                          <button
                            key={rec.id}
                            type="button"
                            onClick={() => {
                              setSelectedRecommendation(rec)
                              setRecommendationComments([])
                              setRecommendationCommentDraft('')
                              loadRecommendationComments(rec.id)
                            }}
                            className="flex-shrink-0 w-[200px] sm:w-56 rounded-2xl border border-white/10 bg-[#050914]/60 p-4 text-left transition hover:border-white/30 hover:bg-white/5"
                          >
                            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-3">{headline}</p>
                            <div className="flex gap-4">
                              {rec.book_cover ? (
                                <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                  <img src={rec.book_cover} alt={rec.book_title} className="h-full w-full object-cover" />
                                </div>
                              ) : (
                                <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-2xl">
                                  📚
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-white line-clamp-2">{rec.book_title}</p>
                                {rec.book_author && (
                                  <p className="text-xs text-white/60 mt-1 line-clamp-1">{rec.book_author}</p>
                                )}
                                {rec.note && (
                                  <p className="text-xs text-white/50 mt-2 line-clamp-2 italic">"{rec.note}"</p>
                                )}
                                <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mt-2">
                                  {formatTimeAgo(rec.created_at)}
                                </p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/60">No recommendations yet.</p>
                )}
              </div>
            </section>
          </>
        )}

        {successModal.show && (
          <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 backdrop-blur-sm sm:items-center p-0 sm:p-4">
            <div className="w-full h-full sm:h-auto sm:w-[clamp(280px,90vw,400px)] rounded-none sm:rounded-3xl border border-white/15 bg-gradient-to-b from-[#0b1225]/95 to-[#050914]/95 p-6 sm:p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-auto pt-[env(safe-area-inset-top)]">
              <img
                src="/bookmosh-logo-new.png"
                alt="BookMosh"
                className="mx-auto h-20 w-auto mb-6"
              />
              <div className="space-y-2">
                <p className="text-2xl font-semibold text-white">
                  {successModal.alreadyAdded ? '📚 Already Added!' : '✨ Success!'}
                </p>
                {!successModal.alreadyAdded && (
                  <>
                    {successModal.book ? (
                      <>
                        <p className="text-sm text-white/80">
                          <span className="font-semibold">{successModal.book.title}</span>
                        </p>
                        <p className="text-xs uppercase tracking-[0.3em] text-aurora">
                          Added to {successModal.list}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-white/80">
                        {successModal.list}
                      </p>
                    )}
                  </>
                )}
                {successModal.alreadyAdded && (
                  <p className="text-sm text-white/60">
                    This book is already in your library
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!currentUser && (
          <section className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg -mt-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-white/50">Welcome</p>
                <h2 className="text-2xl font-semibold text-white">{authMode === 'login' ? 'Sign in' : 'Create account'}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAuthModeSwitch('login')}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                    authMode === 'login'
                      ? 'border-white/60 bg-white/10 text-white'
                      : 'border-white/10 text-white/60 hover:border-white/40'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => handleAuthModeSwitch('signup')}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                    authMode === 'signup'
                      ? 'border-white/60 bg-white/10 text-white'
                      : 'border-white/10 text-white/60 hover:border-white/40'
                  }`}
                >
                  Sign up
                </button>
              </div>
            </div>

            {authMode === 'login' ? (
              <div className="mt-6 space-y-3">
                <input
                  type="text"
                  value={authIdentifier}
                  onChange={(e) => setAuthIdentifier(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleLogin()
                    }
                  }}
                  placeholder="Email or username"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleLogin()
                    }
                  }}
                  placeholder="Password"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAuthModeSwitch('forgot')}
                  className="text-left text-xs uppercase tracking-[0.3em] text-white/60 transition hover:text-white"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={authLoading}
                  className="w-full rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80 disabled:opacity-60"
                >
                  {authLoading ? 'Signing in…' : 'Sign in'}
                </button>
                <p className="text-sm text-rose-200 min-h-[1.25rem]">{authMessage}</p>
              </div>
            ) : authMode === 'signup' ? (
              <div className="mt-6 space-y-3">
                <input
                  type="text"
                  value={signupData.username}
                  onChange={(e) => setSignupData((prev) => ({ ...prev, username: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSignup()
                    }
                  }}
                  placeholder="Username"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
                <input
                  type="email"
                  value={signupData.email}
                  onChange={(e) => setSignupData((prev) => ({ ...prev, email: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSignup()
                    }
                  }}
                  placeholder="Email"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
                <input
                  type="password"
                  value={signupData.password}
                  onChange={(e) => setSignupData((prev) => ({ ...prev, password: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSignup()
                    }
                  }}
                  placeholder="Password"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSignup}
                  disabled={authLoading}
                  className="w-full rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80 disabled:opacity-60"
                >
                  {authLoading ? 'Creating…' : 'Create account'}
                </button>
                <p className="text-sm text-rose-200 min-h-[1.25rem]">{authMessage}</p>
              </div>
            ) : authMode === 'forgot' ? (
              <div className="mt-6 space-y-3">
                <input
                  type="email"
                  value={authIdentifier}
                  onChange={(e) => setAuthIdentifier(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={authLoading}
                  className="w-full rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80 disabled:opacity-60"
                >
                  {authLoading ? 'Sending…' : 'Send reset link'}
                </button>
                <button
                  type="button"
                  onClick={() => handleAuthModeSwitch('login')}
                  className="text-left text-xs uppercase tracking-[0.3em] text-white/60 transition hover:text-white"
                >
                  ← Back to login
                </button>
                <p className="text-sm text-rose-200 min-h-[1.25rem]">{authMessage}</p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
                <input
                  type="password"
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={authLoading}
                  className="w-full rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80 disabled:opacity-60"
                >
                  {authLoading ? 'Updating…' : 'Update password'}
                </button>
                <p className="text-sm text-rose-200 min-h-[1.25rem]">{authMessage}</p>
              </div>
            )}
          </section>
        )}

        {currentUser && isMoshInviteOpen && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeMoshInvite()
              }
            }}
          >
            <div className="w-full h-full sm:h-auto sm:w-[clamp(320px,80vw,620px)] rounded-none sm:rounded-3xl border border-white/15 bg-[#0b1225]/95 p-4 sm:p-6 flex flex-col pt-[env(safe-area-inset-top)]">
              <div className="sticky top-0 z-10 -mx-4 sm:mx-0 px-4 sm:px-0 pb-3 bg-[#0b1225]/95 backdrop-blur">
                <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">Start a pit</p>
                  <h2 className="text-xl font-semibold text-white">Invite a friend</h2>
                </div>
                <button
                  type="button"
                  onClick={closeMoshInvite}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                >
                  Close
                </button>
                </div>
              </div>

              <div className="mt-5 flex-1 overflow-auto space-y-5">
                <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                <div className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  {moshInviteBook?.cover ? (
                    <img src={moshInviteBook.cover} alt={moshInviteBook.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">Cover</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white line-clamp-2">{moshInviteBook?.title ?? 'Book'}</p>
                  <p className="text-sm text-white/60 line-clamp-1">{moshInviteBook?.author ?? 'Unknown author'}</p>
                </div>
                </div>

                <div className="space-y-3">
                <label className="block text-xs uppercase tracking-[0.3em] text-white/50">Mosh Title (Optional)</label>
                <input
                  type="text"
                  value={moshInviteTitle}
                  onChange={(e) => setMoshInviteTitle(e.target.value)}
                  placeholder={moshInviteBook?.title || "Custom mosh title..."}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                />
                </div>

                <div className="space-y-3">
                <label className="block text-xs uppercase tracking-[0.3em] text-white/50">Visibility</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMoshInviteIsPublic(true)}
                    className={`flex-1 rounded-2xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                      moshInviteIsPublic
                        ? 'border-white/60 bg-white/10 text-white'
                        : 'border-white/20 text-white/70 hover:border-white/60'
                    }`}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoshInviteIsPublic(false)}
                    className={`flex-1 rounded-2xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                      !moshInviteIsPublic
                        ? 'border-white/60 bg-white/10 text-white'
                        : 'border-white/20 text-white/70 hover:border-white/60'
                    }`}
                  >
                    Private
                  </button>
                </div>
                <p className="text-[10px] text-white/50">
                  {moshInviteIsPublic
                    ? 'Public moshes can be discovered from the book page.'
                    : 'Private moshes are hidden and only visible to participants.'}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <label className="block text-xs uppercase tracking-[0.3em] text-white/50">Invite Friends</label>
                
                {/* Selected friends tiles */}
                {moshInviteFriends.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {moshInviteFriends.map((friend) => (
                      <div key={friend} className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1">
                        <span className="text-sm text-white">{friend}</span>
                        <button
                          type="button"
                          onClick={() => removeMoshInviteFriend(friend)}
                          className="text-white/60 hover:text-white transition"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <input
                  type="text"
                  value={moshInviteSearch}
                  onChange={(e) => setMoshInviteSearch(e.target.value)}
                  placeholder="Type to search friends..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                />

                {/* Available friends list */}
                <div className="max-h-40 space-y-2 overflow-auto rounded-2xl border border-white/10 bg-[#050914]/60 p-3">
                  {(Array.isArray(currentUser?.friends) ? currentUser.friends : [])
                    .filter(f => 
                      f.toLowerCase().includes(moshInviteSearch.toLowerCase()) && 
                      !moshInviteFriends.includes(f)
                    )
                    .map((friend) => (
                      <button
                        key={friend}
                        type="button"
                        onClick={() => addMoshInviteFriend(friend)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:border-white/30 hover:bg-white/10"
                      >
                        {friend}
                      </button>
                    ))}
                  {(Array.isArray(currentUser?.friends) ? currentUser.friends : [])
                    .filter(f => 
                      f.toLowerCase().includes(moshInviteSearch.toLowerCase()) && 
                      !moshInviteFriends.includes(f)
                    ).length === 0 && (
                    <p className="text-sm text-white/60">{moshInviteSearch ? 'No matching friends' : 'No friends yet'}</p>
                  )}
                </div>

                <p className="text-sm text-rose-200 min-h-[1.25rem]">{moshInviteError}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeMoshInvite}
                  className="rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmMoshInvite}
                  disabled={moshInviteLoading}
                  className="rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80 disabled:opacity-60"
                >
                  {moshInviteLoading ? 'Starting…' : 'Start pit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Pit Modal */}
        {showCreatePitModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0b1225] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Create New Pit</h2>
                <button type="button" onClick={closeCreatePitModal} className="text-white/50 hover:text-white text-xl">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Pit Name</label>
                  <input
                    type="text"
                    value={newPitName}
                    onChange={(e) => setNewPitName(e.target.value)}
                    placeholder="Enter pit name..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Add Members</label>
                  <input
                    type="text"
                    value={newPitMemberQuery}
                    onChange={(e) => setNewPitMemberQuery(e.target.value)}
                    placeholder="Search friends..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none mb-2"
                  />

                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {(currentUser?.friends || [])
                      .filter((u) => !newPitMemberQuery.trim() || u.toLowerCase().includes(newPitMemberQuery.toLowerCase()))
                      .filter((u) => !newPitMembers.some((m) => m.username === u))
                      .map((friendUsername) => (
                        <button
                          key={friendUsername}
                          type="button"
                          onClick={() => addNewPitMemberByUsername(friendUsername)}
                          className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left hover:border-white/30"
                        >
                          <span className="text-white">@{friendUsername}</span>
                          <span className="text-xs text-blue-400">+ Add</span>
                        </button>
                      ))}
                    {(currentUser?.friends || []).length === 0 && (
                      <p className="text-sm text-white/50 text-center py-4">No friends yet. Add friends first!</p>
                    )}
                  </div>
                </div>

                {newPitMembers.length > 0 && (
                  <div>
                    <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Members to add ({newPitMembers.length})</label>
                    <div className="flex flex-wrap gap-2">
                      {newPitMembers.map((m) => (
                        <span key={m.id} className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-sm text-white">
                          @{m.username}
                          <button type="button" onClick={() => removeNewPitMember(m.id)} className="text-red-400 hover:text-red-300">✕</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={createNewPit}
                  disabled={creatingPit || !newPitName.trim() || newPitMembers.length === 0}
                  className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingPit ? 'Creating...' : 'Create Pit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {currentUser && isMoshPanelOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
            <div className="absolute inset-0 bg-[#0b1225]/95 overflow-hidden pt-[env(safe-area-inset-top)]">
              <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1225]/95 backdrop-blur">
                <div className="mx-auto w-full max-w-5xl px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.4em] text-white/40">Pit</p>
                      <h2 className="text-xl font-semibold text-white break-words">{activeMosh?.title || activeMosh?.mosh_title || 'Your Pits'}</h2>
                      {activeMosh?.id && (
                        <p className="text-xs text-white/50 break-words">{activeMosh.participants_usernames?.length || 0} members</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {activeMosh?.id && (
                        <>
                          <button
                            type="button"
                            onClick={loadSharedBooksInPit}
                            className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                          >
                            📖 Books
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof window === 'undefined') return
                              const url = window.location.href
                              if (navigator?.clipboard?.writeText) {
                                navigator.clipboard.writeText(url)
                              }
                            }}
                            className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                          >
                            Copy link
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={closeMoshPanel}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shared Books Modal */}
              {showSharedBooksInPit && (
                <div className="absolute inset-0 z-20 bg-[#0b1225]/98 overflow-auto">
                  <div className="mx-auto w-full max-w-2xl px-4 py-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-white">Shared Books</h3>
                      <button
                        type="button"
                        onClick={closeSharedBooksInPit}
                        className="text-white/50 hover:text-white text-xl"
                      >
                        ✕
                      </button>
                    </div>
                    {sharedBooksInPit.length > 0 ? (
                      <div className="space-y-3">
                        {sharedBooksInPit.map((book, idx) => (
                          <button
                            key={`${book.book_id || book.title}-${idx}`}
                            type="button"
                            onClick={() => {
                              closeSharedBooksInPit()
                              closeMoshPanel()
                              if (book.book_id) {
                                openModal(book)
                              }
                            }}
                            className="w-full flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30"
                          >
                            {book.cover ? (
                              <img src={book.cover} alt={book.title} className="w-12 h-18 rounded-lg object-cover" />
                            ) : (
                              <div className="w-12 h-18 rounded-lg bg-white/10 flex items-center justify-center text-xl">📚</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-semibold line-clamp-2">{book.title}</p>
                              <p className="text-white/60 text-sm">{book.author}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-white/50 text-center py-12">No books have been shared in this pit yet.</p>
                    )}
                  </div>
                </div>
              )}

              {!activeMosh ? (
                <div className="mx-auto w-full max-w-5xl px-4 py-6 overflow-auto h-[calc(100vh-80px)]">
                  <div className="flex gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMoshArchiveFilter('open')
                        fetchActiveMoshes()
                      }}
                      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                        moshArchiveFilter === 'open'
                          ? 'bg-white/10 border border-white/40 text-white'
                          : 'border border-white/10 text-white/60 hover:border-white/30'
                      }`}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMoshArchiveFilter('archived')
                        fetchActiveMoshes()
                      }}
                      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                        moshArchiveFilter === 'archived'
                          ? 'bg-white/10 border border-white/40 text-white'
                          : 'border border-white/10 text-white/60 hover:border-white/30'
                      }`}
                    >
                      Archived
                    </button>
                  </div>
                  
                  <div className="rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">Start a pit from your library</p>
                    <input
                      type="text"
                      value={moshLibrarySearch}
                      onChange={(e) => setMoshLibrarySearch(e.target.value)}
                      placeholder="Search your library..."
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none"
                    />
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {moshLibraryMatches.map((book) => (
                        <button
                          key={`${book.title}-${book.author}`}
                          type="button"
                          onClick={() => startMosh(book.title)}
                          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/40"
                        >
                          <div className="h-14 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex-shrink-0">
                            {book.cover ? (
                              <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">Cover</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white line-clamp-1">{book.title}</p>
                            <p className="text-xs text-white/60 line-clamp-1">{book.author}</p>
                          </div>
                        </button>
                      ))}
                      {moshLibraryMatches.length === 0 && (
                        <p className="text-sm text-white/60">No matches.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeMoshes.map((mosh) => (
                      <button
                        key={mosh.id}
                        type="button"
                        onClick={() => openMosh(mosh)}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#050914]/60 p-4 text-left transition hover:border-white/40"
                      >
                        <div className="h-16 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex-shrink-0">
                          {mosh.book_cover ? (
                            <img src={mosh.book_cover} alt={mosh.book_title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">Cover</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white line-clamp-1">{mosh.mosh_title || mosh.book_title}</p>
                          <p className="text-xs text-white/60 line-clamp-1">{mosh.book_author ?? 'Book chat'}</p>
                          <p className="text-xs text-white/40 line-clamp-1">with {(mosh.participants_usernames || []).filter(u => u !== currentUser?.username).join(', ')}</p>
                        </div>
                        {(unreadByMoshId[mosh.id] ?? 0) > 0 && (
                          <span className="rounded-full bg-rose-500/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                            {unreadByMoshId[mosh.id]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-5xl px-4 py-6 h-[calc(100vh-80px)] overflow-hidden">
                  <div className="grid gap-4 lg:grid-cols-[2fr_1fr] h-full overflow-hidden">
                    <div className="rounded-2xl border border-white/10 bg-[#050914]/60 p-4 flex flex-col min-h-0 overflow-hidden">
                      <div className="flex-1 min-h-0 space-y-3 overflow-auto pr-2">
                        {activeMoshMessages.map((msg) => (
                          <div key={msg.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => viewFriendProfile(msg.sender_username)}
                                className="text-xs uppercase tracking-[0.3em] text-white/60 hover:text-white hover:underline transition text-left"
                              >
                                {msg.sender_username}
                              </button>
                              <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                                {formatMoshTimestamp(msg.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-white">{msg.body}</p>

                            <div className="mt-2 flex items-center gap-2">
                              {(() => {
                                const r = moshMessageReactions[msg.id] ?? { up: 0, down: 0, mine: null }
                                const upActive = r.mine === 'up'
                                const downActive = r.mine === 'down'
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => toggleMoshReaction(msg.id, 'up')}
                                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] transition ${
                                        upActive ? 'border-white/60 bg-white/10 text-white' : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white'
                                      }`}
                                      title="Like"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                                        <path d="M2 10c0-.552.448-1 1-1h3v9H3a1 1 0 0 1-1-1v-6ZM7 18V9.828a2 2 0 0 1 .586-1.414l5.172-5.172A1.5 1.5 0 0 1 15.34 4.5V8h2.16a1.5 1.5 0 0 1 1.477 1.77l-1.2 6A1.5 1.5 0 0 1 16.306 17H9a2 2 0 0 1-2-2Z" />
                                      </svg>
                                      {r.up}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleMoshReaction(msg.id, 'down')}
                                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] transition ${
                                        downActive ? 'border-white/60 bg-white/10 text-white' : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white'
                                      }`}
                                      title="Dislike"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                                        <path d="M18 10c0 .552-.448 1-1 1h-3V2h3a1 1 0 0 1 1 1v7ZM13 2v8.172a2 2 0 0 1-.586 1.414l-5.172 5.172A1.5 1.5 0 0 1 4.66 15.5V12H2.5A1.5 1.5 0 0 1 1.023 10.23l1.2-6A1.5 1.5 0 0 1 3.694 3H11a2 2 0 0 1 2 2Z" />
                                      </svg>
                                      {r.down}
                                    </button>
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        ))}
                        {activeMoshMessages.length === 0 && (
                          <p className="text-sm text-white/60">No messages yet.</p>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      <div className="mt-4 relative">
                        {showMentionDropdown && (
                          <div className="absolute bottom-full left-0 mb-2 w-64 rounded-2xl border border-white/10 bg-[#0b1225]/95 p-2 shadow-lg">
                            {(activeMosh?.participants_usernames || [])
                              .filter((u) => u.toLowerCase().includes(moshMentionQuery))
                              .map((username) => (
                                <button
                                  key={username}
                                  type="button"
                                  onClick={() => insertMention(username)}
                                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-white transition hover:bg-white/10"
                                >
                                  @{username}
                                </button>
                              ))}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <input
                            value={moshDraft}
                            onChange={(e) => handleMoshDraftChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                if (showMentionDropdown) {
                                  const matches = (activeMosh?.participants_usernames || []).filter((u) =>
                                    u.toLowerCase().includes(moshMentionQuery),
                                  )
                                  if (matches.length > 0) {
                                    insertMention(matches[0])
                                  }
                                } else {
                                  sendMoshMessage()
                                }
                              }
                            }}
                            placeholder="Type a message… (use @ to mention)"
                            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={sendMoshMessage}
                            className="rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#050914]/60 p-4 overflow-auto">
                      <button
                        type="button"
                        onClick={backToMoshes}
                        className="w-full rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40"
                      >
                        ← Back to moshes
                      </button>
                     
                     {/* Participants */}
                     <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                       <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Participants</p>
                       <div className="space-y-2">
                         {(activeMosh?.participants_usernames || []).map((username) => (
                          <div key={username} className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-400"></div>
                            <button
                              type="button"
                              onClick={() => viewFriendProfile(username)}
                              className="text-sm text-white hover:text-white/80 hover:underline transition text-left"
                            >
                              {username}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={openMoshAddFriends}
                      className="w-full rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40"
                    >
                      Add friends
                    </button>

                    <button
                      type="button"
                      onClick={toggleActiveMoshVisibility}
                      className="w-full rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40"
                    >
                      {(activeMosh?.is_public ?? true) ? 'Make Private' : 'Make Public'}
                    </button>

                    <button
                      type="button"
                      onClick={openMoshCoverPicker}
                      className="w-full rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40"
                    >
                      Change cover
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => archiveMosh(activeMosh.id)}
                      className="w-full rounded-full border border-amber-500/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-400 transition hover:border-amber-500 hover:bg-amber-500/10"
                    >
                      Archive Mosh
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => fetchActiveMoshes()}
                      className="w-full rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
              )}
            </div>
          </div>
        )}

        {selectedBook && !isBookPage && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
            <div className="absolute inset-0 bg-[#0b1225]/95 overflow-auto pt-[env(safe-area-inset-top)]">
              <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1225]/95 backdrop-blur">
                <div className="mx-auto w-full max-w-3xl px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.4em] text-white/40">Book Details</p>
                      <h2 className="text-xl font-semibold text-white break-words">{selectedBook.title}</h2>
                      <p className="text-sm text-white/60 break-words">{selectedBook.author}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete this book?')) {
                            handleDeleteBook(selectedBook.title)
                            closeModal()
                          }
                        }}
                        className="rounded-full border border-rose-500/30 p-2 text-rose-400 transition hover:border-rose-500/60 hover:bg-rose-500/10"
                        title="Delete book"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window === 'undefined') return
                          const url = window.location.href
                          if (navigator?.clipboard?.writeText) {
                            navigator.clipboard.writeText(url)
                          }
                        }}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-3xl px-4 py-6">
                <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Activity</label>
                  {bookActivityLoading ? (
                    <p className="text-sm text-white/60">Loading activity…</p>
                  ) : bookActivityFeed.length > 0 ? (
                    <div className="space-y-2">
                      {bookActivityFeed.map((item) => (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openReviewThreadForEvent(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openReviewThreadForEvent(item)
                            }
                          }}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/30 cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-white/80">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  viewFriendProfile(item.owner_username)
                                }}
                                className="font-semibold text-white hover:text-aurora hover:underline transition"
                              >
                                {item.owner_username}
                              </button>
                              <span className="text-white/60">
                                {item.event_type === 'created' ? ' added this book' : 
                                 item.event_type === 'tags_updated' ? ' updated tags' :
                                 item.event_type === 'status_changed' ? ' changed status' :
                                 ' updated this book'}
                              </span>
                              {item.tags && item.tags.length > 0 && (
                                <span className="text-white/60"> to </span>
                              )}
                              {item.tags && item.tags.map((tag, idx) => (
                                <span key={idx}>
                                  <span className="font-semibold text-white">{tag}</span>
                                  {idx < item.tags.length - 1 && <span className="text-white/60">, </span>}
                                </span>
                              ))}
                            </p>
                            <span className="text-[10px] text-white/40 whitespace-nowrap">{formatTimeAgo(item.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/60">No activity yet for this book.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Moshes</label>
                  {publicMoshesForBookLoading ? (
                    <p className="text-sm text-white/60">Loading public moshes…</p>
                  ) : (
                    <>
                      <p className="text-sm text-white/60">{publicMoshesForBook.length} public moshes</p>
                      {publicMoshesForBook.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Popular public</p>
                          {publicMoshesForBook.slice(0, 3).map((mosh) => (
                            <div key={mosh.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white line-clamp-1">{mosh.mosh_title || mosh.book_title}</p>
                                <p className="text-xs text-white/50">by {mosh.created_by_username || 'reader'}</p>
                              </div>
                              <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                                {(mosh.participants_usernames?.length ?? 0)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Description</label>
                  {modalDescriptionLoading ? (
                    <p className="text-sm text-white/60">Loading description…</p>
                  ) : modalDescription ? (
                    <p className="text-sm text-white/70 whitespace-pre-wrap">{modalDescription}</p>
                  ) : (
                    <p className="text-sm text-white/60">No description found.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Cover</label>
                  <div className="flex items-center gap-3">
                    <div className="h-24 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex-shrink-0">
                      {selectedBook.cover ? (
                        <img src={selectedBook.cover} alt={selectedBook.title} className="h-full w-full object-cover" />
                      ) : selectedBook.isbn ? (
                        <img
                          src={openLibraryIsbnCoverUrl(selectedBook.isbn, 'M')}
                          alt={selectedBook.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">None</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setShowEditionPicker(true)
                        await loadEditionsForSelectedBook()
                      }}
                      className="rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                    >
                      Choose Edition
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setShowCoverPicker(true)
                        await loadEditionCoversForSelectedBook()
                      }}
                      className="rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                    >
                      Choose Cover
                    </button>
                    {showCoverPicker && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCoverPicker(false)
                          setCoverPickerCovers([])
                        }}
                        className="rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                      >
                        Done
                      </button>
                    )}
                    {showEditionPicker && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditionPicker(false)
                          setEditionPickerEditions([])
                        }}
                        className="rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                      >
                        Done
                      </button>
                    )}
                  </div>

                  {showEditionPicker && (
                    <div className="mt-4">
                      {editionPickerLoading ? (
                        <p className="text-sm text-white/60">Loading editions…</p>
                      ) : editionPickerEditions.length > 0 ? (
                        <div className="max-h-64 overflow-auto rounded-2xl border border-white/10 bg-white/5">
                          <div className="divide-y divide-white/10">
                            {editionPickerEditions.map((e) => (
                              (() => {
                                const coverKey = `edition:${e.source}:${e.isbn}`
                                const isBroken = brokenCoverKeysRef.current.has(coverKey)
                                // eslint-disable-next-line no-unused-expressions
                                brokenCoverKeysVersion
                                return (
                              <button
                                key={`${e.source}:${e.isbn}`}
                                type="button"
                                onClick={() => {
                                  const nextCover = e.coverUrl || selectedBook.cover || null
                                  const nextTitle = e.title || selectedBook.title
                                  // Update the book in library with new title, ISBN, and cover
                                  updateBook(selectedBook.title, {
                                    title: nextTitle,
                                    isbn: e.isbn,
                                    cover: nextCover,
                                    olKey: selectedBook.olKey ?? null,
                                  })
                                  setSelectedBook({ ...selectedBook, title: nextTitle, isbn: e.isbn, cover: nextCover, olKey: selectedBook.olKey ?? null })
                                  setShowEditionPicker(false)
                                  setEditionPickerEditions([])
                                }}
                                className="w-full px-4 py-3 text-left transition hover:bg-white/5"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="h-16 w-11 overflow-hidden rounded-lg border border-white/10 bg-white/5 flex-shrink-0">
                                    {e.coverUrl && !isBroken ? (
                                      <img src={e.coverUrl} alt="Edition cover" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/50">No cover</div>
                                    )}
                                    {e.coverUrl && !isBroken && (
                                      <img
                                        src={e.coverUrl}
                                        alt=""
                                        className="hidden"
                                        onError={() => markCoverBroken(coverKey)}
                                      />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">{e.source} {e.isEnglish && '🇬🇧'}</p>
                                    <p className="text-sm font-semibold text-white break-words">{e.title}</p>
                                    {e.author && <p className="text-xs text-white/70">{e.author}</p>}
                                    <p className="text-xs text-white/60">
                                      ISBN {e.isbn}
                                    </p>
                                    <p className="text-xs text-white/50">
                                      {[e.publisher, e.publishDate, e.language].filter(Boolean).join(' • ') || '—'}
                                    </p>
                                  </div>
                                </div>
                              </button>
                                )
                              })()
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-white/60">No editions found.</p>
                      )}
                    </div>
                  )}

                  {showCoverPicker && (
                    <div className="mt-4">
                      {coverPickerLoading ? (
                        <p className="text-sm text-white/60">Loading edition covers…</p>
                      ) : coverPickerCovers.length > 0 ? (
                        <div className="max-h-64 overflow-auto rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                            {coverPickerCovers.map((c) => (
                              (() => {
                                const coverKey = `cover:${c.key || `${c.coverId}-${c.editionKey ?? ''}`}`
                                const isBroken = brokenCoverKeysRef.current.has(coverKey)
                                // eslint-disable-next-line no-unused-expressions
                                brokenCoverKeysVersion
                                if (isBroken) return null
                                return (
                              <button
                                key={c.key || `${c.coverId}-${c.editionKey ?? ''}`}
                                type="button"
                                onClick={() => {
                                  updateBook(selectedBook.title, { cover: c.urlM, isbn: c.isbn ?? selectedBook.isbn, olKey: selectedBook.olKey ?? null })
                                  setSelectedBook({ ...selectedBook, cover: c.urlM, isbn: c.isbn ?? selectedBook.isbn, olKey: selectedBook.olKey ?? null })
                                  setShowCoverPicker(false)
                                  setCoverPickerCovers([])
                                }}
                                className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-white/40"
                              >
                                <img
                                  src={c.urlM}
                                  alt="Edition cover"
                                  className="h-full w-full object-cover"
                                  onError={() => markCoverBroken(coverKey)}
                                />
                              </button>
                                )
                              })()
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-white/60">No edition covers found for this book.</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Status</label>
                  <div className="flex items-center gap-3">
                    <select
                      value={modalStatus}
                      onChange={(e) => setModalStatus(e.target.value)}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-white/40 focus:outline-none"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => toggleBookOwned(selectedBook.title)}
                      className={`rounded-2xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                        (selectedBook.tags ?? []).includes('Owned')
                          ? 'border-[#ee6bfe]/60 bg-[#ee6bfe]/20 text-[#ee6bfe]'
                          : 'border-white/20 text-white/60 hover:border-[#ee6bfe]/40 hover:text-[#ee6bfe]'
                      }`}
                    >
                      {(selectedBook.tags ?? []).includes('Owned') ? '✓ Owned' : 'Owned'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Actions</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        openMoshInvite(selectedBook)
                      }}
                      className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:bg-white/5"
                    >
                      Start Pit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openRecommendBook(selectedBook)
                      }}
                      className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:bg-white/5"
                    >
                      Recommend
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Progress: {modalProgress}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={modalProgress}
                    onChange={(e) => setModalProgress(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Rating</label>
                  <div 
                    className="flex gap-1 items-center select-none"
                    onPointerLeave={() => {
                      if (draggingRating === 'modal') {
                        setDraggingRating(null)
                        commitModalRating()
                      }
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        pendingModalRatingRef.current = 0
                        setModalRating(0)
                        commitModalRating()
                      }}
                      className="mr-2 text-sm text-white/30 hover:text-white/60 transition"
                    >
                      ✕
                    </button>
                    <div
                      ref={modalStarsRef}
                      className="flex gap-1 items-center touch-none"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDraggingRating('modal')
                        const rect = modalStarsRef.current?.getBoundingClientRect()
                        const next = calculateRatingFromClientX(e.clientX, rect)
                        setModalRatingValue(next)
                        if (typeof e.currentTarget?.setPointerCapture === 'function') {
                          e.currentTarget.setPointerCapture(e.pointerId)
                        }
                      }}
                      onPointerMove={(e) => {
                        if (draggingRating !== 'modal') return
                        const rect = modalStarsRef.current?.getBoundingClientRect()
                        const next = calculateRatingFromClientX(e.clientX, rect)
                        setModalRatingValueThrottled(next)
                      }}
                      onPointerUp={(e) => {
                        if (draggingRating !== 'modal') return
                        e.preventDefault()
                        e.stopPropagation()
                        setDraggingRating(null)
                        if (typeof e.currentTarget?.releasePointerCapture === 'function') {
                          try {
                            e.currentTarget.releasePointerCapture(e.pointerId)
                          } catch {}
                        }
                        commitModalRating()
                      }}
                      onPointerCancel={() => {
                        if (draggingRating !== 'modal') return
                        setDraggingRating(null)
                        commitModalRating()
                      }}
                    >
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isFull = modalRating >= star
                        const isHalf = !isFull && modalRating >= star - 0.5
                        return (
                          <div key={star} className="relative w-8 h-8 flex items-center justify-center">
                            <StarSvg
                              fraction={isFull ? 1 : isHalf ? 0.5 : 0}
                              className="w-8 h-8 pointer-events-none"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Review</label>
                  <div className="mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modalSpoilerWarning}
                        onChange={(e) => setModalSpoilerWarning(e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-white/5 text-rose-500 focus:ring-rose-500 focus:ring-offset-0"
                      />
                      <span className="text-xs text-white/70">⚠️ Contains spoilers</span>
                    </label>
                  </div>
                  <textarea
                    value={modalReview}
                    onChange={(e) => setModalReview(e.target.value)}
                    placeholder="Write your review..."
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    rows="5"
                  />
                </div>

                {!showFindMatch ? (
                  <div className="space-y-2 pt-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRecommendBookData(selectedBook)
                          setRecommendNote('')
                          setRecommendRecipients([])
                          setRecommendFriendSearch('')
                          setIsRecommendBookOpen(true)
                        }}
                        className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                      >
                        Recommend
                      </button>
                      {!selectedBook.cover && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowFindMatch(true)
                            setFindMatchQuery(`${selectedBook.title} ${selectedBook.author}`)
                          }}
                          className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                        >
                          Find Match
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleModalSave}
                        className="flex-1 rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Search Open Library</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={findMatchQuery}
                          onChange={(e) => setFindMatchQuery(e.target.value)}
                          placeholder="Search for book..."
                          className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!findMatchQuery.trim()) return
                            setFindMatchLoading(true)
                            try {
                              const response = await fetch(
                                `https://openlibrary.org/search.json?q=${encodeURIComponent(findMatchQuery)}&limit=5&fields=key,title,author_name,cover_i,isbn`
                              )
                              const data = await response.json()
                              setFindMatchResults(data.docs || [])
                            } catch (error) {
                              console.error('Search failed:', error)
                            } finally {
                              setFindMatchLoading(false)
                            }
                          }}
                          className="rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                        >
                          Search
                        </button>
                      </div>
                    </div>
                    
                    {findMatchLoading && <p className="text-sm text-white/60">Searching...</p>}
                    
                    {findMatchResults.length > 0 && (
                      <div className="max-h-60 space-y-2 overflow-auto">
                        {findMatchResults.map((result) => (
                          <button
                            key={result.key}
                            type="button"
                            onClick={() => {
                              const cover = result.cover_i ? `https://covers.openlibrary.org/b/id/${result.cover_i}-M.jpg` : null
                              const isbn = result.isbn?.[0] || null
                              updateBook(selectedBook.title, { cover, isbn, olKey: result.key })
                              setSelectedBook({ ...selectedBook, cover, isbn, olKey: result.key })
                              setShowFindMatch(false)
                              setFindMatchResults([])
                            }}
                            className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/40"
                          >
                            <div className="h-16 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex-shrink-0">
                              {result.cover_i ? (
                                <img src={`https://covers.openlibrary.org/b/id/${result.cover_i}-S.jpg`} alt={result.title} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">No Cover</div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white line-clamp-1">{result.title}</p>
                              <p className="text-xs text-white/60 line-clamp-1">{result.author_name?.[0] || 'Unknown'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => {
                        setShowFindMatch(false)
                        setFindMatchResults([])
                      }}
                      className="w-full rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendation Detail Modal */}
        {selectedRecommendation && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
            <div className="absolute inset-0 bg-[#0b1225]/95 overflow-auto pt-[env(safe-area-inset-top)]">
              <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1225]/95 backdrop-blur">
                <div className="mx-auto w-full max-w-3xl px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.4em] text-white/40">Recommendation</p>
                      <h2 className="text-xl font-semibold text-white break-words">{selectedRecommendation.book_title}</h2>
                      <p className="text-sm text-white/60 break-words">{selectedRecommendation.book_author || 'Unknown author'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentUser?.id === selectedRecommendation.sender_id && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Delete this recommendation?')) return
                            try {
                              const { error } = await supabase
                                .from('recommendations')
                                .delete()
                                .eq('id', selectedRecommendation.id)
                              if (error) throw error
                              setSelectedRecommendation(null)
                              await fetchRecommendations()
                            } catch (error) {
                              console.error('Delete recommendation error:', error)
                              alert('Failed to delete recommendation')
                            }
                          }}
                          className="rounded-full border border-red-500/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-red-400 transition hover:border-red-500/60 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedRecommendation(null)}
                        className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-3xl px-4 py-6">
                <div className="space-y-6">
                  {/* Book Cover and Info */}
                  <div className="flex gap-6">
                    <div className="h-64 w-44 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                      {selectedRecommendation.book_cover ? (
                        <img src={selectedRecommendation.book_cover} alt={selectedRecommendation.book_title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-4xl">📚</div>
                      )}
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Recommended by</p>
                        <p className="text-lg font-semibold text-white">@{selectedRecommendation.sender_username}</p>
                        <p className="text-xs text-white/40 mt-1">{formatTimeAgo(selectedRecommendation.created_at)}</p>
                      </div>
                      {selectedRecommendation.note && (
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Note</p>
                          <p className="text-sm text-white/70 italic">"{selectedRecommendation.note}"</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add to Library Section */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h3 className="text-sm uppercase tracking-[0.4em] text-white/50 mb-4">Add to Library</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Status</label>
                        <div className="flex gap-2">
                          {statusOptions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                const bookExists = tracker.find(b => 
                                  b.title.toLowerCase() === selectedRecommendation.book_title.toLowerCase() &&
                                  b.author.toLowerCase() === (selectedRecommendation.book_author || '').toLowerCase()
                                )
                                if (bookExists) {
                                  updateBook(bookExists.title, { status: s, tags: [s, ...(bookExists.tags.includes('Owned') ? ['Owned'] : [])] })
                                  setSuccessModal({ show: true, book: bookExists, list: s, alreadyAdded: false })
                                  setTimeout(() => setSuccessModal({ show: false, book: null, list: '' }), 2000)
                                } else {
                                  const newBook = {
                                    title: selectedRecommendation.book_title,
                                    author: selectedRecommendation.book_author || 'Unknown author',
                                    cover: selectedRecommendation.book_cover,
                                    status: s,
                                    tags: [s],
                                    progress: s === 'Read' ? 100 : 0,
                                    rating: 0,
                                    review: '',
                                    spoiler_warning: false,
                                    read_at: s === 'Read' ? new Date().toISOString() : null,
                                    status_updated_at: new Date().toISOString(),
                                  }
                                  addBook(newBook)
                                  setSuccessModal({ show: true, book: newBook, list: s, alreadyAdded: false })
                                  setTimeout(() => setSuccessModal({ show: false, book: null, list: '' }), 2000)
                                }
                              }}
                              className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:bg-white/5"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              const bookExists = tracker.find(b => 
                                b.title.toLowerCase() === selectedRecommendation.book_title.toLowerCase() &&
                                b.author.toLowerCase() === (selectedRecommendation.book_author || '').toLowerCase()
                              )
                              if (bookExists) {
                                const nextTags = e.target.checked 
                                  ? [...new Set([...bookExists.tags, 'Owned'])]
                                  : bookExists.tags.filter(t => t !== 'Owned')
                                updateBook(bookExists.title, { tags: nextTags })
                              }
                            }}
                            className="h-4 w-4 rounded border-white/20 bg-white/5 text-aurora focus:ring-aurora focus:ring-offset-0"
                          />
                          <span className="text-sm text-white/70">I own this book</span>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const bookExists = tracker.find(b => 
                            b.title.toLowerCase() === selectedRecommendation.book_title.toLowerCase() &&
                            b.author.toLowerCase() === (selectedRecommendation.book_author || '').toLowerCase()
                          )
                          if (bookExists) {
                            openModal(bookExists)
                            setSelectedRecommendation(null)
                          }
                        }}
                        className="w-full rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                      >
                        View Full Details
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm uppercase tracking-[0.4em] text-white/50">Comments</h3>
                      <button
                        type="button"
                        onClick={() => loadRecommendationComments(selectedRecommendation.id)}
                        className="rounded-full border border-white/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {recommendationCommentsLoading ? (
                        <p className="text-sm text-white/60">Loading comments…</p>
                      ) : recommendationComments.length > 0 ? (
                        recommendationComments.map((c) => (
                          <div key={c.id} className="rounded-2xl border border-white/10 bg-[#050914]/40 p-3">
                            <p className="text-sm text-white/80">
                              <span className="font-semibold text-white">@{c.commenter_username}</span>
                              <span className="text-white/60"> · {formatTimeAgo(c.created_at)}</span>
                            </p>
                            <p className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{c.body}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-white/60">No comments yet.</p>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <input
                        value={recommendationCommentDraft}
                        onChange={(e) => setRecommendationCommentDraft(e.target.value)}
                        placeholder="Write a comment…"
                        className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={postRecommendationComment}
                        disabled={!String(recommendationCommentDraft || '').trim()}
                        className="rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80 disabled:opacity-50"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recommend Book Modal */}
        {isRecommendBookOpen && recommendBookData && (
          <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm">
            <div className="absolute inset-0 bg-[#0b1225]/95 overflow-auto pt-[env(safe-area-inset-top)]">
              <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1225]/95 backdrop-blur">
                <div className="mx-auto w-full max-w-2xl px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.4em] text-white/40">Recommend Book</p>
                      <h2 className="text-xl font-semibold text-white break-words">{recommendBookData.title}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRecommendBookOpen(false)}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-2xl px-4 py-6">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h3 className="text-sm uppercase tracking-[0.4em] text-white/50 mb-4">Select Friends</h3>
                    <input
                      type="text"
                      value={recommendFriendSearch}
                      onChange={(e) => setRecommendFriendSearch(e.target.value)}
                      placeholder="Search friends..."
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none mb-3"
                    />
                    <div className="space-y-2 max-h-60 overflow-auto">
                      {(currentUser?.friends || [])
                        .filter((u) => !recommendFriendSearch.trim() || u.toLowerCase().includes(recommendFriendSearch.toLowerCase()))
                        .map((friendUsername) => {
                        const isSelected = recommendRecipients.some(r => (r.username || r) === friendUsername)
                        return (
                          <button
                            key={friendUsername}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setRecommendRecipients(prev => prev.filter(r => (r.username || r) !== friendUsername))
                              } else {
                                setRecommendRecipients(prev => [...prev, { username: friendUsername }])
                              }
                            }}
                            className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                              isSelected
                                ? 'border-aurora bg-aurora/10'
                                : 'border-white/10 bg-white/5 hover:border-white/30'
                            }`}
                          >
                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-aurora bg-aurora' : 'border-white/30'
                            }`}>
                              {isSelected && <span className="text-midnight text-xs font-bold">✓</span>}
                            </div>
                            <span className="text-sm font-semibold text-white">@{friendUsername}</span>
                          </button>
                        )
                      })}
                      {(!currentUser?.friends || currentUser.friends.length === 0) && (
                        <p className="text-sm text-white/60 text-center py-4">No friends yet. Add friends in the Community section.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h3 className="text-sm uppercase tracking-[0.4em] text-white/50 mb-4">Add a Note (Optional)</h3>
                    <textarea
                      value={recommendNote}
                      onChange={(e) => setRecommendNote(e.target.value)}
                      placeholder="Why do you recommend this book?"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                      rows="4"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={sendRecommendation}
                    disabled={recommendLoading || recommendRecipients.length === 0}
                    className="w-full rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {recommendLoading ? 'Sending...' : `Send to ${recommendRecipients.length} friend${recommendRecipients.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Friend Profile Page */}
        {selectedFriend && (
          <div className="min-h-screen bg-gradient-to-b from-[#0b1225] to-[#050914]">
            <div className="overflow-auto pt-[env(safe-area-inset-top)]">
              <div className="sticky top-0 z-10 border-b border-white/10 bg-gradient-to-b from-[#0b1225]/95 to-[#050914]/95 backdrop-blur">
                <div className="mx-auto w-full max-w-3xl px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/5 flex-shrink-0">
                        <img src={getProfileAvatarUrl(selectedFriend)} alt="Avatar" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.4em] text-white/40">Friend</p>
                        <h2 className="text-2xl font-semibold text-white break-words">{selectedFriend.username}</h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUnfriend(selectedFriend.username)}
                        className="rounded-full border border-rose-500/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-300 transition hover:border-rose-500 hover:bg-rose-500/10"
                      >
                        Unfriend
                      </button>
                      <button
                        type="button"
                        onClick={() => closeFriendProfile()}
                        className="rounded-full border border-white/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-3xl px-4 py-6">
                <div className="space-y-4">
                {(() => {
                  const topBooks = Array.isArray(selectedFriend.top_books) 
                    ? selectedFriend.top_books.filter(Boolean) 
                    : []
                  if (topBooks.length === 0) return null

                  return (
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-3">Top 4</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {topBooks.slice(0, 4).map((slotValue, idx) => {
                          const isCover = isCoverUrlValue(slotValue)
                          const title = isCover ? '' : String(slotValue ?? '').trim()
                          const book = title
                            ? (friendBooks || []).find((b) => normalizeTitleValue(b.title) === normalizeTitleValue(title))
                            : null
                          const cover = isCover ? String(slotValue) : (book?.cover ?? null)
                          return (
                            <div
                              key={`${idx}-${String(slotValue || 'empty')}`}
                              className="rounded-2xl border border-white/10 bg-white/5 p-2 flex flex-col"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (!slotValue) return
                                  const fallbackTitle = title || 'Top book'
                                  openModal(book ?? { title: fallbackTitle, author: 'Unknown author', cover })
                                }}
                                className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 aspect-[2/3]"
                              >
                                {slotValue ? (
                                  cover ? (
                                    <img src={cover} alt={title || 'Top book'} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">No cover</div>
                                  )
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-2xl text-white/50">+</div>
                                )}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-3">Lists</p>
                  {friendListsLoading ? (
                    <p className="text-sm text-white/60">Loading lists…</p>
                  ) : friendLists.length > 0 ? (
                    <div className="space-y-2">
                      {friendLists.map((l) => (
                        <div key={l.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <button
                            type="button"
                            onClick={async () => {
                              closeFriendProfile(true, true)
                              await openList(l)
                              setTimeout(() => scrollToSection('lists'), 100)
                            }}
                            className="w-full text-left"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white line-clamp-1">{l.title}</p>
                                {l.description && <p className="mt-1 text-xs text-white/50 line-clamp-2">{l.description}</p>}
                              </div>
                              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
                                  {l.item_count ?? 0}
                                </span>
                                <div className="flex items-center">
                                  {Array.from({ length: Math.min(4, (l.preview_covers ?? []).length || 0) }).map((_, idx) => {
                                    const cover = l.preview_covers[idx]
                                    return (
                                      <div
                                        key={`${l.id}-preview-${idx}`}
                                        className="h-10 w-7 overflow-hidden rounded-lg border border-white/10 bg-white/5"
                                        style={{ marginLeft: idx === 0 ? 0 : -10 }}
                                      >
                                        <img src={cover} alt="Cover" className="h-full w-full object-cover" />
                                      </div>
                                    )
                                  })}
                                  {(l.preview_covers ?? []).length === 0 && (
                                    <div className="h-10 w-7 overflow-hidden rounded-lg border border-white/10 bg-white/5" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/60">No public lists yet.</p>
                  )}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-3">Library</p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {[{ id: 'all', label: 'All' }, ...statusTags.map((s) => ({ id: s, label: s }))].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFriendBooksStatusFilter(opt.id)}
                        className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] transition ${
                          friendBooksStatusFilter === opt.id
                            ? 'border-white/60 bg-white/10 text-white'
                            : 'border-white/10 text-white/60 hover:border-white/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {friendBooksLoading && friendBooks.length === 0 ? (
                    <p className="text-sm text-white/60">Loading books…</p>
                  ) : (friendBooksStatusFilter === 'all'
                      ? friendBooks
                      : friendBooks.filter((b) => (b.status ?? '').toLowerCase() === friendBooksStatusFilter.toLowerCase())
                    ).length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {(friendBooksStatusFilter === 'all'
                        ? friendBooks
                        : friendBooks.filter((b) => (b.status ?? '').toLowerCase() === friendBooksStatusFilter.toLowerCase())
                      ).map((book, idx) => {
                        const bookPayload = {
                          title: book.title,
                          author: book.author,
                          cover: book.cover ?? null,
                          year: book.year ?? null,
                          isbn: book.isbn ?? null,
                          olKey: book.olKey ?? book.key ?? null,
                        }
                        return (
                        <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => openModal(bookPayload)}
                              className="flex-shrink-0 focus:outline-none"
                            >
                              {book.cover ? (
                                <img src={book.cover} alt={book.title} className="h-20 w-14 rounded-lg object-cover" />
                              ) : (
                                <div className="flex h-20 w-14 items-center justify-center rounded-lg bg-white/5 text-xs text-white/40">
                                  No cover
                                </div>
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => openModal(bookPayload)}
                                className="text-left focus:outline-none"
                              >
                                <p className="text-sm font-semibold text-white line-clamp-2 hover:underline">{book.title}</p>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  closeFriendProfile(true)
                                  scrollToDiscovery()
                                  openAuthorModal(book.author)
                                }}
                                className="text-left text-xs text-white/60 line-clamp-1 hover:text-white hover:underline transition"
                              >
                                {book.author}
                              </button>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="rounded-full bg-aurora/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-aurora">
                                  {book.status}
                                </span>
                                {book.progress > 0 && (
                                  <span className="text-[10px] text-white/50">{book.progress}%</span>
                                )}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {(() => {
                                  const libraryMatch = (Array.isArray(tracker) ? tracker : []).find((b) => {
                                    const t1 = String(b?.title ?? '').trim().toLowerCase()
                                    const a1 = String(b?.author ?? '').trim().toLowerCase()
                                    const t2 = String(book?.title ?? '').trim().toLowerCase()
                                    const a2 = String(book?.author ?? '').trim().toLowerCase()
                                    return Boolean(t1 && t2 && t1 === t2 && a1 && a2 && a1 === a2)
                                  })

                                  const payload = {
                                    title: book.title,
                                    author: book.author,
                                    cover: book.cover ?? null,
                                    year: book.year ?? null,
                                    isbn: book.isbn ?? null,
                                    olKey: book.olKey ?? book.key ?? null,
                                  }

                                  return [
                                    { id: 'to-read', label: 'To Read' },
                                    { id: 'Reading', label: 'Reading' },
                                    { id: 'Read', label: 'Read' },
                                  ].map((opt) => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => applyFeedQuickStatus(payload, opt.id)}
                                      className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] transition ${
                                        (libraryMatch?.status ?? null) === opt.id
                                          ? 'border-white/60 bg-white/10 text-white'
                                          : 'border-white/20 text-white/70 hover:border-white/60 hover:text-white'
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>
                  ) : (
                    <p className="text-sm text-white/60">No books in library yet</p>
                  )}

                  {friendBooksHasMore && (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={loadMoreFriendBooks}
                        disabled={friendBooksLoading}
                        className="rounded-2xl border border-white/20 px-8 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:bg-white/5 disabled:opacity-60"
                      >
                        {friendBooksLoading ? 'Loading…' : 'Load 20 more'}
                      </button>
                    </div>
                  )}
                </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isAuthorModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0b1225]/95 to-[#050914]/95 overflow-auto pt-[env(safe-area-inset-top)]">
              <div className="sticky top-0 z-10 border-b border-white/10 bg-gradient-to-b from-[#0b1225]/95 to-[#050914]/95 backdrop-blur">
                <div className="mx-auto w-full max-w-4xl px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Author</p>
                      <h2 className="text-2xl font-semibold text-white break-words">{authorModalName}</h2>
                      <p className="text-sm text-white/60">{authorModalBooks.length} books</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAuthorModalOpen(false)
                        setAuthorModalBooks([])
                        setAuthorModalName('')
                      }}
                      className="rounded-full border border-white/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-4xl px-4 py-6">
                {authorModalLoading ? (
                  <p className="text-sm text-white/60">Loading books…</p>
                ) : authorModalBooks.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {authorModalBooks.map((book) => (
                      <div
                        key={book.key}
                        className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        {book.cover ? (
                          <img
                            src={book.cover}
                            alt={book.title}
                            className="h-24 w-16 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="flex h-24 w-16 items-center justify-center rounded-xl bg-white/5 text-xs uppercase tracking-[0.2em] text-white/60 flex-shrink-0">
                            Cover
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white line-clamp-2">{book.title}</p>
                          <p className="text-xs text-white/60">{book.author}</p>
                          <p className="text-xs text-white/50">{book.year || '—'}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddBook(book, 'to-read')}
                              className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                            >
                              + Add
                            </button>
                            <button
                              type="button"
                              onClick={() => openAddToList(book)}
                              className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/60"
                            >
                              Add to list
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/60">No books found for this author.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {currentUser && activeMosh && isMoshCoverPickerOpen && (
          <div
            className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeMoshCoverPicker()
            }}
          >
            <div className="w-full h-full sm:h-auto sm:max-w-2xl rounded-none sm:rounded-3xl border border-white/15 bg-[#0b1225]/95 p-4 sm:p-6 flex flex-col pt-[env(safe-area-inset-top)]">
              <div className="sticky top-0 z-10 -mx-4 sm:mx-0 px-4 sm:px-0 pb-3 bg-[#0b1225]/95 backdrop-blur">
                <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">Pit Cover</p>
                  <h2 className="text-xl font-semibold text-white">Choose a cover</h2>
                  <p className="text-sm text-white/60 line-clamp-1">{activeMosh.book_title}</p>
                </div>
                <button
                  type="button"
                  onClick={closeMoshCoverPicker}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                >
                  Close
                </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-20 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex-shrink-0">
                  {activeMosh.book_cover ? (
                    <img src={activeMosh.book_cover} alt={activeMosh.book_title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">Cover</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={loadEditionCoversForActiveMosh}
                  className="rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                >
                  Refresh
                </button>
              </div>

              {moshCoverPickerLoading ? (
                <p className="text-sm text-white/60">Loading edition covers…</p>
              ) : moshCoverPickerCovers.length > 0 ? (
                <div className="max-h-[60vh] overflow-auto rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                    {moshCoverPickerCovers.map((c) => (
                      <button
                        key={`${c.coverId}-${c.editionKey ?? ''}`}
                        type="button"
                        onClick={() => updateActiveMoshCover(c.urlM)}
                        className="h-20 w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-white/40"
                      >
                        <img src={c.urlS} alt="Edition cover" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white/60">No edition covers found for this mosh.</p>
              )}
              </div>
            </div>
          </div>
        )}

        {currentUser && isProfileTopBookModalOpen && (
          <div className="fixed inset-0 z-[80] bg-[#0b1225] overflow-hidden">
            <div className="h-full w-full flex flex-col">
              <div className="flex-shrink-0 border-b border-white/10 bg-[#0b1225] px-4 py-4">
                <div className="mx-auto w-full max-w-4xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.4em] text-white/40">Favorites</p>
                      <h2 className="text-xl font-semibold text-white">Pick a book</h2>
                    </div>
                    <button
                      type="button"
                      onClick={closeTopBookModal}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 border-b border-white/10 bg-[#0b1225] px-4 py-4">
                <div className="mx-auto w-full max-w-4xl flex gap-2">
                  <input
                    type="text"
                    value={profileTopBookSearch}
                    onChange={(e) => setProfileTopBookSearch(e.target.value)}
                    placeholder="Search any book..."
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={searchTopBook}
                    disabled={profileTopBookLoading}
                    className="rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 disabled:opacity-60"
                  >
                    {profileTopBookLoading ? 'Searching…' : 'Search'}
                  </button>
                </div>
              </div>

              {profileTopBookError && (
                <div className="flex-shrink-0 px-4 py-2 bg-rose-500/10 border-b border-rose-500/20">
                  <div className="mx-auto w-full max-w-4xl">
                    <p className="text-sm text-rose-200">{profileTopBookError}</p>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-auto px-4 py-4">
                <div className="mx-auto w-full max-w-4xl space-y-2">
                {profileTopBookResults.map((r) => {
                  const cover = r.cover_i ? `https://covers.openlibrary.org/b/id/${r.cover_i}-S.jpg` : null
                  const author = r.author_name?.[0] ?? 'Unknown author'
                  const year = r.first_publish_year ?? '—'
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => selectTopBookResult(r)}
                      className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/40"
                    >
                      <div className="h-14 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex-shrink-0">
                        {cover ? (
                          <img src={cover} alt={r.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">Cover</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white line-clamp-2">{r.title}</p>
                        <p className="text-xs text-white/60 line-clamp-1">{author}</p>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">{year}</div>
                    </button>
                  )
                })}
                {profileTopBookResults.length === 0 && !profileTopBookLoading && (
                  <p className="text-sm text-white/60">Search for a book to add it to your favorites.</p>
                )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-midnight/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-white/60">© 2026 BookMosh. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="/privacy" className="text-sm text-white/60 hover:text-white transition">Privacy Policy</a>
              <a href="mailto:support@bookmosh.com" className="text-sm text-white/60 hover:text-white transition">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AppWrapper
