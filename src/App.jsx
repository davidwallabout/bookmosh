import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'

const STORAGE_KEY = 'bookmosh-tracker-storage'
const AUTH_STORAGE_KEY = 'bookmosh-auth-store'

const curatedRecommendations = [
  {
    title: 'The Quiet Stream',
    author: 'Mai Nguyen',
    vibe: 'Slow-burn memoir',
    gradient: 'from-[#ff9a8b] to-[#ffd6a5]',
  },
  {
    title: 'Atlas of Midnight Cities',
    author: 'Cal Reyes',
    vibe: 'Speculative cityscapes',
    gradient: 'from-[#7ee8fa] to-[#5d26c1]',
  },
  {
    title: 'Saltwater Diaries',
    author: 'Nora Avery',
    vibe: 'Oceanic essays',
    gradient: 'from-[#1d976c] via-[#93f9b9] to-[#1d976c]',
  },
]

const initialTracker = []

const statusOptions = ['Reading', 'Want to Read', 'Read']

const defaultUsers = [
  {
    username: 'bookmosh',
    email: 'hello@bookmosh.com',
    password: 'booklove',
    friends: ['atlas'],
  },
  {
    username: 'atlas',
    email: 'atlas@readlane.io',
    password: 'pages',
    friends: ['bookmosh'],
  },
]

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

