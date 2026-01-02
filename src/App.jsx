import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'

const STORAGE_KEY = 'bookmosh-tracker-storage'
const AUTH_STORAGE_KEY = 'bookmosh-auth-store'

const curatedRecommendations = []

const initialTracker = []

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
      .select('id, username, email, friends, is_private')
    
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
    const { data, error } = await supabase
      .from('users')
      .update({ friends, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
    
    if (error) throw error
    return data[0]
  } catch (error) {
    console.error('Error updating friends:', error)
    throw error
  }
}

const searchUsers = async (query) => {
  if (!supabase) return []
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email')
      .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
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
  const lines = text.split('\n').filter((line) => line.trim())
  if (lines.length < 2) return []
  
  // Find header line
  const headerLine = lines[0]
  const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''))
  
  // Find data rows
  const dataRows = lines.slice(1)
  
  return dataRows
    .map((line) => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      if (values.length < headers.length) return null
      
      const obj = {}
      headers.forEach((header, index) => {
        obj[header] = values[index] || ''
      })
      
      return obj
    })
    .filter(Boolean)
    .map((item) => ({
      title: item.Title || item.title || '',
      author: item.Author || item.author || '',
      status: item['Read Status'] || item.readStatus || 'to-read',
      rating: parseInt(item['My Rating'] || item.rating) || 0,
      progress: item['Read Progress'] || item.progress || 0,
      mood: item['Mood'] || item.mood || '',
    }))
}

