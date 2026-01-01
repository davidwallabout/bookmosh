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

// Create mosh (book chat)
const createMosh = async (bookTitle, participants) => {
  if (!supabase) throw new Error('Supabase not configured')
  
  try {
    const { data, error } = await supabase
      .from('moshes')
      .insert([{
        book_title: bookTitle,
        participants: participants,
        created_by: currentUser.id,
        created_at: new Date().toISOString()
      }])
      .select()
    
    if (error) throw error
    return data[0]
  } catch (error) {
    console.error('Error creating mosh:', error)
    throw error
  }
}

// Get mosh messages
const getMoshMessages = async (moshId) => {
  if (!supabase) return []
  
  try {
    const { data, error } = await supabase
      .from('mosh_messages')
      .select('*')
      .eq('mosh_id', moshId)
      .order('created_at')
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching mosh messages:', error)
    return []
  }
}

const statusOptions = ['Reading', 'Want to Read', 'Read']

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
    return 'Want to Read'
  }
  if (progress >= 100) return 'Read'
  if (progress > 0) return 'Reading'
  return 'Want to Read'
}

const buildBookEntry = (book) => {
  const progress =
    Number(book.progress ?? book.percent ?? book.percentComplete ?? 0) || 0
  const entry = {
    title: book.title ?? book.name ?? 'Untitled',
    author:
      book.author ??
      book.authors?.[0] ??
      (Array.isArray(book.authors) ? book.authors[0] : null) ??
      'Unknown author',
    status: normalizeStatus(book.status ?? book.shelf, progress),
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
      status: item['Read Status'] || item.readStatus || 'Want to Read',
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
      status: item.readStatus || 'Want to Read',
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

const mapSupabaseRow = (row) => ({
  title: row.title ?? 'Untitled',
  author: row.author ?? 'Unknown author',
  status: row.status ?? 'Want to Read',
  progress: Number(row.progress ?? 0) || 0,
  mood: row.mood ?? 'Supabase sync',
  rating: Number(row.rating ?? 0) || 0,
})

const buildSupabasePayload = (book, owner) => ({
  owner,
  title: book.title,
  author: book.author,
  status: book.status,
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
  if (!supabase || !owner || !books.length) return
  try {
    const { error } = await supabase
      .from(SUPABASE_TABLE)
      .upsert(books.map((book) => buildSupabasePayload(book, owner)), {
        onConflict: ['owner', 'title'],
      })
    if (error) {
      console.error('Supabase upsert failed', error)
    }
  } catch (error) {
    console.error('Supabase upsert failed', error)
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
  const [selectedAuthor, setSelectedAuthor] = useState(null)
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [moshes, setMoshes] = useState([]) // Track book chats
  const [users, setUsers] = useState(defaultUsers)
  const [currentUser, setCurrentUser] = useState(null)
  const [isUpdatingUser, setIsUpdatingUser] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authIdentifier, setAuthIdentifier] = useState('')
  const [authPassword, setAuthPassword] = useState('')
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
      { Reading: 0, 'Want to Read': 0, Read: 0 },
    )
  }, [tracker])

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
    let mounted = true

    try {
      // Get initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (mounted && session?.user && !isUpdatingUser) {
          // Get user profile from users table
          supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data: profile, error }) => {
              if (mounted && profile && !error) {
                setCurrentUser(profile)
              } else if (error && error.code !== 'PGRST116') {
                console.error('Profile lookup failed:', error)
              }
            })
            .catch(() => {
              // Silently fail if user profile doesn't exist yet
            })
        }
      }).catch(() => {
        // Silently fail if auth check fails
      })

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted || isUpdatingUser) return
        
        // Don't logout on token refresh events
        if (event === 'TOKEN_REFRESHED') return
        
        if (session?.user) {
          try {
            // Get user profile from users table
            const { data: profile, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single()
            
            if (profile && !error) {
              setCurrentUser(profile)
            } else if (error && error.code !== 'PGRST116') {
              console.error('Profile lookup failed:', error)
              // Don't logout on profile errors, just log it
            }
          } catch (error) {
            // Silently fail if user profile lookup fails
            console.error('Auth state change error:', error)
          }
        } else {
          // Only logout if it's a genuine sign out, not a session error
          if (event === 'SIGNED_OUT') {
            setCurrentUser(null)
          }
        }
      })

      return () => {
        mounted = false
        subscription.unsubscribe()
      }
    } catch (error) {
      console.error('Auth setup failed:', error)
    }
  }, [isUpdatingUser])

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
      const rows = await loadSupabaseBooks(currentUser.username)
      if (!canceled && rows.length) {
        setTracker(rows)
      }
    })()
    return () => {
      canceled = true
    }
  }, [currentUser])

  useEffect(() => {
    if (!supabase || !currentUser) return
    let canceled = false
    ;(async () => {
      const rows = await loadSupabaseBooks(currentUser.username)
      if (!canceled && rows.length) {
        setTracker(rows)
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
        fetchResults(searchQuery.trim(), showAllResults ? 50 : 6)
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
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(term)}&limit=${limit}&sort=editions&fields=key,title,author_name,first_publish_year,cover_i,edition_count,ratings_average,subject,key,isbn,publisher,language,place,person`,
      )
      const data = await response.json()
      const mapped = data.docs.map((doc) => ({
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
      prev.map((book) => (book.title === title ? { ...book, ...updates } : book)),
    )
    setSelectedBook((book) =>
      book?.title === title ? { ...book, ...updates } : book,
    )
  }

  const handleAddBook = (book, status = 'Want to Read') => {
    setTracker((prev) => {
      if (prev.some((item) => item.title === book.title)) return prev
      return [
        {
          title: book.title,
          author: book.author,
          status: status,
          progress: status === 'Reading' ? 0 : (status === 'Read' ? 100 : 0),
          mood: 'Open shelf',
          rating: 0,
        },
        ...prev,
      ]
    })
  }

  const handleAuthModeSwitch = (mode) => {
    setAuthMode(mode)
    setAuthMessage('')
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
    try {
      const participants = [currentUser.username]
      if (friendUsername) {
        participants.push(friendUsername)
      }
      
      const mosh = await createMosh(bookTitle, participants)
      
      // Add to moshes list
      setMoshes(prev => [...prev, mosh])
      
      // Open mosh modal
      // TODO: Implement mosh modal UI
      setFriendMessage(`Started mosh for "${bookTitle}"`)
    } catch (error) {
      console.error('Error starting mosh:', error)
      setFriendMessage('Failed to start mosh')
    }
  }

  const scrollToDiscovery = () => {
    if (typeof window === 'undefined') return
    document.getElementById('discovery')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleLogin = async () => {
    setAuthMessage('')
    if (!supabase) {
      setAuthMessage('Supabase not configured. Please check environment variables.')
      return
    }
    
    try {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email: authIdentifier,
        password: authPassword,
      })
      
      if (error) throw error
      
      // Get user profile from users table
      const { data: profiles, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single()
      
      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError
      }
      
      if (!profiles) {
        setAuthMessage('User profile not found. Please sign up first.')
        return
      }
      
      setCurrentUser(profiles)
      setAuthIdentifier('')
      setAuthPassword('')
    } catch (error) {
      setAuthMessage(error.message || 'Login failed')
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
    if (!supabase) {
      setCurrentUser(null)
      return
    }
    
    try {
      await supabase.auth.signOut()
      setCurrentUser(null)
    } catch (error) {
      console.error('Logout error:', error)
      setCurrentUser(null)
    }
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
    setSelectedBook(book)
    setModalRating(book.rating ?? 0)
    setModalProgress(book.progress ?? 0)
    setModalStatus(book.status ?? statusOptions[0])
    setModalMood(book.mood ?? '')
  }

  const handleModalRating = (value) => {
    setModalRating(value)
    if (selectedBook) {
      updateBook(selectedBook.title, { rating: value })
    }
  }

  const handleDeleteBook = (title) => {
    setTracker(prev => prev.filter(book => book.title !== title))
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight via-[#050916] to-black text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-10">
        {currentUser && (
        <header className="flex justify-start">
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
              className="h-48 w-auto max-w-96 rounded-lg"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'block'
              }}
            />
            <div className="hidden" style={{ display: 'none' }}>
              <div className="h-48 w-48 rounded-lg bg-gradient-to-br from-aurora to-white/70 flex items-center justify-center">
                <span className="text-3xl font-bold text-midnight">B</span>
              </div>
            </div>
          </button>
        </header>
        )}

        {!currentUser && (
        <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-r from-[#030617] via-[#040a1a] to-[#120029] p-8 text-white shadow-[0_30px_120px_rgba(5,2,20,0.65)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_55%)] opacity-40" />
          <div className="pointer-events-none absolute -right-8 top-1/3 h-52 w-52 rounded-full bg-[#9412ff]/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 left-4 h-40 w-40 rounded-full bg-[#2ee8d7]/30 blur-3xl" />
          <div className="relative flex justify-center">
            <img
              src="/bookmosh-center.png"
              alt="BookMosh"
              className="h-64 w-auto max-w-lg rounded-lg"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
            <div className="hidden flex-col items-center gap-5" style={{ display: 'none' }}>
              <p className="text-xs uppercase tracking-[0.6em] text-white/70">
                Bookmosh Codex
              </p>
              <h2 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                A modern book tracker.
              </h2>
              <p className="max-w-2xl text-base text-white/70">
                Track what you read, discover new books, and connect with friends. Your shelf syncs automatically and works the way you do.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleAuthModeSwitch('signup')}
                  className="rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:bg-white/90"
                >
                  Sign up
                </button>
                <button
                  onClick={() => handleAuthModeSwitch('login')}
                  className="rounded-full border border-white/40 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/70 hover:text-white"
                >
                  Log in
                </button>
              </div>
              <p className="text-xs text-white/60">
                Ready for whatever you breathe in next.
              </p>
            </div>
          </div>
        </section>
        )}

        {!currentUser && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Get started</h3>
              <div className="flex gap-2 text-xs uppercase tracking-[0.3em] text-white/60">
                <button
                  onClick={() => handleAuthModeSwitch('login')}
                  className={`rounded-full px-3 py-1 transition ${authMode === 'login' ? 'bg-white/10 text-white' : 'bg-white/0'}`}
                >
                  Login
                </button>
                <button
                  onClick={() => handleAuthModeSwitch('signup')}
                  className={`rounded-full px-3 py-1 transition ${authMode === 'signup' ? 'bg-white/10 text-white' : 'bg-white/0'}`}
                >
                  Sign up
                </button>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {authMode === 'login' ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={authIdentifier}
                    onChange={(e) => setAuthIdentifier(e.target.value)}
                    placeholder="Username or email"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                  />
                  <button
                    onClick={handleLogin}
                    className="w-full rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={signupData.username}
                    onChange={(e) => setSignupData((prev) => ({ ...prev, username: e.target.value }))}
                    placeholder="Choose a username"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                  />
                  <input
                    type="email"
                    value={signupData.email}
                    onChange={(e) => setSignupData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Email address"
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
                    onClick={handleSignup}
                    className="w-full rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                  >
                    Create account
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-rose-300 mt-4">{authMessage}</p>
          </section>
        )}

        {currentUser && (
          <>
        {/* Discovery Search Bar at Top */}
        <div className="rounded-3xl bg-white/5 p-6 shadow-[0_10px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-white/50">Discovery</p>
              <h2 className="text-2xl font-semibold text-white">
                {selectedAuthor ? `Books by ${selectedAuthor}` : 'Search the open shelves'}
              </h2>
              {selectedAuthor && (
                <button
                  onClick={() => {
                    setSelectedAuthor(null)
                    setSearchQuery('')
                    setSearchResults([])
                    setHasSearched(false)
                  }}
                  className="text-xs uppercase tracking-[0.3em] text-white/60 transition hover:text-white mt-1"
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search authors, themes, or moods..."
                  className="w-full bg-transparent px-4 py-3 text-white placeholder:text-white/40 focus:outline-none"
                />
                {searchQuery && (
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>{isSearching ? 'Searching...' : `${searchResults.length} results`}</span>
                    {searchResults.length >= 6 && !showAllResults && (
                      <button
                        onClick={() => setShowAllResults(true)}
                        className="text-xs uppercase tracking-[0.3em] text-white/80 transition hover:text-white"
                      >
                        Show all
                      </button>
                    )}
                    {showAllResults && searchResults.length > 6 && (
                      <button
                        onClick={() => setShowAllResults(false)}
                        className="text-xs uppercase tracking-[0.3em] text-white/80 transition hover:text-white"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Search Results - Now directly below search bar */}
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
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="h-20 w-16 rounded-xl object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="flex h-20 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-white/10 to-white/5 text-xs uppercase tracking-[0.2em] text-white/60 flex-shrink-0">
                          Cover
                        </div>
                      )}
                      <div className="flex flex-1 flex-col gap-2 min-w-0">
                        <p className="text-base font-semibold text-white line-clamp-2">{book.title}</p>
                        <button
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
                        {book.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {book.subjects.slice(0, 3).map((subject, idx) => (
                              <span
                                key={idx}
                                className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/70"
                              >
                                {subject}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddBook(book, 'Read')
                        }}
                        className="flex-1 rounded-2xl border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                      >
                        + Read
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddBook(book, 'Reading')
                        }}
                        className="flex-1 rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                      >
                        + Reading
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddBook(book, 'Want to Read')
                        }}
                        className="flex-1 rounded-2xl border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                      >
                        + Want
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Only show "Show more" button for regular searches, not author searches */}
              {!selectedAuthor && searchResults.length > 6 && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setShowAllResults(!showAllResults)}
                    className="rounded-full border border-white/20 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                  >
                    {showAllResults ? `Show first 6` : `Show ${searchResults.length - 6} more results`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-white/50">Currently Reading</p>
                <h3 className="text-2xl font-semibold text-white">{tracker.filter(book => book.status === 'Reading').length}</h3>
              </div>
              <button
                onClick={() => document.getElementById('discovery')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
              >
                + Add book
              </button>
            </div>
            <div className="space-y-4">
              {tracker.filter(book => book.status === 'Reading').length > 0 ? (
                tracker.filter(book => book.status === 'Reading').map((book) => (
                  <div key={book.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.4em] text-white/40">{book.status}</p>
                        <p className="text-lg font-semibold text-white">{book.title}</p>
                        <p className="text-sm text-white/60">{book.author}</p>
                      </div>
                      <span className="text-xs text-white/50">{book.mood}</span>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-white/10">
                      <div
                        style={{ width: `${book.progress}%` }}
                        className="h-2 rounded-full bg-gradient-to-r from-aurora to-white/70 transition-all duration-300"
                      />
                    </div>
                    <p className="mt-2 text-xs text-white/50">{book.progress}% complete</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => openModal(book)}
                        className="rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => startMosh(book.title)}
                        className="rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                      >
                        Start Mosh
                      </button>
                      <button
                        onClick={() => handleDeleteBook(book.title)}
                        className="rounded-2xl border border-rose-500/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-rose-400 transition hover:border-rose-500/60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/60 mb-4">No books currently being read</p>
                  <button
                    onClick={() => document.getElementById('discovery')?.scrollIntoView({ behavior: 'smooth' })}
                    className="rounded-full border border-white/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                  >
                    + Add a book
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-white/50">Read</p>
                <h3 className="text-2xl font-semibold text-white">{tracker.filter(book => book.status === 'Read').length}</h3>
              </div>
              <button
                onClick={() => document.getElementById('discovery')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
              >
                + Add book
              </button>
            </div>
            <div className="space-y-4">
              {tracker.filter(book => book.status === 'Read').length > 0 ? (
                tracker.filter(book => book.status === 'Read').map((book) => (
                  <div key={book.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.4em] text-white/40">{book.status}</p>
                        <p className="text-lg font-semibold text-white">{book.title}</p>
                        <p className="text-sm text-white/60">{book.author}</p>
                      </div>
                      <span className="text-xs text-white/50">{book.mood}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => openModal(book)}
                        className="rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => startMosh(book.title)}
                        className="rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                      >
                        Start Mosh
                      </button>
                      <button
                        onClick={() => handleDeleteBook(book.title)}
                        className="rounded-2xl border border-rose-500/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-rose-400 transition hover:border-rose-500/60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/60 mb-4">No books completed yet</p>
                  <button
                    onClick={() => document.getElementById('discovery')?.scrollIntoView({ behavior: 'smooth' })}
                    className="rounded-full border border-white/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                  >
                    + Add a book
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-white/50">Want to Read</p>
              <h3 className="text-2xl font-semibold text-white">{tracker.filter(book => book.status === 'Want to Read').length}</h3>
            </div>
            <button
              onClick={() => document.getElementById('discovery')?.scrollIntoView({ behavior: 'smooth' })}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
            >
              + Add book
            </button>
          </div>
          <div className="space-y-4">
            {tracker.filter(book => book.status === 'Want to Read').length > 0 ? (
              tracker.filter(book => book.status === 'Want to Read').map((book) => (
                <div key={book.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.4em] text-white/40">{book.status}</p>
                      <p className="text-lg font-semibold text-white">{book.title}</p>
                      <p className="text-sm text-white/60">{book.author}</p>
                    </div>
                    <span className="text-xs text-white/50">{book.mood}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openModal(book)}
                      className="rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => handleDeleteBook(book.title)}
                      className="rounded-2xl border border-rose-500/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-rose-400 transition hover:border-rose-500/60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-white/60 mb-4">No books in your reading queue</p>
                <button
                  onClick={() => document.getElementById('discovery')?.scrollIntoView({ behavior: 'smooth' })}
                  className="rounded-full border border-white/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:text-white"
                >
                  + Add a book
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Community</h3>
                <div className="flex gap-2 text-xs uppercase tracking-[0.3em] text-white/60">
                  <button
                    onClick={() => handleAuthModeSwitch('login')}
                    className={`rounded-full px-3 py-1 transition ${authMode === 'login' ? 'bg-white/10 text-white' : 'bg-white/0'}`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => handleAuthModeSwitch('signup')}
                    className={`rounded-full px-3 py-1 transition ${authMode === 'signup' ? 'bg-white/10 text-white' : 'bg-white/0 text-white/50'}`}
                  >
                    Signup
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {authMode === 'login' ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={authIdentifier}
                      onChange={(e) => setAuthIdentifier(e.target.value)}
                      placeholder="Username or email"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                    />
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                    />
                    <button
                      onClick={handleLogin}
                      className="w-full rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                    >
                      Continue
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={signupData.username}
                      onChange={(e) => setSignupData((prev) => ({ ...prev, username: e.target.value }))}
                      placeholder="Choose a username"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                    />
                    <input
                      type="email"
                      value={signupData.email}
                      onChange={(e) => setSignupData((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Email address"
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
                      onClick={handleSignup}
                      className="w-full rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                    >
                      Create account
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-rose-300 mt-4">{authMessage}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0b1225]/70 p-4 text-sm text-white">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/60">Signed in as</p>
                  <p className="text-lg font-semibold">{currentUser.username}</p>
                  <p className="text-xs text-white/60">{currentUser.email}</p>
                  <button
                    onClick={handleLogout}
                    className="mt-3 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40"
                  >
                    Log out
                  </button>
                </div>
              )}
              <p className="text-xs text-rose-300 mt-4">{authMessage}</p>
            </div>
            <div className="space-y-4 rounded-2xl border border-white/10 bg-[#050914]/70 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">Privacy</p>
                    <p className="text-sm text-white/60">
                      {isPrivate ? 'Private profile' : 'Public profile'}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsPrivate(!isPrivate)}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40"
                  >
                    {isPrivate ? 'Make Public' : 'Make Private'}
                  </button>
                </div>
                <p className="text-xs text-white/50">
                  {isPrivate ? 'Only friends can see your reading activity' : 'Anyone can discover your reading profile'}
                </p>
              </div>
              <div className="space-y-4 rounded-2xl border border-white/10 bg-[#050914]/70 p-4">
                <div className="flex flex-wrap items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">Friends</p>
                    <p className="text-sm text-white/60">
                      {currentUser ? `${currentUser.friends.length} connections` : 'Sign in to connect'}
                    </p>
                  </div>
                  <div className="text-xs text-white/50">{activeFriendProfiles.length} online</div>
                </div>
                <div className="space-y-2">
                  {activeFriendProfiles.length > 0 ? (
                    activeFriendProfiles.map((friend) => (
                      <div key={friend.username} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#050914]/70 px-4 py-3">
                        <div>
                          <button
                            onClick={() => viewFriendProfile(friend.username)}
                            className="text-left text-sm font-semibold text-white hover:text-white/80 transition-colors"
                          >
                            {friend.username}
                          </button>
                          <p className="text-xs text-white/60">{friend.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase tracking-[0.3em] text-white/50">friend</span>
                          <button
                            onClick={() => viewFriendProfile(friend.username)}
                            className="text-xs text-white/60 hover:text-white transition-colors"
                          >
                            View Profile
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-white/50">{currentUser ? 'No friends yet. Start adding one.' : 'Sign in to see friends.'}</p>
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
                    onClick={handleAddFriend}
                    className="w-full rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                  >
                    Search users
                  </button>
                  <p className="text-xs text-white/60">{friendMessage}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-white/10 bg-[#050914]/60 p-4 text-xs text-white/70">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">Import</p>
                  <p className="text-[10px] text-white/60">Upload a Goodreads CSV or StoryGraph JSON export.</p>
                </div>
                <div className="flex gap-2 text-[10px] uppercase tracking-[0.3em]">
                  <button
                    onClick={() => {
                      setImportFileType('goodreads')
                      setImportMessage('')
                    }}
                    className={`rounded-full px-3 py-1 transition ${importFileType === 'goodreads' ? 'bg-white/10 text-white' : 'bg-white/0 text-white/50'}`}
                  >
                    Goodreads
                  </button>
                  <button
                    onClick={() => {
                      setImportFileType('storygraph')
                      setImportMessage('')
                    }}
                    className={`rounded-full px-3 py-1 transition ${importFileType === 'storygraph' ? 'bg-white/10 text-white' : 'bg-white/0 text-white/50'}`}
                  >
                    StoryGraph
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-white/60">
                Export your Goodreads library via My Books → Import/Export → Export Library (CSV) or grab the StoryGraph JSON from Tools → Export Library, then upload the file here.
              </p>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                  {importFileType === 'goodreads' ? 'CSV file' : 'CSV or JSON file'}
                </span>
                <input
                  type="file"
                  accept={importFileType === 'goodreads' ? '.csv' : '.csv,.json'}
                  onChange={importHandler}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                />
              </label>
              <p className="text-[10px] text-rose-300 min-h-[1rem]">{importMessage}</p>
            </div>
            <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Handpicked reading lane</h3>
                <button className="text-xs uppercase tracking-[0.4em] text-white/50 transition hover:text-white">Refresh</button>
              </div>
              <div className="space-y-4">
                {curatedRecommendations.map((rec) => (
                  <div
                    key={rec.title}
                    className={`rounded-2xl border border-white/15 bg-gradient-to-r ${rec.gradient} px-4 py-5 shadow-xl shadow-black/40`}
                  >
                    <p className="text-xs uppercase tracking-[0.4em] text-white/80">{rec.vibe}</p>
                    <p className="text-lg font-semibold text-white">{rec.title}</p>
                    <p className="text-sm text-white/70">{rec.author}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {selectedFriend && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-[clamp(280px,70vw,520px)] space-y-5 rounded-3xl border border-white/15 bg-[#0b1225]/95 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                    {selectedFriend.username}'s Profile
                  </p>
                  <h2 className="text-xl font-semibold text-white">
                    {selectedFriend.username}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedFriend(null)}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                >
                  Close
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.4em] text-white/50">Currently Reading ({selectedFriend.books?.filter(b => b.status === 'Reading').length || 0})</p>
                    <div className="space-y-3">
                      {selectedFriend.books?.filter(b => b.status === 'Reading').map((book) => (
                        <div key={book.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">{book.title}</p>
                              <p className="text-sm text-white/60">{book.author}</p>
                            </div>
                            <button
                              onClick={() => startMosh(book.title, selectedFriend.username)}
                              className="rounded-full bg-gradient-to-r from-aurora to-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                            >
                              Mosh
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <p className="text-sm uppercase tracking-[0.4em] text-white/50">Want to Read ({selectedFriend.books?.filter(b => b.status === 'Want to Read').length || 0})</p>
                    <div className="space-y-3">
                      {selectedFriend.books?.filter(b => b.status === 'Want to Read').map((book) => (
                        <div key={book.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">{book.title}</p>
                              <p className="text-sm text-white/60">{book.author}</p>
                            </div>
                            <button
                              onClick={() => startMosh(book.title, selectedFriend.username)}
                              className="rounded-full bg-gradient-to-r from-aurora to-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                            >
                              Mosh
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <p className="text-sm uppercase tracking-[0.4em] text-white/50">Read ({selectedFriend.books?.filter(b => b.status === 'Read').length || 0})</p>
                    <div className="space-y-3">
                      {selectedFriend.books?.filter(b => b.status === 'Read').map((book) => (
                        <div key={book.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">{book.title}</p>
                              <p className="text-sm text-white/60">{book.author}</p>
                            </div>
                            <button
                              onClick={() => startMosh(book.title, selectedFriend.username)}
                              className="rounded-full bg-gradient-to-r from-aurora to-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                            >
                              Mosh
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedBook && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-[clamp(280px,70vw,520px)] space-y-5 rounded-3xl border border-white/15 bg-[#0b1225]/95 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                    {selectedBook.status}
                  </p>
                  <h3 className="text-2xl font-semibold text-white">
                    {selectedBook.title}
                  </h3>
                  <p className="text-sm text-white/60">{selectedBook.author}</p>
                </div>
                <button
                  onClick={closeModal}
                  className="text-sm font-semibold text-white/60 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4 text-sm">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-[0.4em] text-white/50">
                    Mood
                  </label>
                  <input
                    type="text"
                    value={modalMood}
                    onChange={(e) => setModalMood(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    placeholder="Describe your current mood"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-[0.4em] text-white/50">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => setModalStatus(status)}
                        className={`rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                          modalStatus === status
                            ? 'border-white/60 bg-white/10 text-white'
                            : 'border-white/10 text-white/60 hover:border-white/40'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-[0.4em] text-white/50">
                    Progress
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={modalProgress}
                    onChange={(e) => setModalProgress(Number(e.target.value))}
                    className="w-full accent-[#9b42ff]"
                  />
                  <p className="text-xs text-white/60">{modalProgress}% complete</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-[0.4em] text-white/50">
                    Rating
                  </label>
                  <div className="flex gap-2 text-sm">
                    {[...Array(5)].map((_, index) => (
                      <span
                        key={index}
                        onClick={() => handleModalRating(index + 1)}
                        className={`cursor-pointer text-2xl ${
                          modalRating >= index + 1 ? 'text-amber-400' : 'text-white/40'
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={closeModal}
                  className="rounded-2xl border border-white/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalSave}
                  className="rounded-2xl bg-gradient-to-r from-aurora to-white/70 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:from-white/80"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
