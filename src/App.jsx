import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabaseClient'

const STORAGE_KEY = 'bookmosh-tracker-storage'
const AUTH_STORAGE_KEY = 'bookmosh-auth-store'

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
      .select('id, username, friends, is_private')
    
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
      .select('id, username, email, friends, is_private')
    
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
    const { data: exactData, error: exactError } = await supabase
      .from('users')
      .select('id, username')
      .or(`username.ilike.${normalized},email.ilike.${normalized}`)
      .limit(5)
    
    if (exactError) throw exactError

    if (Array.isArray(exactData) && exactData.length > 0) return exactData

    const { data, error } = await supabase
      .from('users')
      .select('id, username')
      .or(`username.ilike.%${normalized}%,email.ilike.%${normalized}%`)
      .limit(10)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error searching users:', error)
    return []
  }
}

// Fetch friend's reading data
const fetchFriendBooks = async (username) => {
  if (!supabase) return []
  
  try {
    const { data, error } = await supabase
      .from('bookmosh_books')
      .select('*')
      .eq('owner', username)
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching friend books:', error)
    return []
  }
}

const statusOptions = ['Reading', 'to-read', 'Read']
const statusTags = ['to-read', 'Reading', 'Read']
const allTags = ['to-read', 'Reading', 'Read', 'Owned']

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
    mood: book.mood ?? book.tag ?? 'Imported',
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
  const moodIdx = getIndex('review')
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
    const mood =
      (moodIdx >= 0 ? values[moodIdx] : '') || 'Imported from Goodreads'
    const rating = ratingIdx >= 0 ? Number(values[ratingIdx]) || 0 : 0
    acc.push(buildBookEntry({ title, author, status, progress, mood, rating }))
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
        rating: parseInt(item['Star Rating'] || item['My Rating'] || item.rating) || 0,
        progress: parseInt(item['Read Progress'] || item.progress) || 0,
        mood: item.Review || item.Notes || item.Mood || item.mood || '',
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
    mood: item.mood || '',
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

  const openAuthorModal = async (authorName) => {
    const name = (authorName ?? '').trim()
    if (!name || name === 'Unknown author') return

    setIsAuthorModalOpen(true)
    setAuthorModalName(name)
    setAuthorModalBooks([])
    setAuthorModalLoading(true)

    try {
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
          if (doc.author_name?.some((a) => a.toLowerCase().includes(authorLower))) return true
          return true
        })
        .map((doc) => ({
          key: doc.key,
          title: doc.title,
          author: doc.author_name?.[0] ?? name,
          year: doc.first_publish_year,
          cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
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
    } finally {
      setAuthorModalLoading(false)
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
  mood: row.mood ?? 'Supabase sync',
  rating: Number(row.rating ?? 0) || 0,
})

const buildSupabasePayload = (book, owner) => ({
  owner,
  title: book.title,
  author: book.author,
  cover: book.cover ?? null,
  status: book.status,
  tags: Array.isArray(book.tags) ? book.tags : undefined,
  progress: book.progress,
  mood: book.mood,
  rating: book.rating,
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

function App() {
  const [tracker, setTracker] = useState(initialTracker)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)
  const [searchDebounce, setSearchDebounce] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [modalRating, setModalRating] = useState(0)
  const [modalProgress, setModalProgress] = useState(0)
  const [modalStatus, setModalStatus] = useState(statusOptions[0])
  const [modalMood, setModalMood] = useState('')
  const [publicMoshesForBook, setPublicMoshesForBook] = useState([])
  const [publicMoshesForBookLoading, setPublicMoshesForBookLoading] = useState(false)
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(null)
  const [libraryFilterTags, setLibraryFilterTags] = useState([])
  const [selectedAuthor, setSelectedAuthor] = useState(null)
  const [isAuthorModalOpen, setIsAuthorModalOpen] = useState(false)
  const [authorModalName, setAuthorModalName] = useState('')
  const [authorModalBooks, setAuthorModalBooks] = useState([])
  const [authorModalLoading, setAuthorModalLoading] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [moshes, setMoshes] = useState([]) // Track book chats
  const [feedScope, setFeedScope] = useState('friends')
  const [feedItems, setFeedItems] = useState([])
  const [feedDisplayCount, setFeedDisplayCount] = useState(10)
  const [activeMoshes, setActiveMoshes] = useState([])
  const [unreadByMoshId, setUnreadByMoshId] = useState({})
  const [isMoshPanelOpen, setIsMoshPanelOpen] = useState(false)
  const [activeMosh, setActiveMosh] = useState(null)
  const [activeMoshMessages, setActiveMoshMessages] = useState([])
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
  const [moshLibrarySearch, setMoshLibrarySearch] = useState('')
  const [users, setUsers] = useState(defaultUsers)
  const [currentUser, setCurrentUser] = useState(null)
  const isUpdatingUserRef = useRef(false)
  const [authMode, setAuthMode] = useState('login')
  const [successModal, setSuccessModal] = useState({ show: false, book: null, list: '' })
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
    const filtered = !libraryFilterTags.length
      ? normalized
      : normalized.filter((book) =>
          libraryFilterTags.every((tag) => (book.tags ?? []).includes(tag)),
        )
    const searchFiltered = !librarySearch.trim() 
      ? filtered 
      : filtered.filter(
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
  }, [tracker, libraryFilterTags, librarySearch, librarySort])

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
    return currentUser.friends
      .map((username) => users.find((user) => user.username === username))
      .filter(Boolean)
  }, [currentUser, users])

  useEffect(() => {
    // SIMPLE AUTH: Just restore user from localStorage
    const storedUser = localStorage.getItem('bookmosh-user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        console.log('[AUTH] Restored user from localStorage:', user.username)
        setCurrentUser(user)
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
        .select('id, username, friends, is_private')
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
      setIncomingFriendRequests(rows.filter((r) => r.recipient_id === currentUser.id))
      setOutgoingFriendRequests(rows.filter((r) => r.requester_id === currentUser.id))
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

  // Debounced search effect
  useEffect(() => {
    if (searchDebounce) {
      clearTimeout(searchDebounce)
    }
    
    if (searchQuery.trim()) {
      const newDebounce = setTimeout(() => {
        fetchResults(searchQuery.trim(), showAllResults ? 100 : 6)
      }, 300)
      setSearchDebounce(newDebounce)
    } else {
      setHasSearched(false)
      setSearchResults([])
    }
    
    return () => {
      if (searchDebounce) {
        clearTimeout(searchDebounce)
      }
    }
  }, [searchQuery, showAllResults])

  const fetchAuthorBooks = async (authorName) => {
    if (!authorName?.trim()) return
    setIsSearching(true)
    setSelectedAuthor(authorName)
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?author=${encodeURIComponent(authorName)}&limit=100&fields=key,title,author_name,first_publish_year,cover_i,edition_count,ratings_average,subject,isbn,publisher,language`,
      )
      const data = await response.json()
      
      const authorLower = authorName.toLowerCase()
      
      const mapped = data.docs
        .filter(doc => {
          if (!doc.title) return false
          const title = doc.title.toLowerCase()
          // Filter out compilations, anthologies, and "best of" collections
          if (title.includes('best of') || 
              title.includes('anthology') || 
              title.includes('collection') ||
              title.includes('complete works') ||
              title.includes('selected works')) {
            return false
          }
          return true
        })
        .map((doc) => ({
          key: doc.key,
          title: doc.title,
          author: doc.author_name?.[0] ?? 'Unknown author',
          year: doc.first_publish_year,
          cover: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : null,
          editionCount: doc.edition_count || 0,
          rating: doc.ratings_average || 0,
          subjects: doc.subject?.slice(0, 3) || [],
          isbn: doc.isbn?.[0] || null,
          publisher: doc.publisher?.[0] || null,
          language: doc.language?.[0] || null,
        }))
        .sort((a, b) => {
          // Sort by edition count (popularity) first
          if (b.editionCount !== a.editionCount) return b.editionCount - a.editionCount
          // Then by rating
          if (b.rating !== a.rating) return b.rating - a.rating
          // Then by year (newer first)
          return (b.year || 0) - (a.year || 0)
        })
      
      setSearchResults(mapped)
      setHasSearched(true)
      setSelectedAuthor(authorName)
      setShowAllResults(true) // Show all results by default for author searches
    } catch (err) {
      console.error('Author search failed', err)
    } finally {
      setIsSearching(false)
    }
  }

  const fetchResults = async (term, limit = 20) => {
    if (!term?.trim()) {
      setHasSearched(false)
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      // Use general search to include both title and author
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(term)}&limit=${limit * 3}&fields=key,title,author_name,first_publish_year,cover_i,edition_count,ratings_average,subject,isbn,publisher,language`,
      )
      const data = await response.json()
      
      const searchLower = term.toLowerCase()
      
      // Filter and sort results for better relevance
      const mapped = data.docs
        .filter(doc => doc.title) // Only books with titles
        .map((doc) => ({
          key: doc.key,
          title: doc.title,
          author: doc.author_name?.[0] ?? 'Unknown author',
          year: doc.first_publish_year,
          cover: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : null,
          editionCount: doc.edition_count || 0,
          rating: doc.ratings_average || 0,
          subjects: doc.subject?.slice(0, 3) || [],
          isbn: doc.isbn?.[0] || null,
          publisher: doc.publisher?.[0] || null,
          language: doc.language?.[0] || null,
          // Calculate relevance score based on title and author match
          relevance: (() => {
            const titleMatch = doc.title.toLowerCase().includes(searchLower)
            const authorMatch = doc.author_name?.some(a => a.toLowerCase().includes(searchLower))
            if (titleMatch && authorMatch) return 3 // Both match
            if (titleMatch) return 2 // Title match
            if (authorMatch) return 1 // Author match
            return 0
          })()
        }))
        .sort((a, b) => {
          // Sort by relevance first, then by edition count
          if (b.relevance !== a.relevance) return b.relevance - a.relevance
          return b.editionCount - a.editionCount
        })
        .slice(0, limit) // Take only the requested limit after sorting
      
      setSearchResults(mapped)
      setHasSearched(true)
    } catch (err) {
      console.error('Open Library search failed', err)
    } finally {
      setIsSearching(false)
    }
  }

  const updateBook = (title, updates) => {
    setTracker((prev) =>
      prev.map((book) => {
        if (book.title !== title) return book
        const merged = { ...book, ...updates }

        // Keep status/tags consistent.
        if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
          const nextTags = Array.isArray(merged.tags) ? merged.tags : []
          const status = deriveStatusFromTags(nextTags, merged.status ?? 'to-read')
          return { ...merged, status, tags: Array.from(new Set(nextTags)) }
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
          const existingTags = Array.isArray(book.tags) ? book.tags : []
          const owned = existingTags.includes('Owned')
          const nextTags = Array.from(
            new Set([updates.status, ...(owned ? ['Owned'] : [])].filter(Boolean)),
          )
          return { ...merged, tags: nextTags, status: updates.status }
        }

        return normalizeBookTags(merged)
      }),
    )
    setSelectedBook((book) =>
      book?.title === title ? { ...book, ...updates } : book,
    )
  }

  const handleAddBook = (book, status = 'to-read') => {
    setTracker((prev) => {
      if (prev.some((item) => item.title === book.title)) {
        setSuccessModal({ show: true, book, list: 'Already in Library', alreadyAdded: true })
        setTimeout(() => setSuccessModal({ show: false, book: null, list: '' }), 2000)
        return prev
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
        mood: 'Open shelf',
        rating: 0,
      }
      logBookEvent(entry, 'created')
      
      // Show success modal
      const listName = status === 'Read' ? 'Read List' : status === 'Reading' ? 'Reading List' : 'To-Read List'
      setSuccessModal({ show: true, book: entry, list: listName, alreadyAdded: false })
      setTimeout(() => setSuccessModal({ show: false, book: null, list: '' }), 2500)
      
      return [entry, ...prev]
    })
  }

  const toggleLibraryFilterTag = (tag) => {
    setLibraryFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
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

      const { data, error } = await query
      if (error) throw error
      setFeedItems(data ?? [])
      setFeedDisplayCount(10)
    } catch (error) {
      console.error('Feed fetch failed', error)
      setFeedItems([])
      setFeedDisplayCount(10)
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

  const openMosh = async (mosh) => {
    if (!supabase || !currentUser) return
    setActiveMosh(mosh)
    setIsMoshPanelOpen(true)
    try {
      const { data } = await supabase
        .from('mosh_messages')
        .select('*')
        .eq('mosh_id', mosh.id)
        .order('created_at')
      setActiveMoshMessages(data ?? [])
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
      console.error('Open mosh failed', error)
    }
  }

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
        const updated = [...prev, ...(data ?? [])]
        console.log('[MOSH] Updated messages count:', updated.length)
        return updated
      })
      
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
      setFriendMessage('Failed to start mosh.')
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
      setMoshInviteError(error.message || 'Failed to start mosh.')
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
  }, [currentUser])

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

  const viewFriendProfile = async (friendUsername) => {
    try {
      // Get friend's user info
      const friendData = await searchUsers(friendUsername)
      const friend = friendData.find(u => u.username === friendUsername)
      
      if (!friend) {
        setFriendMessage('Friend not found')
        return
      }
      
      // Get friend's books
      const friendBooks = await fetchFriendBooks(friendUsername)
      
      setSelectedFriend({
        ...friend,
        books: friendBooks
      })
    } catch (error) {
      console.error('Error loading friend profile:', error)
      setFriendMessage('Failed to load friend profile')
    }
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
      
      // Create user profile
      const userProfile = {
        id: user.id,
        username: signupData.username,
        email: signupData.email,
        password_hash: 'managed_by_supabase_auth',
        friends: [],
        is_private: false,
      }
      
      try {
        await createUser(userProfile)
      } catch (profileError) {
        console.error('Profile creation failed:', profileError)
        // Continue anyway - profile might already exist
      }
      
      // Log user in immediately
      localStorage.setItem('bookmosh-user', JSON.stringify(userProfile))
      setCurrentUser(userProfile)
      console.log('[AUTH] Signup successful, user logged in:', userProfile.username)
      
      setSignupData({ username: '', email: '', password: '' })
      setAuthMessage('')
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
      const searchResults = await searchUsers(query)
      
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

  const acceptFriendInvite = async (request) => {
    if (!supabase || !request?.id) return
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', request.id)
      if (error) throw error
      await refreshCurrentUser()
      await loadFriendRequests()
      setFriendMessage(`Connected with ${request.requester_username}.`)
    } catch (error) {
      console.error('Accept friend invite failed', error)
      setFriendMessage('Failed to accept invite.')
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

  const openModal = (book) => {
    const normalized = normalizeBookTags(book)
    setSelectedBook(normalized)
    setModalRating(book.rating ?? 0)
    setModalProgress(book.progress ?? 0)
    setModalStatus(normalized.status ?? statusOptions[0])
    setModalMood(book.mood ?? '')
  }

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

  const handleModalRating = (value) => {
    setModalRating(value)
    if (selectedBook) {
      updateBook(selectedBook.title, { rating: value })
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

  const closeModal = () => {
    setSelectedBook(null)
    setShowFindMatch(false)
    setFindMatchQuery('')
    setFindMatchResults([])
    setShowCoverPicker(false)
    setCoverPickerLoading(false)
    setCoverPickerCovers([])
  }

  const handleModalSave = () => {
    if (!selectedBook) return
    updateBook(selectedBook.title, {
      progress: modalProgress,
      status: modalStatus,
      mood: modalMood,
      rating: modalRating,
    })
    closeModal()
  }

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

      for (const edition of entries) {
        const coverIds = Array.isArray(edition?.covers) ? edition.covers : []
        const editionKey = typeof edition?.key === 'string' ? edition.key : null
        const isbn = edition?.isbn_13?.[0] || edition?.isbn_10?.[0] || null
        for (const coverId of coverIds) {
          const key = String(coverId)
          if (seen.has(key)) continue
          seen.add(key)
          covers.push({
            coverId,
            editionKey,
            isbn,
            urlM: `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`,
            urlS: `https://covers.openlibrary.org/b/id/${coverId}-S.jpg`,
          })
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

  const mapFeedItemToBook = (item) => {
    const tags = Array.isArray(item?.tags) ? item.tags : []
    const status = deriveStatusFromTags(tags, tags[0] ?? 'to-read')
    return normalizeBookTags({
      title: item.book_title,
      author: item.book_author ?? 'Unknown author',
      cover: item.book_cover ?? null,
      tags,
      status,
      mood: 'Feed',
      rating: 0,
      progress: status === 'Read' ? 100 : 0,
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight via-[#050916] to-black text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10">
        {currentUser && (
        <header className="flex items-center justify-center">
          <button
            onClick={() => {
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
        </header>
        )}

        {currentUser && activeMosh && isMoshAddFriendsOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeMoshAddFriends()
              }
            }}
          >
            <div className="w-[clamp(320px,80vw,620px)] rounded-3xl border border-white/15 bg-[#0b1225]/95 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">Mosh</p>
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

              <div className="mt-5 space-y-3">
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

        {!currentUser && (
          <header className="flex items-center justify-center pt-6 pb-2">
            <img
              src="/bookmosh-center.png"
              alt="BookMosh"
              className="h-40 w-auto sm:h-52 md:h-64"
            />
          </header>
        )}

        {currentUser && (
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
                  {selectedAuthor ? `${searchResults.length} books by popularity` : 'Open Library · instant results'}
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
                        placeholder="Search authors, themes, or moods..."
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
                    {(selectedAuthor || showAllResults ? searchResults : searchResults.slice(0, 6)).map((book) => (
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
                                fetchAuthorBooks(book.author)
                              }}
                              className="text-sm text-white/60 hover:text-white transition-colors text-left"
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddBook(book, 'to-read')
                            }}
                            className="flex-1 rounded-2xl border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                          >
                            + to-read
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddBook(book, 'Reading')
                            }}
                            className="flex-1 rounded-2xl border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                          >
                            + Reading
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddBook(book, 'Read')
                            }}
                            className="flex-1 rounded-2xl border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                          >
                            + Read
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!selectedAuthor && searchResults.length > 6 && (
                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowAllResults(!showAllResults)}
                        className="rounded-2xl bg-gradient-to-r from-aurora/80 to-white/60 px-8 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-aurora hover:to-white/80 shadow-lg"
                      >
                        {showAllResults ? '← Show Less' : `Show All ${searchResults.length} Results →`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Library */}
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Library</p>
                  <h3 className="text-2xl font-semibold text-white">
                    {libraryFilterTags.length > 0 || librarySearch.trim() 
                      ? `${filteredLibrary.length}/${tracker.length}`
                      : filteredLibrary.length
                    }
                  </h3>
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
                  <button
                    type="button"
                    onClick={scrollToDiscovery}
                    className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                  >
                    + Add book
                  </button>
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

              <div className="mt-5 relative">
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
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleLibraryFilterTag(tag)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                      libraryFilterTags.includes(tag)
                        ? 'border-white/60 bg-white/10 text-white'
                        : 'border-white/10 text-white/60 hover:border-white/40'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {libraryFilterTags.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLibraryFilterTags([])}
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
                        <button
                          type="button"
                          onClick={() => openModal(book)}
                          className="text-lg font-semibold text-white line-clamp-2 hover:text-white/80 transition text-left"
                        >
                          {book.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openAuthorModal(book.author)
                          }}
                          className="text-sm text-white/60 line-clamp-1 hover:text-white hover:underline transition text-left"
                        >
                          {book.author}
                        </button>
                        
                        <div className="mt-1 flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateBook(book.title, { rating: star })
                              }}
                              className={`text-sm transition hover:scale-110 ${star <= (book.rating || 0) ? 'text-yellow-400' : 'text-white/20 hover:text-yellow-400/50'}`}
                            >
                              ★
                            </button>
                          ))}
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
                            onClick={() => openMoshInvite(book)}
                            className="rounded-full bg-gradient-to-r from-aurora to-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                          >
                            Send Mosh invite
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
            </section>

            {/* Active Moshes (below Library) */}
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Active Moshes</p>
                  <h3 className="text-2xl font-semibold text-white">{activeMoshes.length}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoshPanelOpen(true)}
                  className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                >
                  Open
                </button>
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
                      <div className="h-14 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex-shrink-0">
                        {mosh.book_cover ? (
                          <img src={mosh.book_cover} alt={mosh.book_title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">Cover</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white line-clamp-1">{mosh.book_title}</p>
                        <p className="text-xs text-white/60 line-clamp-1">{mosh.book_author ?? 'Book chat'}</p>
                      </div>
                      {(unreadByMoshId[mosh.id] ?? 0) > 0 && (
                        <span className="rounded-full bg-rose-500/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                          {unreadByMoshId[mosh.id]}
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-white/60">No moshes yet. Start one from a book.</p>
                )}
              </div>
            </section>

            {/* Feed (below Active Moshes) */}
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Feed</p>
                  <h3 className="text-2xl font-semibold text-white">{feedItems.length}</h3>
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

              <div className="mt-6 space-y-3">
                {feedItems.length > 0 ? (
                  feedItems.slice(0, feedDisplayCount).map((item) => {
                    const book = mapFeedItemToBook(item)
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-4 rounded-2xl border border-white/10 bg-[#050914]/60 p-4"
                      >
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
                          <p className="text-xs uppercase tracking-[0.3em] text-white/50">{item.owner_username}</p>
                          <p className="text-base font-semibold text-white line-clamp-2">{book.title}</p>
                          <p className="text-sm text-white/60 line-clamp-1">{book.author}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(book.tags ?? []).map((tag) => (
                              <span key={tag} className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openModal(book)}
                              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => openMoshInvite(book)}
                              className="rounded-full bg-gradient-to-r from-aurora to-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                            >
                              Send Mosh invite
                            </button>
                          </div>
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
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Community</p>
                  <h3 className="text-2xl font-semibold text-white">{currentUser?.friends?.length ?? 0}</h3>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Friends</p>
                      <p className="text-sm text-white/60">{currentUser.friends?.length ?? 0} connections</p>
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
                              <button
                                type="button"
                                onClick={() => viewFriendProfile(friend.username)}
                                className="text-xs uppercase tracking-[0.3em] text-white/60 hover:text-white transition"
                              >
                                View
                              </button>
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
                      Send invite
                    </button>
                    <p className="text-xs text-white/60">{friendMessage}</p>
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
                      <p className="text-sm text-white/60">No pending invites.</p>
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
                      onClick={updateReadBooksProgress}
                      className="w-full rounded-2xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-amber-400 transition hover:border-amber-500 hover:bg-amber-500/20"
                    >
                      Update Read Books to 100%
                    </button>
                    <p className="text-[10px] text-white/50">Set all books marked as "Read" to 100% progress.</p>
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
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">Invite & Share</p>
                    <button
                      type="button"
                      onClick={() => {
                        const inviteUrl = 'https://bookmosh.com'
                        navigator.clipboard.writeText(inviteUrl)
                        alert('Invite link copied to clipboard! Share it with friends to invite them to BookMosh.')
                      }}
                      className="w-full rounded-2xl border border-aurora/50 bg-aurora/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-aurora transition hover:border-aurora hover:bg-aurora/20"
                    >
                      Invite Friends to BookMosh
                    </button>
                    <p className="text-[10px] text-white/50">Share BookMosh with friends and start reading together.</p>
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
          </>
        )}

        {successModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-[clamp(280px,90vw,400px)] rounded-3xl border border-white/15 bg-gradient-to-b from-[#0b1225]/95 to-[#050914]/95 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
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
                  placeholder="Username"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
                <input
                  type="email"
                  value={signupData.email}
                  onChange={(e) => setSignupData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Email"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
                <input
                  type="password"
                  value={signupData.password}
                  onChange={(e) => setSignupData((prev) => ({ ...prev, password: e.target.value }))}
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeMoshInvite()
              }
            }}
          >
            <div className="w-[clamp(320px,80vw,620px)] rounded-3xl border border-white/15 bg-[#0b1225]/95 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">Start a mosh</p>
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

              <div className="mt-5 flex items-start gap-4 rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
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

              <div className="mt-5 space-y-3">
                <label className="block text-xs uppercase tracking-[0.3em] text-white/50">Mosh Title (Optional)</label>
                <input
                  type="text"
                  value={moshInviteTitle}
                  onChange={(e) => setMoshInviteTitle(e.target.value)}
                  placeholder={moshInviteBook?.title || "Custom mosh title..."}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                />
              </div>

              <div className="mt-5 space-y-3">
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
                  {moshInviteLoading ? 'Starting…' : 'Start mosh'}
                </button>
              </div>
            </div>
          </div>
        )}

        {currentUser && isMoshPanelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-[clamp(320px,80vw,900px)] rounded-3xl border border-white/15 bg-[#0b1225]/95 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">Mosh</p>
                  <h2 className="text-xl font-semibold text-white">{activeMosh?.book_title ?? 'Active Moshes'}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoshPanelOpen(false)
                    setActiveMosh(null)
                  }}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                >
                  Close
                </button>
              </div>

              {!activeMosh ? (
                <div className="mt-5 space-y-4">
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
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">Start a mosh from your library</p>
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
                <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
                  <div className="rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                    <div className="max-h-[45vh] space-y-3 overflow-auto pr-2">
                      {activeMoshMessages.map((msg) => (
                        <div key={msg.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs uppercase tracking-[0.3em] text-white/50">{msg.sender_username}</p>
                          <p className="text-sm text-white">{msg.body}</p>
                        </div>
                      ))}
                      {activeMoshMessages.length === 0 && (
                        <p className="text-sm text-white/60">No messages yet.</p>
                      )}
                    </div>
                    <div className="mt-4 relative">
                      {/* Mention dropdown */}
                      {showMentionDropdown && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 rounded-2xl border border-white/10 bg-[#0b1225]/95 p-2 shadow-lg">
                          {(activeMosh?.participants_usernames || [])
                            .filter(u => u.toLowerCase().includes(moshMentionQuery))
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
                                // Select first matching participant
                                const matches = (activeMosh?.participants_usernames || [])
                                  .filter(u => u.toLowerCase().includes(moshMentionQuery))
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
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                    <button
                      type="button"
                      onClick={() => setActiveMosh(null)}
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
                            <p className="text-sm text-white">{username}</p>
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
              )}
            </div>
          </div>
        )}

        {selectedBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={closeModal}>
            <div className="w-[clamp(320px,90vw,600px)] rounded-3xl border border-white/15 bg-[#0b1225]/95 p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">Book Details</p>
                  <h2 className="text-xl font-semibold text-white">{selectedBook.title}</h2>
                  <p className="text-sm text-white/60">{selectedBook.author}</p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
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
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Cover</label>
                  <div className="flex items-center gap-3">
                    <div className="h-24 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex-shrink-0">
                      {selectedBook.cover ? (
                        <img src={selectedBook.cover} alt={selectedBook.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/60">None</div>
                      )}
                    </div>
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
                  </div>

                  {showCoverPicker && (
                    <div className="mt-4">
                      {coverPickerLoading ? (
                        <p className="text-sm text-white/60">Loading edition covers…</p>
                      ) : coverPickerCovers.length > 0 ? (
                        <div className="max-h-64 overflow-auto rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                            {coverPickerCovers.map((c) => (
                              <button
                                key={`${c.coverId}-${c.editionKey ?? ''}`}
                                type="button"
                                onClick={() => {
                                  updateBook(selectedBook.title, { cover: c.urlM, isbn: c.isbn ?? selectedBook.isbn, olKey: selectedBook.olKey ?? null })
                                  setSelectedBook({ ...selectedBook, cover: c.urlM, isbn: c.isbn ?? selectedBook.isbn, olKey: selectedBook.olKey ?? null })
                                  setShowCoverPicker(false)
                                  setCoverPickerCovers([])
                                }}
                                className="h-20 w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-white/40"
                              >
                                <img src={c.urlS} alt="Edition cover" className="h-full w-full object-cover" />
                              </button>
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
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-white/40 focus:outline-none"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
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
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleModalRating(star)}
                        className={`text-2xl transition ${star <= modalRating ? 'text-yellow-400' : 'text-white/20'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Mood / Notes</label>
                  <textarea
                    value={modalMood}
                    onChange={(e) => setModalMood(e.target.value)}
                    placeholder="How did this book make you feel?"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    rows="3"
                  />
                </div>

                {!showFindMatch ? (
                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteBook(selectedBook.title)
                        closeModal()
                      }}
                      className="flex-1 rounded-2xl border border-rose-500/50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-rose-400 transition hover:border-rose-500 hover:bg-rose-500/10"
                    >
                      Delete
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
        )}

        {/* Friend Profile Modal */}
        {selectedFriend && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-3xl border border-white/15 bg-gradient-to-b from-[#0b1225]/95 to-[#050914]/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-white">{selectedFriend.username}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFriend(null)}
                  className="text-white/60 hover:text-white transition text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-3">Library</p>
                  {selectedFriend.books && selectedFriend.books.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedFriend.books.map((book, idx) => (
                        <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="flex gap-3">
                            {book.cover ? (
                              <img src={book.cover} alt={book.title} className="h-20 w-14 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="flex h-20 w-14 items-center justify-center rounded-lg bg-white/5 text-xs text-white/40 flex-shrink-0">
                                No cover
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white line-clamp-2">{book.title}</p>
                              <p className="text-xs text-white/60 line-clamp-1">{book.author}</p>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="rounded-full bg-aurora/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-aurora">
                                  {book.status}
                                </span>
                                {book.progress > 0 && (
                                  <span className="text-[10px] text-white/50">{book.progress}%</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/60">No books in library yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isAuthorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-3xl border border-white/15 bg-gradient-to-b from-[#0b1225]/95 to-[#050914]/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">Author</p>
                  <h2 className="text-2xl font-semibold text-white">{authorModalName}</h2>
                  <p className="text-sm text-white/60">{authorModalBooks.length} books</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAuthorModalOpen(false)
                    setAuthorModalBooks([])
                    setAuthorModalName('')
                  }}
                  className="text-white/60 hover:text-white transition text-2xl"
                >
                  ✕
                </button>
              </div>

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
                        <p className="text-xs text-white/60">{book.year || '—'}</p>
                        <button
                          type="button"
                          onClick={() => handleAddBook(book, 'to-read')}
                          className="mt-3 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/60">No books found for this author.</p>
              )}
            </div>
          </div>
        )}

        {currentUser && activeMosh && isMoshCoverPickerOpen && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeMoshCoverPicker()
            }}
          >
            <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-3xl border border-white/15 bg-[#0b1225]/95 p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">Mosh Cover</p>
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
        )}
      </div>
    </div>
  )
}

export default App