const parseStoryGraphJSON = (text) => {
  try {
    const parsed = JSON.parse(text)
    const entries =
      Array.isArray(parsed) &&
      parsed.length &&
      typeof parsed[0] === 'object'
        ? parsed
        : parsed?.library ??
          parsed?.books ??
          parsed?.userBooks ??
          parsed?.myBooks ??
          parsed
    if (!Array.isArray(entries)) return []
    return entries.map((entry) =>
      buildBookEntry({
        title: entry.title ?? entry.bookTitle ?? entry.name,
        author: entry.author ?? entry.authors?.[0],
        status: entry.status ?? entry.readingStatus ?? entry.shelf,
        progress: entry.percentComplete ?? entry.progress ?? entry.percent,
        mood: entry.notes ?? entry.mood,
        rating: entry.rating ?? entry.score,
      }),
    )
  } catch (error) {
    console.error('StoryGraph parse failed', error)
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
  const [selectedBook, setSelectedBook] = useState(null)
  const [modalRating, setModalRating] = useState(0)
  const [modalProgress, setModalProgress] = useState(0)
  const [modalStatus, setModalStatus] = useState(statusOptions[0])
  const [modalMood, setModalMood] = useState('')
  const [users, setUsers] = useState(defaultUsers)
  const [currentUser, setCurrentUser] = useState(null)
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
  }, [currentUser, users])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        const persistedUsers = parsed.users ?? defaultUsers
        setUsers(persistedUsers)
        if (parsed.currentUser) {
          const match = persistedUsers.find(
            (user) => user.username === parsed.currentUser,
          )
          if (match) {
            setCurrentUser(match)
          }
        }
      } catch (error) {
        console.error('Failed to parse auth storage', error)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        users,
        currentUser: currentUser?.username ?? null,
      }),
    )
  }, [users, currentUser])

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

  const fetchResults = async (term) => {
    if (!term?.trim()) {
      setHasSearched(false)
      setSearchResults([])
      return
    }
    setHasSearched(true)
    setIsSearching(true)
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(term)}&limit=6`,
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
      }))
      setSearchResults(mapped)
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

  const handleAddBook = (book) => {
    setTracker((prev) => {
      if (prev.some((item) => item.title === book.title)) return prev
      return [
        {
          title: book.title,
          author: book.author,
          status: 'Want to Read',
          progress: 0,
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

  const scrollToDiscovery = () => {
    if (typeof window === 'undefined') return
    document.getElementById('discovery')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleLogin = () => {
    setAuthMessage('')
    if (!authIdentifier.trim() || !authPassword.trim()) {
      setAuthMessage('Please enter both identifier and password.')
      return
    }
    const match = users.find((user) => matchesIdentifier(user, authIdentifier))
    if (!match || match.password !== authPassword) {
      setAuthMessage('Credentials did not match any profile.')
      return
    }
    setCurrentUser(match)
    setAuthIdentifier('')
    setAuthPassword('')
    setAuthMessage(`Welcome back, ${match.username}!`)
  }

  const handleSignup = () => {
    setAuthMessage('')
    const username = signupData.username.trim()
    const email = signupData.email.trim()
    const password = signupData.password.trim()
    if (!username || !email || !password) {
      setAuthMessage('Fill out all fields to create an account.')
      return
    }
    if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
      setAuthMessage('That username is already taken.')
      return
    }
    if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      setAuthMessage('An account already exists for that email.')
      return
    }
    const newUser = {
      username,
      email,
      password,
      friends: [],
    }
    setUsers((prev) => [...prev, newUser])
    setCurrentUser(newUser)
    setSignupData({ username: '', email: '', password: '' })
    setAuthMessage('Account created. Welcome to BookMosh!')
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setAuthMessage('Signed out')
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
      } else {
        imported = parseStoryGraphJSON(text)
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

  const handleAddFriend = () => {
    if (!currentUser) {
      setFriendMessage('Log in to add friends.')
      return
    }
    const query = friendQuery.trim()
    if (!query) {
      setFriendMessage('Enter a username or email.')
      return
    }
    const target = users.find((user) => matchesIdentifier(user, query))
    if (!target) {
      setFriendMessage('No matching profile found.')
      return
    }
    if (target.username === currentUser.username) {
      setFriendMessage('Add someone besides yourself.')
      return
    }
    if (currentUser.friends.includes(target.username)) {
      setFriendMessage('You are already connected.')
      return
    }
    const updatedUsers = users.map((user) => {
      if (user.username === currentUser.username) {
        return {
          ...user,
          friends: Array.from(new Set([...user.friends, target.username])),
        }
      }
      if (user.username === target.username) {
        return {
          ...user,
          friends: Array.from(new Set([...user.friends, currentUser.username])),
        }
      }
      return user
    })
    setUsers(updatedUsers)
    const refreshedCurrent = updatedUsers.find(
      (user) => user.username === currentUser.username,
    )
    setCurrentUser(refreshedCurrent)
    setFriendMessage(`Connected with ${target.username}!`)
    setFriendQuery('')
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
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-white/60">
              BookMosh Library
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Plot journeys at bookmosh.com
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-white/70">
              Mesh what you read, what you feel, and who you read with into one living shelf that updates
              along with you.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="rounded-full border border-white/30 px-5 py-2 text-sm uppercase tracking-wider text-white/80 transition hover:border-white/70 hover:text-white">
              Sync Shelf
            </button>
            <button className="rounded-full bg-gradient-to-r from-aurora to-white/70 px-6 py-2 text-sm font-semibold text-midnight transition hover:from-white/80">
              + New Log
            </button>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-r from-[#030617] via-[#040a1a] to-[#120029] p-8 text-white shadow-[0_30px_120px_rgba(5,2,20,0.65)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_55%)] opacity-40" />
          <div className="pointer-events-none absolute -right-8 top-1/3 h-52 w-52 rounded-full bg-[#9412ff]/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 left-4 h-40 w-40 rounded-full bg-[#2ee8d7]/30 blur-3xl" />
          <div className="relative flex flex-col gap-5">
            <p className="text-xs uppercase tracking-[0.6em] text-white/70">
              Bookmosh Codex
            </p>
            <h2 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
              A library that listens to the hush between the pages.
            </h2>
            <p className="max-w-2xl text-base text-white/70">
              Slip behind the velvet curtain. BookMosh stitches your moods, friends,
              and bookmarks into a single illuminated shelf so every decision about
              what to read next feels intentional.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  handleAuthModeSwitch('signup')
                  scrollToDiscovery()
                }}
                className="rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:bg-white/90"
              >
                Claim your shelf
              </button>
              <button
                onClick={scrollToDiscovery}
                className="rounded-full border border-white/40 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/70 hover:text-white"
              >
                Explore the discovery pool
              </button>
            </div>
            <p className="text-xs text-white/60">
              Your vault is private, synced with Supabase, and ready for whatever you
              breathe in next.
            </p>
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl bg-white/5 p-6 backdrop-blur-lg md:grid-cols-3">
          {['Reading', 'Want to Read', 'Read'].map((status) => (
            <div
              key={status}
              className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 duration-200 hover:border-white/40"
            >
              <p className="text-sm uppercase tracking-[0.3em] text-white/50">
                {status}
              </p>
              <p className="text-3xl font-semibold text-white">
                {statusSummary[status]}
              </p>
              <p className="text-xs text-white/60">
                {status === 'Read' ? 'Total books completed' : 'Currently active'}
              </p>
            </div>
          ))}
        </section>
        <section className="grid gap-8 lg:grid-cols-[2fr_1fr]" id="discovery">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl bg-white/5 p-6 shadow-[0_10px_60px_rgba(0,0,0,0.45)] backdrop-blur-lg">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/50">Discovery</p>
                  <h2 className="text-2xl font-semibold text-white">Search the open shelves</h2>
                </div>
                <p className="text-sm text-white/60">Open Library · instant results</p>
              </div>
              <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search authors, themes, or moods"
                  className="w-full bg-transparent px-4 py-3 text-white placeholder:text-white/40 focus:outline-none"
                />
                <button
                  onClick={() => fetchResults(searchQuery)}
                  className="mt-3 rounded-2xl bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-midnight transition hover:bg-white/80 sm:mt-0 sm:ml-3"
                >
                  {isSearching ? 'Scanning…' : 'Search'}
                </button>
              </div>
            </div>
            <div className="mt-6">
              {!hasSearched ? (
                <div className="rounded-2xl border border-white/10 bg-[#0b0f1f]/70 p-6 text-sm text-white/70">
                  <p className="text-lg font-semibold text-white">No search yet.</p>
                  <p className="mt-2 text-white/60">
                    Start typing to call up manuscripts, memoirs, and mood-heavy adventures from the Open Library. Your shelf stays clean until you decide otherwise.
                  </p>
                </div>
              ) : searchResults.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {searchResults.map((book) => (
                    <div
                      key={book.key}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#141b2d]/70 p-4 transition hover:border-white/40"
                    >
                      <div className="flex items-center gap-4">
                        {book.cover ? (
                          <img
                            src={book.cover}
                            alt={book.title}
                            className="h-20 w-16 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-white/10 to-white/5 text-xs uppercase tracking-[0.2em] text-white/60">
                            Cover
                          </div>
                        )}
                        <div className="flex flex-1 flex-col gap-1">
                          <p className="text-base font-semibold">{book.title}</p>
                          <p className="text-sm text-white/60">{book.author}</p>
                          <p className="text-xs text-white/40">{book.year ?? 'Year unknown'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAddBook(book)}
                          className="rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                        >
                          Track
                        </button>
                        <button
                          onClick={() => openModal(book)}
                          className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/50 transition hover:border-white/40 hover:text-white"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-[#0b0f1f]/70 p-6 text-sm text-white/70">
                  <p className="text-lg font-semibold text-white">No results</p>
                  <p className="mt-2 text-white/60">The Open Library came up empty. Try another phrase or a different vibe.</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-white">Reading tracker</h2>
                <p className="text-sm text-white/50">Updated moments ago</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {tracker.map((book) => (
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
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-6 backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/50">Story Scores</p>
                  <h3 className="text-2xl font-semibold text-white">Pulse</h3>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">7.8</p>
                  <p className="text-xs text-white/60">focused stories this week</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 text-sm">
                <p className="text-white/70">Balance introspection with a pulse of action: schedule micro-check-ins each evening and note the narrative that carried you today.</p>
                <p className="text-white/50">Need a mood reset? Tap any rec to drop it into your queue.</p>
              </div>
            </div>
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
                    className={`rounded-full px-3 py-1 transition ${authMode === 'signup' ? 'bg-white/10 text-white' : 'bg-white/0'}`}
                  >
                    Sign up
                  </button>
                </div>
              </div>
              {!currentUser ? (
                <div className="space-y-4">
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
              ) : (
                <div className="rounded-2xl border border-white/10 bg-[#0b1225]/70 p-4 text-sm text-white">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/60">Signed in as</p>
                  <p className="text-lg font-semibold">{currentUser.username}</p>
                  <p className="text-xs text-white/60">{currentUser.email}</p>
                  <button
                    onClick={handleLogout}
                    className="mt-3 rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40"
                  >
                    Log out
                  </button>
                </div>
              )}
              <p className="text-xs text-rose-300">{authMessage}</p>
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
                          <p className="text-sm font-semibold text-white">{friend.username}</p>
                          <p className="text-xs text-white/60">{friend.email}</p>
                        </div>
                        <span className="text-xs uppercase tracking-[0.3em] text-white/50">friend</span>
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
                    placeholder="Add by username or email"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                  />
                  <button
                    onClick={handleAddFriend}
                    className="w-full rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                  >
                    Send invite
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
                  {importFileType === 'goodreads' ? 'CSV file' : 'JSON file'}
                </span>
                <input
                  type="file"
                  accept={importFileType === 'goodreads' ? '.csv' : '.json'}
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
          </div>
        </section>

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
