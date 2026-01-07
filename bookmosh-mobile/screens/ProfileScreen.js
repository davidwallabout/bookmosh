import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { SvgXml } from 'react-native-svg'
import { supabase } from '../lib/supabase'
import { PROFILE_ICONS, getProfileAvatarUrl } from '../constants/avatars'

export default function ProfileScreen({ user, onSignOut }) {
  const navigation = useNavigation()
  const [currentUser, setCurrentUser] = useState(null)
  const [stats, setStats] = useState({ books: 0, friends: 0, pits: 0, reviews: 0 })
  const [readThisYearCount, setReadThisYearCount] = useState(0)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showUsernameEditor, setShowUsernameEditor] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [avatarIcon, setAvatarIcon] = useState('avatar_grin')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [topBooks, setTopBooks] = useState(['', '', '', ''])
  const [saving, setSaving] = useState(false)
  const [showTopBookModal, setShowTopBookModal] = useState(false)
  const [selectedTopBookSlot, setSelectedTopBookSlot] = useState(0)
  const [topBookSearch, setTopBookSearch] = useState('')
  const [topBookResults, setTopBookResults] = useState([])
  const [topBookSearching, setTopBookSearching] = useState(false)
  const [topBookMode, setTopBookMode] = useState('library')
  const [discoverQuery, setDiscoverQuery] = useState('')
  const [discoverResults, setDiscoverResults] = useState([])
  const [discoverSearching, setDiscoverSearching] = useState(false)
  const discoverTimeoutRef = useRef(null)

  const isCoverUrl = (value) => {
    const v = (value ?? '').toString().trim()
    return v.startsWith('http') || v.startsWith('data:image')
  }

  const normalizeTitle = (value) =>
    (value ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (userError) throw userError
      setCurrentUser(userData)
      setAvatarIcon(userData?.avatar_icon || 'avatar_grin')
      setAvatarUrl(userData?.avatar_url || '')

      const rawTop = Array.isArray(userData?.top_books) ? userData.top_books : []
      const topBooksArray = [rawTop[0] || '', rawTop[1] || '', rawTop[2] || '', rawTop[3] || '']

      const username = userData?.username
      const needsResolve = topBooksArray.some((v) => v && !isCoverUrl(v))
      if (username && needsResolve) {
        try {
          const { data: libraryRows, error: libraryError } = await supabase
            .from('bookmosh_books')
            .select('id, title, cover')
            .eq('owner', username)
            .limit(250)

          if (libraryError) throw libraryError

          const byTitle = new Map(
            (Array.isArray(libraryRows) ? libraryRows : []).map((b) => [normalizeTitle(b.title), b])
          )

          const resolved = topBooksArray.map((v) => {
            if (!v) return ''
            if (isCoverUrl(v)) return v
            const match = byTitle.get(normalizeTitle(v))
            return match?.cover && isCoverUrl(match.cover) ? match.cover : ''
          })

          setTopBooks(resolved)

          const anyResolved = resolved.some((v) => v && isCoverUrl(v))
          const changed = JSON.stringify(resolved) !== JSON.stringify(topBooksArray)
          if (anyResolved && changed) {
            await supabase
              .from('users')
              .update({ top_books: resolved, updated_at: new Date().toISOString() })
              .eq('id', user.id)
          }
        } catch (error) {
          console.error('Resolve top books error:', error)
          setTopBooks(topBooksArray)
        }
      } else {
        setTopBooks(topBooksArray)
      }

      // Load stats
      if (username) {
        const now = new Date()
        const year = now.getFullYear()
        const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0)).toISOString()
        const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)).toISOString()

        const { data: books } = await supabase
          .from('bookmosh_books')
          .select('id')
          .eq('owner', username)

        const { data: readThisYear } = await supabase
          .from('bookmosh_books')
          .select('id')
          .eq('owner', username)
          .eq('status', 'Read')
          .gte('updated_at', start)
          .lt('updated_at', end)

        const { data: moshes } = await supabase
          .from('moshes')
          .select('id')
          .contains('participants_ids', [user.id])
          .eq('archived', false)

        const { data: reviews } = await supabase
          .from('book_reviews')
          .select('id')
          .eq('owner_id', user.id)

        setReadThisYearCount(readThisYear?.length || 0)

        setStats({
          books: books?.length || 0,
          friends: userData?.friends?.length || 0,
          pits: moshes?.length || 0,
          reviews: reviews?.length || 0,
        })
      }
    } catch (error) {
      console.error('Load user data error:', error)
    }
  }

  const normalizeUsername = (value) => String(value || '').trim().toLowerCase()

  const validateUsername = (value) => {
    const v = normalizeUsername(value)
    if (!v) return { ok: false, message: 'Username is required' }
    if (v.length < 3) return { ok: false, message: 'Username must be at least 3 characters' }
    if (v.length > 20) return { ok: false, message: 'Username must be 20 characters or less' }
    if (!/^[a-z0-9_]+$/.test(v)) {
      return { ok: false, message: 'Username can only use letters, numbers, and underscore' }
    }
    return { ok: true, value: v }
  }

  const openUsernameEditor = () => {
    setUsernameDraft(currentUser?.username || '')
    setShowUsernameEditor(true)
  }

  const saveUsername = async () => {
    if (!currentUser) return

    const validation = validateUsername(usernameDraft)
    if (!validation.ok) {
      Alert.alert('Error', validation.message)
      return
    }

    const nextUsername = validation.value
    const prevUsername = currentUser.username

    if (!prevUsername) {
      Alert.alert('Error', 'Your current username is missing')
      return
    }

    if (normalizeUsername(prevUsername) === nextUsername) {
      setShowUsernameEditor(false)
      return
    }

    setSaving(true)
    try {
      const { data: existingUsers, error: existingErr } = await supabase
        .from('users')
        .select('id')
        .ilike('username', nextUsername)
        .limit(1)

      if (existingErr) throw existingErr

      const takenBySomeoneElse =
        Array.isArray(existingUsers) &&
        existingUsers.length > 0 &&
        existingUsers[0]?.id &&
        existingUsers[0].id !== currentUser.id

      if (takenBySomeoneElse) {
        Alert.alert('Username taken', 'That username is already taken. Please choose another.')
        return
      }

      const { error: updateUserErr } = await supabase
        .from('users')
        .update({ username: nextUsername, updated_at: new Date().toISOString() })
        .eq('id', currentUser.id)

      if (updateUserErr) throw updateUserErr

      // Migrate username references so content remains connected after rename.
      await supabase
        .from('bookmosh_books')
        .update({ owner: nextUsername, updated_at: new Date().toISOString() })
        .eq('owner', prevUsername)

      await supabase
        .from('lists')
        .update({ owner_username: nextUsername, updated_at: new Date().toISOString() })
        .eq('owner_id', currentUser.id)

      await supabase
        .from('book_events')
        .update({ owner_username: nextUsername })
        .eq('owner_id', currentUser.id)

      await supabase
        .from('friend_requests')
        .update({ requester_username: nextUsername })
        .eq('requester_id', currentUser.id)

      await supabase
        .from('friend_requests')
        .update({ recipient_username: nextUsername })
        .eq('recipient_id', currentUser.id)

      await supabase
        .from('mosh_messages')
        .update({ sender_username: nextUsername })
        .eq('sender_id', currentUser.id)

      setShowUsernameEditor(false)
      await loadUserData()
      Alert.alert('Success', 'Username updated')
    } catch (error) {
      console.error('Update username error:', error)
      Alert.alert('Error', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: onSignOut },
      ]
    )
  }

  const selectAvatarIcon = async (iconId) => {
    setAvatarIcon(iconId)
    setAvatarUrl('')
    setShowAvatarPicker(false)
    await updateAvatar(iconId, '')
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    })

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`
      setAvatarUrl(base64Image)
      setAvatarIcon('')
      setShowAvatarPicker(false)
      await updateAvatar('', base64Image)
    }
  }

  const updateAvatar = async (icon, url) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          avatar_icon: url ? null : icon,
          avatar_url: url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error
      await loadUserData()
    } catch (error) {
      Alert.alert('Error', error.message)
    } finally {
      setSaving(false)
    }
  }

  const navigateToTab = (tabName) => {
    navigation.navigate('Tabs', { screen: tabName })
  }

  const openTopBookPicker = (slotIndex) => {
    setSelectedTopBookSlot(slotIndex)
    setShowTopBookModal(true)
    setTopBookMode('library')
    setDiscoverQuery('')
    setDiscoverResults([])
    loadUserBooks()
  }

  const invokeIsbndbSearch = async ({ q, pageSize = 20 }) => {
    try {
      const { data, error } = await supabase.functions.invoke('isbndb-search', {
        body: { q, pageSize },
      })

      if (error) {
        const supabaseUrl = supabase.supabaseUrl
        const supabaseKey = supabase.supabaseKey

        if (supabaseUrl && supabaseKey) {
          const response = await fetch(`${supabaseUrl}/functions/v1/isbndb-search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
            body: JSON.stringify({ q, pageSize }),
          })

          if (response.ok) {
            const fallbackData = await response.json()
            return fallbackData
          }
        }

        return { books: [] }
      }

      return data
    } catch (error) {
      console.error('ISBNdb search error:', error)
      return { books: [] }
    }
  }

  const computeRelevance = (title, author, termWords) => {
    let score = 0
    const titleLower = (title || '').toLowerCase()
    const authorLower = (author || '').toLowerCase()

    for (const word of termWords) {
      const wordLower = word.toLowerCase()
      if (titleLower.includes(wordLower)) score += 2
      if (authorLower.includes(wordLower)) score += 1
    }
    return score
  }

  const searchDiscoverBooks = async (query) => {
    const q = String(query || '').trim()
    if (q.length < 2) {
      setDiscoverResults([])
      return
    }

    setDiscoverSearching(true)
    try {
      const termWords = q.split(/\s+/).filter(Boolean)
      const isbndbData = await invokeIsbndbSearch({ q, pageSize: 50 })

      const isbndbBooks = Array.isArray(isbndbData?.books)
        ? isbndbData.books
        : Array.isArray(isbndbData?.data)
        ? isbndbData.data
        : []

      const mapped = isbndbBooks
        .map((b) => {
          if (!b) return null
          const title = b.title ?? b.title_long ?? null
          if (!title) return null

          const authors = Array.isArray(b.authors) ? b.authors : []
          const author = authors[0] ?? b.author ?? 'Unknown author'
          const isbn13 = b.isbn13 ?? null
          const isbn = isbn13 || b.isbn || b.isbn10 || null

          let cover = b.image || b.image_url || null
          if (typeof cover === 'string' && cover.startsWith('http://')) {
            cover = `https://${cover.slice('http://'.length)}`
          }

          const relevance = computeRelevance(title, author, termWords)

          return {
            key: isbn || `${title}-${author}`,
            title,
            author,
            cover,
            isbn,
            relevance,
          }
        })
        .filter(Boolean)

      mapped.sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
      setDiscoverResults(mapped)
    } catch (error) {
      console.error('Discover search error:', error)
      setDiscoverResults([])
    } finally {
      setDiscoverSearching(false)
    }
  }

  useEffect(() => {
    if (!showTopBookModal) return
    if (topBookMode !== 'discover') return

    if (discoverTimeoutRef.current) {
      clearTimeout(discoverTimeoutRef.current)
    }

    if (!discoverQuery || discoverQuery.trim().length < 2) {
      setDiscoverResults([])
      return
    }

    discoverTimeoutRef.current = setTimeout(() => {
      searchDiscoverBooks(discoverQuery)
    }, 500)

    return () => {
      if (discoverTimeoutRef.current) {
        clearTimeout(discoverTimeoutRef.current)
      }
    }
  }, [discoverQuery, showTopBookModal, topBookMode])

  const loadUserBooks = async () => {
    if (!currentUser) return
    setTopBookSearching(true)
    try {
      const { data, error } = await supabase
        .from('bookmosh_books')
        .select('*')
        .eq('owner', currentUser.username)
        .order('updated_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setTopBookResults(data || [])
    } catch (error) {
      console.error('Load user books error:', error)
    } finally {
      setTopBookSearching(false)
    }
  }

  const selectTopBook = async (book) => {
    const newTopBooks = [...topBooks]
    newTopBooks[selectedTopBookSlot] = book.cover || ''
    setTopBooks(newTopBooks)
    setShowTopBookModal(false)

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          top_books: newTopBooks,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error
    } catch (error) {
      console.error('Update top books error:', error)
      Alert.alert('Error', 'Failed to update top books')
    } finally {
      setSaving(false)
    }
  }

  const removeTopBook = async (slotIndex) => {
    const newTopBooks = [...topBooks]
    newTopBooks[slotIndex] = ''
    setTopBooks(newTopBooks)

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          top_books: newTopBooks,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error
    } catch (error) {
      console.error('Update top books error:', error)
      Alert.alert('Error', 'Failed to update top books')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {navigation?.canGoBack && navigation.canGoBack() ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => setShowAvatarPicker(true)}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <SvgXml
                  xml={PROFILE_ICONS.find(i => i.id === avatarIcon)?.svg || PROFILE_ICONS[0].svg}
                  width="100%"
                  height="100%"
                />
              </View>
            )}
            <View style={styles.editBadge}>
              <Text style={styles.editBadgeText}>✎</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.username}>@{currentUser?.username || 'User'}</Text>
          <Text style={styles.email}>{currentUser?.email || ''}</Text>
        </View>

        <View style={styles.statsSection}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigateToTab('Library')}
          >
            <Text style={styles.statValue}>{stats.books}</Text>
            <Text style={styles.statLabel}>Books</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigation.navigate('ReadByYearScreen', { initialYear: new Date().getFullYear() })}
          >
            <Text style={styles.statValue}>{readThisYearCount}</Text>
            <Text style={styles.statLabel}>Read This Year</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigateToTab('Community')}
          >
            <Text style={styles.statValue}>{stats.friends}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigateToTab('Pits')}
          >
            <Text style={styles.statValue}>{stats.pits}</Text>
            <Text style={styles.statLabel}>Pits</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigation.navigate('MyReviewsScreen')}
          >
            <Text style={styles.statValue}>{stats.reviews}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TOP 4 BOOKS</Text>
          <View style={styles.topBooksGrid}>
            {topBooks.map((bookCover, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.topBookSlot}
                onPress={() => openTopBookPicker(index)}
                onLongPress={() => bookCover && removeTopBook(index)}
              >
                {bookCover && bookCover.trim() !== '' && isCoverUrl(bookCover) ? (
                  <Image 
                    source={{ uri: bookCover }} 
                    style={styles.topBookCover}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.topBookPlaceholder}>
                    <Text style={styles.topBookPlaceholderText}>+</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Username</Text>
            <View style={styles.infoValueRow}>
              <Text style={styles.infoValue}>{currentUser?.username || 'N/A'}</Text>
              <TouchableOpacity
                style={styles.infoEditButton}
                onPress={openUsernameEditor}
                disabled={!currentUser?.username}
              >
                <Text style={styles.infoEditButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{currentUser?.email || 'N/A'}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>
              {currentUser?.created_at
                ? new Date(currentUser.created_at).toLocaleDateString()
                : 'N/A'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showTopBookModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopBookModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Book for Slot {selectedTopBookSlot + 1}</Text>
              <TouchableOpacity onPress={() => setShowTopBookModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.topBookModeRow}>
              <TouchableOpacity
                style={[styles.topBookModeButton, topBookMode === 'library' && styles.topBookModeButtonActive]}
                onPress={() => setTopBookMode('library')}
              >
                <Text style={[styles.topBookModeButtonText, topBookMode === 'library' && styles.topBookModeButtonTextActive]}>Library</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.topBookModeButton, topBookMode === 'discover' && styles.topBookModeButtonActive]}
                onPress={() => {
                  setTopBookMode('discover')
                  setDiscoverResults([])
                }}
              >
                <Text style={[styles.topBookModeButtonText, topBookMode === 'discover' && styles.topBookModeButtonTextActive]}>Discover</Text>
              </TouchableOpacity>
            </View>

            {topBookMode === 'discover' && (
              <View style={styles.topBookSearchRow}>
                <TextInput
                  style={styles.topBookSearchInput}
                  placeholder="Search any book..."
                  placeholderTextColor="#666"
                  value={discoverQuery}
                  onChangeText={setDiscoverQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.topBookSearchButton, discoverSearching && styles.topBookSearchButtonDisabled]}
                  onPress={() => searchDiscoverBooks(discoverQuery)}
                  disabled={discoverSearching}
                >
                  {discoverSearching ? (
                    <ActivityIndicator size="small" color="#3b82f6" />
                  ) : (
                    <Text style={styles.topBookSearchButtonText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {topBookMode === 'library' && topBookSearching ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            ) : topBookMode === 'library' ? (
              <ScrollView style={styles.modalScroll}>
                {topBookResults.map((book) => (
                  <TouchableOpacity
                    key={book.id}
                    style={styles.bookOption}
                    onPress={() => selectTopBook(book)}
                  >
                    {book.cover ? (
                      <Image source={{ uri: book.cover }} style={styles.bookOptionCover} />
                    ) : (
                      <View style={styles.bookOptionCoverPlaceholder}>
                        <Text style={styles.bookOptionPlaceholderText}>📚</Text>
                      </View>
                    )}
                    <View style={styles.bookOptionInfo}>
                      <Text style={styles.bookOptionTitle} numberOfLines={2}>
                        {book.title}
                      </Text>
                      <Text style={styles.bookOptionAuthor} numberOfLines={1}>
                        {book.author}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {topBookResults.length === 0 && (
                  <Text style={styles.modalEmptyText}>
                    No books in your library yet. Add some books first!
                  </Text>
                )}
              </ScrollView>
            ) : (
              <ScrollView style={styles.modalScroll}>
                {discoverResults.map((book) => (
                  <TouchableOpacity
                    key={book.key}
                    style={styles.bookOption}
                    onPress={() => {
                      if (!book.cover) {
                        Alert.alert('No cover found', 'This book does not have a cover image to use for Top 4.')
                        return
                      }
                      selectTopBook({ id: book.key, title: book.title, author: book.author, cover: book.cover })
                    }}
                  >
                    {book.cover ? (
                      <Image source={{ uri: book.cover }} style={styles.bookOptionCover} />
                    ) : (
                      <View style={styles.bookOptionCoverPlaceholder}>
                        <Text style={styles.bookOptionPlaceholderText}>📚</Text>
                      </View>
                    )}
                    <View style={styles.bookOptionInfo}>
                      <Text style={styles.bookOptionTitle} numberOfLines={2}>
                        {book.title}
                      </Text>
                      <Text style={styles.bookOptionAuthor} numberOfLines={1}>
                        {book.author}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {!discoverSearching && discoverQuery.trim().length >= 2 && discoverResults.length === 0 && (
                  <Text style={styles.modalEmptyText}>
                    No books found. Try another search.
                  </Text>
                )}
                {!discoverSearching && discoverQuery.trim().length < 2 && (
                  <Text style={styles.modalEmptyText}>
                    Type at least 2 characters to search.
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showUsernameEditor}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUsernameEditor(false)}
      >
        <View style={styles.avatarModalOverlay}>
          <View style={styles.avatarModalContent}>
            <Text style={styles.avatarModalTitle}>Edit Username</Text>

            <TextInput
              style={styles.usernameInput}
              value={usernameDraft}
              onChangeText={setUsernameDraft}
              placeholder="username"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />

            <TouchableOpacity style={styles.usernameSaveButton} onPress={saveUsername}>
              <Text style={styles.usernameSaveButtonText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowUsernameEditor(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAvatarPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarPicker(false)}
      >
        <View style={styles.avatarModalOverlay}>
          <View style={styles.avatarModalContent}>
            <Text style={styles.avatarModalTitle}>Choose Avatar</Text>
            
            <View style={styles.avatarGrid}>
              {PROFILE_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon.id}
                  style={[
                    styles.avatarOption,
                    avatarIcon === icon.id && !avatarUrl && styles.avatarOptionSelected,
                  ]}
                  onPress={() => selectAvatarIcon(icon.id)}
                >
                  <SvgXml xml={icon.svg} width="100%" height="100%" />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <Text style={styles.uploadButtonText}>Upload Custom Image</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAvatarPicker(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3b82f6',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#020617',
  },
  editBadgeText: {
    fontSize: 16,
    color: '#fff',
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  email: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  statsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  statCard: {
    width: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1.5,
    marginBottom: 15,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  infoValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  infoEditButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(238, 107, 254, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(238, 107, 254, 0.35)',
  },
  infoEditButtonText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#ee6bfe',
    textTransform: 'uppercase',
  },
  signOutButton: {
    margin: 20,
    marginTop: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 16,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  topBooksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  topBookSlot: {
    width: '48%',
    aspectRatio: 2/3,
    overflow: 'hidden',
    borderRadius: 8,
  },
  topBookCover: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  topBookPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBookPlaceholderText: {
    fontSize: 40,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  topBookModeRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topBookModeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  topBookModeButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  topBookModeButtonText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  topBookModeButtonTextActive: {
    color: '#fff',
  },
  topBookSearchRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  topBookSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  topBookSearchButton: {
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 86,
  },
  topBookSearchButtonDisabled: {
    opacity: 0.6,
  },
  topBookSearchButtonText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#3b82f6',
    textTransform: 'uppercase',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modalClose: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '300',
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  modalScroll: {
    maxHeight: 500,
  },
  bookOption: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  bookOptionCover: {
    width: 60,
    height: 90,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 12,
  },
  bookOptionCoverPlaceholder: {
    width: 60,
    height: 90,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bookOptionPlaceholderText: {
    fontSize: 30,
  },
  bookOptionInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  bookOptionAuthor: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  modalEmptyText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    padding: 40,
  },
  avatarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  avatarModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  avatarOption: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  avatarOptionSelected: {
    borderColor: '#3b82f6',
    borderWidth: 3,
  },
  uploadButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  usernameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  usernameSaveButton: {
    backgroundColor: 'rgba(238, 107, 254, 0.12)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(238, 107, 254, 0.35)',
  },
  usernameSaveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ee6bfe',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