const parseStoryGraphJSON = (text) => {
  try {
    const data = JSON.parse(text)
    return data.map((item) => ({
      title: item.title || '',
      author: item.author || '',
      status: item.readStatus || 'to-read',
      rating: item.rating || 0,
      progress: item.progress || 0,
      mood: item.mood || '',
    }))
  } catch (error) {
    console.error('Failed to parse StoryGraph JSON:', error)
    return []
  }
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
      const key = `${entry.title.trim().toLowerCase()}|${(entry.author ?? '')
        .trim()
        .toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(entry)
    }
    if (!unique.length) {
      setMessage('No new titles were added from this import.')
      return prev
    }
    setMessage(`Imported ${unique.length} new title${unique.length === 1 ? '' : 's'}.`)
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
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(null)
  const [libraryFilterTags, setLibraryFilterTags] = useState([])
  const [selectedAuthor, setSelectedAuthor] = useState(null)
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [moshes, setMoshes] = useState([]) // Track book chats
  const [feedScope, setFeedScope] = useState('friends')
  const [feedItems, setFeedItems] = useState([])
  const [activeMoshes, setActiveMoshes] = useState([])
  const [unreadByMoshId, setUnreadByMoshId] = useState({})
  const [isMoshPanelOpen, setIsMoshPanelOpen] = useState(false)
  const [activeMosh, setActiveMosh] = useState(null)
  const [activeMoshMessages, setActiveMoshMessages] = useState([])
  const [moshDraft, setMoshDraft] = useState('')
  const [isMoshInviteOpen, setIsMoshInviteOpen] = useState(false)
  const [moshInviteBook, setMoshInviteBook] = useState(null)
  const [moshInviteFriends, setMoshInviteFriends] = useState([])
  const [moshInviteSearch, setMoshInviteSearch] = useState('')
  const [moshInviteError, setMoshInviteError] = useState('')
  const [moshInviteLoading, setMoshInviteLoading] = useState(false)
  const [librarySearch, setLibrarySearch] = useState('')
  const [moshLibrarySearch, setMoshLibrarySearch] = useState('')
  const [users, setUsers] = useState(defaultUsers)
  const [currentUser, setCurrentUser] = useState(null)
  const [isUpdatingUser, setIsUpdatingUser] = useState(false)
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

    const query = librarySearch.trim().toLowerCase()
    const searched = query
      ? filtered.filter((book) => {
          const title = String(book.title ?? '').toLowerCase()
          const author = String(book.author ?? '').toLowerCase()
          return title.includes(query) || author.includes(query)
        })
      : filtered

    return searched
      .slice()
      .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
  }, [tracker, libraryFilterTags, librarySearch])

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
    return matches.slice(0, 12)
  }, [tracker, moshLibrarySearch])

  useEffect(() => {
    if (!supabase || !currentUser) return
    persistTrackerToSupabase(currentUser.username, tracker)
  }, [tracker, currentUser])

  const activeFriendProfiles = useMemo(() => {
    if (!currentUser) return []
    return currentUser.friends
      .map((username) => users.find((user) => user.username === username))
      .filter(Boolean)
  }, [currentUser, users, isUpdatingUser])

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
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?author=${encodeURIComponent(authorName)}&limit=100&sort=editions&fields=key,title,author_name,first_publish_year,cover_i,edition_count,ratings_average,subject,isbn,publisher,language`,
      )
      const data = await response.json()
      const mapped = data.docs.map((doc) => ({
        key: doc.key,
        title: doc.title,
        author: doc.author_name?.[0] ?? authorName,
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

  const fetchResults = async (term, limit = 6) => {
    if (!term?.trim()) {
      setHasSearched(false)
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      // Use general search to include both title and author
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(term)}&limit=${limit * 2}&fields=key,title,author_name,first_publish_year,cover_i,edition_count,ratings_average,subject,isbn,publisher,language`,
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
        .limit(60)

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
    } catch (error) {
      console.error('Feed fetch failed', error)
      setFeedItems([])
    }
  }

  const fetchActiveMoshes = async () => {
    if (!supabase || !currentUser) return
    try {
      const { data, error } = await supabase
        .from('moshes')
        .select('*')
        .contains('participants_ids', [currentUser.id])
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

  const sendMoshMessage = async () => {
    if (!supabase || !currentUser || !activeMosh) return
    const body = moshDraft.trim()
    if (!body) return
    setMoshDraft('')
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
      if (error) throw error
      setActiveMoshMessages((prev) => [...prev, ...(data ?? [])])
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
      console.error('Send message failed', error)
    }
  }

  const sendMoshInvite = async (book, friendUsername) => {
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
            created_by: currentUser.id,
            created_by_username: currentUser.username,
            participants_ids: participantsIds,
            participants_usernames: participantsUsernames,
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
    setMoshInviteError('')
    setIsMoshInviteOpen(true)
  }

  const closeMoshInvite = () => {
    setIsMoshInviteOpen(false)
    setMoshInviteBook(null)
    setMoshInviteFriends([])
    setMoshInviteSearch('')
    setMoshInviteError('')
    setMoshInviteLoading(false)
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
      await sendMoshInvite(moshInviteBook, moshInviteFriends[0])
      closeMoshInvite()
    } catch {
      setMoshInviteError('Failed to start mosh.')
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
    updateBook(title, { status: nextStatus })
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
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
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
        // Sign out immediately to not create session
        await supabase.auth.signOut({ scope: 'local' })
        return
      }
      
      // Sign out immediately - we don't want Supabase sessions
      await supabase.auth.signOut({ scope: 'local' })
      
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
    
    try {
      // Create auth user with custom email template
      const { data: { user }, error: authError } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          emailRedirectTo: 'https://bookmosh.com',
          data: {
            username: signupData.username,
          }
        }
      })
      
      if (authError) throw authError
      
      // Don't auto-logout - let user stay on page to check email
      setAuthMessage('Success! Please check your email to confirm your account.')
      setSignupData({ username: '', email: '', password: '' })
      
      // Create user profile immediately (will be accessible after email confirmation)
      try {
        await createUser({
          id: user.id,
          username: signupData.username,
          email: signupData.email,
          password_hash: 'managed_by_supabase_auth',
          friends: [],
          is_private: false,
        })
      } catch (profileError) {
        console.error('Profile creation failed:', profileError)
        // Don't show error to user since email confirmation is the main concern
      }
    } catch (error) {
      setAuthMessage(error.message || 'Signup failed')
    }
  }

  const handleLogout = async () => {
    console.log('[AUTH] Logging out')
    localStorage.removeItem('bookmosh-user')
    setCurrentUser(null)
  }

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
      let imported = []
      if (importFileType === 'goodreads') {
        imported = parseGoodreadsCSV(text)
      } else if (importFileType === 'storygraph') {
        // Try JSON first, then CSV for StoryGraph
        try {
          imported = parseStoryGraphJSON(text)
        } catch (error) {
          // If JSON fails, try CSV
          try {
            imported = parseStoryGraphCSV(text)
          } catch (csvError) {
            setImportMessage('Unable to parse StoryGraph file. Please ensure it\'s a valid JSON or CSV export.')
            return
          }
        }
      }
      if (!imported.length) {
        setImportMessage('No readable entries were found in that file.')
        return
      }
      mergeImportedBooks(imported, setImportMessage, setTracker)
    }
    reader.onerror = () => {
      setImportMessage('File reading failed.')
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const handleAddFriend = async () => {
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
      setIsUpdatingUser(true)
      
      // Search for users
      const searchResults = await searchUsers(query)
      
      if (searchResults.length === 0) {
        setFriendMessage('No users found matching your search.')
        return
      }
      
      // Filter out current user and existing friends
      const availableMatches = searchResults.filter(user => 
        user.id !== currentUser.id && 
        !currentUser.friends.includes(user.username)
      )
      
      if (availableMatches.length === 0) {
        if (searchResults.some(user => user.id === currentUser.id)) {
          setFriendMessage('You cannot add yourself as a friend.')
        } else {
          setFriendMessage('Already connected with all matching users.')
        }
        return
      }
      
      // Add first available friend
      const friendToAdd = availableMatches[0]
      const updatedFriends = [...currentUser.friends, friendToAdd.username]
      
      // Update friends in database
      const updatedUser = await updateUserFriends(currentUser.id, updatedFriends)
      
      // Update current user state locally
      setCurrentUser(updatedUser)
      
      setFriendMessage(`Connected with ${friendToAdd.username}!`)
      setFriendQuery('')
    } catch (error) {
      console.error('Friend add error:', error)
      setFriendMessage('Failed to add friend. Please try again.')
    } finally {
      setIsUpdatingUser(false)
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
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-10">
        {currentUser && (
        <header className="flex items-center justify-between">
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
              src="/bookmosh-logo.png"
              alt="BookMosh"
              className="h-48 w-auto"
            />
          </button>

          <button
            type="button"
            onClick={() => setIsMoshPanelOpen(true)}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/60 hover:text-white"
          >
            Mosh
          </button>
        </header>
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
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setShowAllResults(false)
                      }}
                      placeholder="Search authors, themes, or moods..."
                      className="w-full bg-transparent px-4 py-3 text-white placeholder:text-white/40 focus:outline-none"
                    />
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
                  <h3 className="text-2xl font-semibold text-white">{filteredLibrary.length}</h3>
                </div>
                <button
                  type="button"
                  onClick={scrollToDiscovery}
                  className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                >
                  + Add book
                </button>
              </div>

              <div className="mt-5">
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search your library..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
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
                {filteredLibrary.length > 0 ? (
                  filteredLibrary.map((book) => (
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
                        <p className="text-lg font-semibold text-white line-clamp-2">{book.title}</p>
                        <p className="text-sm text-white/60 line-clamp-1">{book.author}</p>
                        
                        {book.rating > 0 && (
                          <div className="mt-1 flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span key={star} className={`text-sm ${star <= book.rating ? 'text-yellow-400' : 'text-white/20'}`}>
                                ★
                              </span>
                            ))}
                          </div>
                        )}

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
                  feedItems.map((item) => {
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
            </section>

            {/* Community */}
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Community</p>
                  <h3 className="text-2xl font-semibold text-white">{activeFriendProfiles.length}</h3>
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
                      activeFriendProfiles.map((friend) => (
                        <div key={friend.username} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div>
                            <button
                              type="button"
                              onClick={() => viewFriendProfile(friend.username)}
                              className="text-left text-sm font-semibold text-white hover:text-white/80 transition-colors"
                            >
                              {friend.username}
                            </button>
                            <p className="text-xs text-white/60">{friend.email}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => viewFriendProfile(friend.username)}
                            className="text-xs uppercase tracking-[0.3em] text-white/60 hover:text-white transition"
                          >
                            View
                          </button>
                        </div>
                      ))
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
                      onClick={handleAddFriend}
                      className="w-full rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                    >
                      Add friend
                    </button>
                    <p className="text-xs text-white/60">{friendMessage}</p>
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
                    <p className="text-sm text-white/80">
                      <span className="font-semibold">{successModal.book?.title}</span>
                    </p>
                    <p className="text-xs uppercase tracking-[0.3em] text-aurora">
                      Added to {successModal.list}
                    </p>
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
                {moshInviteSearch && (
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
                      <p className="text-sm text-white/60">No matching friends</p>
                    )}
                  </div>
                )}

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
                          <p className="text-sm font-semibold text-white line-clamp-1">{mosh.book_title}</p>
                          <p className="text-xs text-white/60 line-clamp-1">{mosh.book_author ?? 'Book chat'}</p>
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
                    <div className="mt-4 flex gap-2">
                      <input
                        value={moshDraft}
                        onChange={(e) => setMoshDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            sendMoshMessage()
                          }
                        }}
                        placeholder="Type a message…"
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
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-[#050914]/60 p-4">
                    <button
                      type="button"
                      onClick={() => setActiveMosh(null)}
                      className="w-full rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40"
                    >
                      ← Back to moshes
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
                  <button
                    type="button"
                    onClick={handleModalSave}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
