import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  PanResponder,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'

import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg'

const statusOptions = ['Reading', 'To Read', 'Read']

const StarSvg = ({ fraction = 0, size = 32 }) => {
  const clipId = useRef(`clip_${Math.random().toString(36).slice(2)}`).current
  const clamped = Math.max(0, Math.min(1, Number(fraction) || 0))
  const clipWidth = 24 * clamped
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <ClipPath id={clipId}>
          <Rect x="0" y="0" width={clipWidth} height="24" />
        </ClipPath>
      </Defs>
      <Path
        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
        fill="rgba(255, 255, 255, 0.2)"
      />
      <Path
        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
        fill="#fbbf24"
        clipPath={`url(#${clipId})`}
      />
    </Svg>
  )
}

export default function BookDetailScreen({ user }) {
  const navigation = useNavigation()
  const route = useRoute()
  const bookId = route.params?.bookId
  const searchBook = route.params?.book

  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [bookActivity, setBookActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)

  const [reviewModalVisible, setReviewModalVisible] = useState(false)
  const [reviewThreadLoading, setReviewThreadLoading] = useState(false)
  const [reviewThread, setReviewThread] = useState(null)
  const [reviewLikes, setReviewLikes] = useState({ count: 0, likedByMe: false, users: [] })
  const [reviewComments, setReviewComments] = useState([])
  const [reviewCommentDraft, setReviewCommentDraft] = useState('')
  const [showSpoiler, setShowSpoiler] = useState(false)

  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [status, setStatus] = useState('')
  const [rating, setRating] = useState(0)
  const [progress, setProgress] = useState(0)
  const [review, setReview] = useState('')
  const [spoilerWarning, setSpoilerWarning] = useState(false)
  const [isOwned, setIsOwned] = useState(false)

  const [showRecommendationModal, setShowRecommendationModal] = useState(false)
  const [recommendationNote, setRecommendationNote] = useState('')
  const [selectedRecommendationRecipients, setSelectedRecommendationRecipients] = useState([])
  const [sendingRecommendation, setSendingRecommendation] = useState(false)

  const [showEditionsModal, setShowEditionsModal] = useState(false)
  const [editions, setEditions] = useState([])
  const [loadingEditions, setLoadingEditions] = useState(false)

  const [buttonFeedback, setButtonFeedback] = useState({}) // { buttonKey: 'check' | 'x' }
  const feedbackOpacity = useRef(new Animated.Value(0)).current

  const starsContainerRef = useRef(null)
  const starsLayoutRef = useRef({ width: 0 })
  const pendingRatingRef = useRef(0)
  const saveRatingRef = useRef(null)

  const calculateRatingFromLocationX = (locationX) => {
    const { width } = starsLayoutRef.current
    if (!width) return 0

    const relativeX = locationX
    const starWidth = width / 5
    const rawRating = relativeX / starWidth
    const rounded = Math.round(rawRating * 2) / 2
    return Math.max(0, Math.min(5, rounded))
  }

  const ratingPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const newRating = calculateRatingFromLocationX(evt.nativeEvent.locationX)
        pendingRatingRef.current = newRating
        setRating(newRating)
      },
      onPanResponderMove: (evt) => {
        const newRating = calculateRatingFromLocationX(evt.nativeEvent.locationX)
        pendingRatingRef.current = newRating
        setRating(newRating)
      },
      onPanResponderRelease: () => {
        if (saveRatingRef.current) {
          saveRatingRef.current(pendingRatingRef.current)
        }
      },
      onPanResponderTerminate: () => {
        if (saveRatingRef.current) {
          saveRatingRef.current(pendingRatingRef.current)
        }
      },
    })
  ).current

  const showButtonFeedback = (buttonKey, type) => {
    setButtonFeedback({ [buttonKey]: type })
    feedbackOpacity.setValue(1)
    Animated.timing(feedbackOpacity, {
      toValue: 0,
      duration: 800,
      delay: 400,
      useNativeDriver: true,
    }).start(() => setButtonFeedback({}))
  }

  useEffect(() => {
    loadCurrentUser()
    if (bookId) {
      loadBook()
    } else if (searchBook) {
      // New book from search results - set up for adding to library
      setTitle(searchBook.title || '')
      setAuthor(searchBook.author || '')
      setBook({
        title: searchBook.title,
        author: searchBook.author,
        cover: searchBook.cover,
        isbn: searchBook.isbn,
        year: searchBook.year,
      })
      setLoading(false)
    } else {
      setLoading(false)
    }
  }, [bookId, searchBook])

  const openReviewThread = async (eventItem) => {
    if (!currentUser?.id || !eventItem?.owner_username || !eventItem?.book_title) return

    setReviewModalVisible(true)
    setReviewThreadLoading(true)
    setReviewThread(null)
    setReviewLikes({ count: 0, likedByMe: false, users: [] })
    setReviewComments([])
    setReviewCommentDraft('')
    setShowSpoiler(false)

    try {
      const { data: books, error: bookError } = await supabase
        .from('bookmosh_books')
        .select('id, owner, title, author, cover, review, spoiler_warning, created_at, updated_at')
        .eq('owner', eventItem.owner_username)
        .eq('title', eventItem.book_title)
        .limit(1)

      if (bookError) throw bookError
      const bookRow = Array.isArray(books) ? books[0] : null
      if (!bookRow?.id) {
        setReviewThread(null)
        return
      }

      setReviewThread({
        ...bookRow,
        reviewer_username: eventItem.owner_username,
      })

      const reviewId = bookRow.id
      const [{ data: likesData }, { data: commentsData }] = await Promise.all([
        supabase.from('review_likes').select('review_id, user_id, username').eq('review_id', reviewId),
        supabase.from('review_comments').select('*').eq('review_id', reviewId).order('created_at', { ascending: true }),
      ])

      const likes = likesData || []
      setReviewLikes({
        count: likes.length,
        likedByMe: likes.some((l) => l.user_id === currentUser.id),
        users: likes.map((l) => l.username),
      })
      setReviewComments(commentsData || [])
    } catch (error) {
      console.error('[BOOK] Open review thread failed:', error)
    } finally {
      setReviewThreadLoading(false)
    }
  }

  const toggleReviewLike = async () => {
    if (!currentUser?.id || !reviewThread?.id) return
    const reviewId = reviewThread.id
    const current = reviewLikes || { count: 0, likedByMe: false, users: [] }

    try {
      if (current.likedByMe) {
        await supabase.from('review_likes').delete().eq('review_id', reviewId).eq('user_id', currentUser.id)
        setReviewLikes((prev) => ({
          count: Math.max(0, (prev?.count ?? 1) - 1),
          likedByMe: false,
          users: (prev?.users ?? []).filter((u) => u !== currentUser.username),
        }))
      } else {
        const { error } = await supabase.from('review_likes').insert({
          review_id: reviewId,
          user_id: currentUser.id,
          username: currentUser.username,
        })
        if (error) throw error
        setReviewLikes((prev) => ({
          count: (prev?.count ?? 0) + 1,
          likedByMe: true,
          users: [...(prev?.users ?? []), currentUser.username],
        }))
      }
    } catch (error) {
      console.error('[BOOK] Toggle review like failed:', error)
    }
  }

  const postReviewComment = async () => {
    if (!currentUser?.id || !reviewThread?.id) return
    const body = String(reviewCommentDraft || '').trim()
    if (!body) return

    try {
      const { error } = await supabase.from('review_comments').insert({
        review_id: reviewThread.id,
        commenter_id: currentUser.id,
        commenter_username: currentUser.username,
        body,
      })
      if (error) throw error
      setReviewCommentDraft('')
      const { data } = await supabase
        .from('review_comments')
        .select('*')
        .eq('review_id', reviewThread.id)
        .order('created_at', { ascending: true })
      setReviewComments(data || [])
    } catch (error) {
      console.error('[BOOK] Post review comment failed:', error)
    }
  }

  useEffect(() => {
    if (!currentUser || !book?.title) return
    loadBookActivity(book.title)
  }, [currentUser?.id, book?.title])

  const loadCurrentUser = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setCurrentUser(data)
    } catch (error) {
      console.error('Load user error:', error)
    }
  }

  const loadBook = async () => {
    try {
      const { data, error } = await supabase
        .from('bookmosh_books')
        .select('*')
        .eq('id', bookId)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        // Book was not found (deleted or wrong id). Don't treat as hard error.
        setBook(null)
        setLoading(false)
        return
      }
      
      setBook(data)
      setTitle(data.title || '')
      setAuthor(data.author || '')
      setStatus(data.status || '')
      setRating(data.rating || 0)
      setProgress(data.progress || 0)
      setReview(data.review || '')
      setSpoilerWarning(data.spoiler_warning || false)
      setIsOwned(Array.isArray(data.tags) && data.tags.includes('Owned'))
    } catch (error) {
      console.error('Load book error:', error)
      Alert.alert('Error', 'Failed to load book details')
    } finally {
      setLoading(false)
    }
  }

  const loadBookActivity = async (bookTitle) => {
    if (!currentUser || !bookTitle) return
    setActivityLoading(true)
    try {
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
      setBookActivity(data || [])
    } catch (error) {
      console.error('Failed to load book activity:', error)
      setBookActivity([])
    } finally {
      setActivityLoading(false)
    }
  }

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

  const debounceRef = useRef(null)

  const updateBookRow = async (dbUpdates, { eventType, nextTags } = {}) => {
    if (!bookId) return
    if (!currentUser?.id || !currentUser?.username) return

    setSaving(true)
    try {
      const nowIso = new Date().toISOString()
      const payload = { ...dbUpdates, updated_at: nowIso }

      let { error } = await supabase
        .from('bookmosh_books')
        .update(payload)
        .eq('id', bookId)

      if (error && String(error.code) === '42703') {
        const msg = String(error.message || '')
        const fallbackPayload = { ...payload }
        if (msg.includes('read_at')) delete fallbackPayload.read_at
        if (msg.includes('status_updated_at')) delete fallbackPayload.status_updated_at
        if (msg.includes('spoiler_warning')) delete fallbackPayload.spoiler_warning

        ;({ error } = await supabase
          .from('bookmosh_books')
          .update(fallbackPayload)
          .eq('id', bookId))
      }

      if (error) throw error

      if (eventType) {
        try {
          await supabase
            .from('book_events')
            .insert([
              {
                owner_id: currentUser.id,
                owner_username: currentUser.username,
                book_title: title.trim(),
                book_author: (author.trim() || 'Unknown author'),
                book_cover: book?.cover ?? null,
                tags: nextTags,
                event_type: eventType,
              },
            ])
        } catch (eventErr) {
          console.error('book_events insert failed:', eventErr)
        }
      }

      setBook((prev) => ({ ...(prev || {}), ...payload }))
      if (eventType) {
        await loadBookActivity(title.trim())
      }
    } catch (error) {
      console.error('Auto-save book error:', error)
      Alert.alert('Error', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (nextStatus) => {
    const currentStatus = status || book?.status || ''
    const isTogglingOff = currentStatus === nextStatus
    const finalStatus = isTogglingOff ? '' : nextStatus

    const owned = Boolean(isOwned)
    const nextTags = Array.from(new Set([...(finalStatus ? [finalStatus] : []), ...(owned ? ['Owned'] : [])]))
    const nowIso = new Date().toISOString()

    const isMarkingRead = finalStatus === 'Read' && currentStatus !== 'Read'
    const isLeavingRead = finalStatus !== 'Read' && currentStatus === 'Read'
    const nextReadAt = isMarkingRead ? nowIso : isLeavingRead ? null : (book?.read_at ?? null)

    const nextProgress = finalStatus === 'Read' ? 100 : finalStatus === 'To Read' ? 0 : finalStatus ? progress : 0

    setStatus(finalStatus)
    setProgress(nextProgress)

    // If this is a new book from search (no bookId), add it to library
    if (!bookId && currentUser && book) {
      try {
        const payload = {
          owner: currentUser.username,
          title: book.title,
          author: book.author,
          cover: book.cover,
          status: finalStatus,
          tags: nextTags,
          progress: nextProgress,
          rating: 0,
          read_at: nextReadAt,
          status_updated_at: nowIso,
        }

        console.log('[ADD BOOK] Adding from book details:', payload)
        const { error } = await supabase.from('bookmosh_books').upsert([payload], { onConflict: 'owner,title' })
        
        if (error) {
          console.error('[ADD BOOK] Insert error:', error)
        } else {
          showButtonFeedback(nextStatus, isTogglingOff ? 'x' : 'check')
        }
      } catch (error) {
        console.error('[ADD BOOK] Error:', error)
      }
      return
    }

    await updateBookRow(
      {
        status: finalStatus,
        tags: nextTags,
        progress: nextProgress,
        read_at: nextReadAt,
        status_updated_at: nowIso,
      },
      { eventType: 'status_changed', nextTags }
    )
    showButtonFeedback(nextStatus, isTogglingOff ? 'x' : 'check')
  }

  const handleOwnedToggle = async () => {
    const nextOwned = !isOwned
    const currentStatus = status || 'To Read'
    const nextTags = Array.from(new Set([currentStatus, ...(nextOwned ? ['Owned'] : [])]))

    setIsOwned(nextOwned)

    // If this is a new book from search (no bookId), add it to library
    if (!bookId && currentUser && book) {
      try {
        const nowIso = new Date().toISOString()
        const payload = {
          owner: currentUser.username,
          title: book.title,
          author: book.author,
          cover: book.cover,
          status: currentStatus,
          tags: nextTags,
          progress: 0,
          rating: 0,
          status_updated_at: nowIso,
        }

        console.log('[ADD BOOK] Adding from owned toggle:', payload)
        const { error } = await supabase.from('bookmosh_books').upsert([payload], { onConflict: 'owner,title' })
        
        if (error) {
          console.error('[ADD BOOK] Insert error:', error)
        } else {
          showButtonFeedback('Owned', nextOwned ? 'check' : 'x')
        }
      } catch (error) {
        console.error('[ADD BOOK] Error:', error)
      }
      return
    }

    await updateBookRow(
      {
        tags: nextTags,
      },
      { eventType: 'tags_updated', nextTags }
    )
    showButtonFeedback('Owned', nextOwned ? 'check' : 'x')
  }

  const handleRatingChange = async (value) => {
    setRating(value)
    await updateBookRow({ rating: value })
  }

  saveRatingRef.current = handleRatingChange

  const scheduleDebouncedUpdate = (updates) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      updateBookRow(updates)
    }, 800)
  }

  const handleSpoilerToggle = async () => {
    const newValue = !spoilerWarning
    setSpoilerWarning(newValue)
    await updateBookRow({ spoiler_warning: newValue })
  }

  const deleteBook = async () => {
    Alert.alert(
      'Delete Book',
      'Are you sure you want to delete this book?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bookmosh_books')
                .delete()
                .eq('id', bookId)

              if (error) throw error
              Alert.alert('Success', 'Book deleted')
              navigation.goBack()
            } catch (error) {
              console.error('Delete book error:', error)
              Alert.alert('Error', error.message)
            }
          },
        },
      ]
    )
  }

  const navigateToAuthorSearch = () => {
    if (!author) return
    navigation.navigate('Tabs', {
      screen: 'Discovery',
      params: { initialQuery: author },
    })
  }

  const searchEditions = async () => {
    if (!title) {
      Alert.alert('Error', 'Please enter a book title first')
      return
    }

    setShowEditionsModal(true)
    setLoadingEditions(true)
    setEditions([])

    try {
      const supabaseUrl = supabase.supabaseUrl
      const supabaseKey = supabase.supabaseKey
      
      if (supabaseUrl && supabaseKey) {
        const response = await fetch(`${supabaseUrl}/functions/v1/isbndb-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ q: title.trim(), pageSize: 20 }),
        })

        if (response.ok) {
          const data = await response.json()
          const books = Array.isArray(data?.books) ? data.books : []
          
          const mapped = books.map((b) => ({
            title: b.title || b.title_long || '',
            author: Array.isArray(b.authors) ? b.authors[0] : (b.author || ''),
            cover: (b.image || b.image_url || '').replace(/^http:\/\//, 'https://'),
            isbn: b.isbn13 || b.isbn || b.isbn10 || null,
            year: b.date_published ? Number(String(b.date_published).slice(0, 4)) : null,
          })).filter(b => b.title)

          setEditions(mapped)
        }
      }
    } catch (error) {
      console.error('Failed to search editions:', error)
      Alert.alert('Error', 'Failed to load editions')
    } finally {
      setLoadingEditions(false)
    }
  }

  const selectEdition = async (edition) => {
    setTitle(edition.title)
    setAuthor(edition.author || author)
    setBook({
      ...book,
      title: edition.title,
      author: edition.author || author,
      cover: edition.cover,
      isbn: edition.isbn,
      year: edition.year,
    })

    if (bookId) {
      await updateBookRow({
        title: edition.title,
        author: edition.author || author,
        cover: edition.cover,
      })
    }

    setShowEditionsModal(false)
  }

  const openRecommendationComposer = () => {
    if (!currentUser?.friends) {
      Alert.alert('Error', 'Your profile is still loading. Try again in a moment.')
      return
    }
    const friends = Array.isArray(currentUser.friends) ? currentUser.friends : []
    if (friends.length === 0) {
      Alert.alert('No friends yet', 'Add friends first, then you can send recommendations.')
      return
    }

    setRecommendationNote('')
    setSelectedRecommendationRecipients([])
    setShowRecommendationModal(true)
  }

  const toggleRecipient = (username) => {
    setSelectedRecommendationRecipients((prev) => {
      if (prev.includes(username)) return prev.filter((u) => u !== username)
      return [...prev, username]
    })
  }

  const sendRecommendations = async () => {
    if (!currentUser?.id || !currentUser?.username) return
    const recipients = Array.isArray(selectedRecommendationRecipients)
      ? selectedRecommendationRecipients
      : []

    if (recipients.length === 0) {
      Alert.alert('Select friends', 'Pick at least one friend to send this recommendation to.')
      return
    }

    const bookTitle = title.trim()
    if (!bookTitle) {
      Alert.alert('Error', 'Book title is required to send a recommendation.')
      return
    }

    setSendingRecommendation(true)
    try {
      const { data: recipientRows, error: recipientErr } = await supabase
        .from('users')
        .select('id, username')
        .in('username', recipients)
        .limit(200)

      if (recipientErr) throw recipientErr

      const byUsername = new Map((recipientRows || []).map((u) => [u.username, u]))
      const missing = recipients.filter((u) => !byUsername.has(u))
      if (missing.length > 0) {
        Alert.alert('Some friends missing', `Could not find: ${missing.join(', ')}`)
      }

      const payload = recipients
        .map((u) => {
          const row = byUsername.get(u)
          if (!row?.id) return null
          return {
            sender_id: currentUser.id,
            sender_username: currentUser.username,
            recipient_id: row.id,
            recipient_username: row.username,
            book_title: bookTitle,
            book_author: (author || '').trim() || null,
            book_cover: book?.cover ?? null,
            note: recommendationNote.trim() || null,
          }
        })
        .filter(Boolean)

      if (payload.length === 0) {
        Alert.alert('Error', 'No valid recipients found to send to.')
        return
      }

      const { error } = await supabase.from('recommendations').insert(payload)
      if (error) throw error

      setShowRecommendationModal(false)
      Alert.alert('Sent!', 'Your recommendation was sent.')
    } catch (error) {
      console.error('Send recommendation error:', error)
      Alert.alert('Error', error.message)
    } finally {
      setSendingRecommendation(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Details</Text>
        <TouchableOpacity onPress={deleteBook} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {book?.cover ? (
          <TouchableOpacity 
            style={styles.coverContainer}
            onPress={searchEditions}
            activeOpacity={0.8}
          >
            <Image source={{ uri: book.cover }} style={styles.cover} />
            <View style={styles.coverOverlay}>
              <Text style={styles.coverOverlayText}>Tap to change edition</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.coverPlaceholder}
            onPress={searchEditions}
            activeOpacity={0.8}
          >
            <Text style={styles.coverPlaceholderText}>📚</Text>
            <Text style={styles.coverPlaceholderSubtext}>Tap to select edition</Text>
          </TouchableOpacity>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={(v) => {
              setTitle(v)
              scheduleDebouncedUpdate({ title: v.trim() })
            }}
            placeholder="Book title"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Author</Text>
          <View style={styles.authorContainer}>
            <TextInput
              style={[styles.input, styles.authorInput]}
              value={author}
              onChangeText={(v) => {
                setAuthor(v)
                scheduleDebouncedUpdate({ author: v.trim() || 'Unknown author' })
              }}
              placeholder="Author name"
              placeholderTextColor="#666"
            />
            <TouchableOpacity
              style={styles.authorSearchButton}
              onPress={navigateToAuthorSearch}
            >
              <Text style={styles.authorSearchButtonText}>View Books</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusButtons}>
            {statusOptions.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusButton,
                  status === s && styles.statusButtonActive,
                ]}
                onPress={() => handleStatusChange(s)}
              >
                <View style={styles.buttonContent}>
                  <Text
                    style={[
                      styles.statusButtonText,
                      status === s && styles.statusButtonTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                  {buttonFeedback[s] && (
                    <Animated.Text
                      style={[
                        styles.feedbackIcon,
                        buttonFeedback[s] === 'check' ? styles.feedbackCheck : styles.feedbackX,
                        { opacity: feedbackOpacity },
                      ]}
                    >
                      {buttonFeedback[s] === 'check' ? '✓' : '✗'}
                    </Animated.Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.statusButton, isOwned && styles.statusButtonActive]}
              onPress={handleOwnedToggle}
            >
              <View style={styles.buttonContent}>
                <Text
                  style={[styles.statusButtonText, isOwned && styles.statusButtonTextActive]}
                >
                  Owned
                </Text>
                {buttonFeedback['Owned'] && (
                  <Animated.Text
                    style={[
                      styles.feedbackIcon,
                      buttonFeedback['Owned'] === 'check' ? styles.feedbackCheck : styles.feedbackX,
                      { opacity: feedbackOpacity },
                    ]}
                  >
                    {buttonFeedback['Owned'] === 'check' ? '✓' : '✗'}
                  </Animated.Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Rating ({rating}/5)</Text>
          <View style={styles.ratingContainer}>
            <TouchableOpacity
              onPress={() => handleRatingChange(0)}
              style={styles.clearRatingButton}
            >
              <Text style={styles.clearRatingText}>✕</Text>
            </TouchableOpacity>
            <View
              ref={starsContainerRef}
              style={styles.starsContainer}
              onLayout={(e) => {
                starsLayoutRef.current = { width: e.nativeEvent.layout.width }
              }}
              {...ratingPanResponder.panHandlers}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const isFull = rating >= star
                const isHalf = !isFull && rating >= star - 0.5
                return (
                  <View key={star} style={styles.starWrapper}>
                    <StarSvg fraction={isFull ? 1 : isHalf ? 0.5 : 0} size={32} />
                  </View>
                )
              })}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Progress ({progress}%)</Text>
          <View style={styles.progressContainer}>
            <TextInput
              style={styles.progressInput}
              value={progress.toString()}
              onChangeText={(text) => {
                const num = parseInt(text) || 0
                const next = Math.min(100, Math.max(0, num))
                setProgress(next)
                scheduleDebouncedUpdate({ progress: next })
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#666"
            />
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${progress}%` }]}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Review/Notes</Text>
          <TouchableOpacity
            style={styles.spoilerCheckbox}
            onPress={handleSpoilerToggle}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, spoilerWarning && styles.checkboxChecked]}>
              {spoilerWarning && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.spoilerLabel}>⚠️ Contains spoilers</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={review}
            onChangeText={(v) => {
              setReview(v)
              scheduleDebouncedUpdate({ review: v.trim() })
            }}
            placeholder="Your thoughts about this book..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Activity</Text>
          {activityLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : bookActivity.length > 0 ? (
            <View style={styles.activityList}>
              {bookActivity.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.activityItem}
                  activeOpacity={0.8}
                  onPress={() => openReviewThread(item)}
                >
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>
                      <Text style={styles.activityUsername}>{item.owner_username}</Text>
                      <Text style={styles.activityAction}>
                        {item.event_type === 'created' ? ' added this book' : 
                         item.event_type === 'tags_updated' ? ' updated tags' :
                         item.event_type === 'status_changed' ? ' changed status' :
                         ' updated this book'}
                      </Text>
                      {item.tags && item.tags.length > 0 && (
                        <Text style={styles.activityAction}> to </Text>
                      )}
                      {item.tags && item.tags.map((tag, idx) => (
                        <Text key={idx}>
                          <Text style={styles.activityTag}>{tag}</Text>
                          {idx < item.tags.length - 1 && <Text style={styles.activityAction}>, </Text>}
                        </Text>
                      ))}
                    </Text>
                    <Text style={styles.activityTime}>{formatTimeAgo(item.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyActivity}>No activity yet for this book.</Text>
          )}
        </View>

        <Modal
          visible={reviewModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReviewModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Review</Text>

              {reviewThreadLoading ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : reviewThread ? (
                <>
                  <Text style={styles.modalHeadline}>
                    @{reviewThread.reviewer_username} · {reviewThread.title}
                  </Text>

                  {reviewThread.spoiler_warning && !showSpoiler ? (
                    <View style={styles.spoilerBox}>
                      <Text style={styles.spoilerText}>⚠️ Contains spoilers</Text>
                      <TouchableOpacity style={styles.spoilerButton} onPress={() => setShowSpoiler(true)}>
                        <Text style={styles.spoilerButtonText}>Show Spoiler</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.reviewBody}>{reviewThread.review || 'No review text yet.'}</Text>
                  )}

                  <View style={styles.reviewMetaRow}>
                    <TouchableOpacity style={styles.likeButton} onPress={toggleReviewLike}>
                      <Text style={[styles.likeIcon, reviewLikes.likedByMe && styles.liked]}>
                        {reviewLikes.likedByMe ? '❤️' : '🤍'}
                      </Text>
                      {reviewLikes.count > 0 && <Text style={styles.likeCount}>{reviewLikes.count}</Text>}
                    </TouchableOpacity>
                    <Text style={styles.metaText}>{reviewComments.length} comments</Text>
                  </View>

                  <View style={styles.commentsBox}>
                    {reviewComments.length > 0 ? (
                      reviewComments.map((c) => (
                        <View key={c.id} style={styles.commentItem}>
                          <Text style={styles.commentHeader}>
                            @{c.commenter_username} · {formatTimeAgo(c.created_at)}
                          </Text>
                          <Text style={styles.commentBody}>{c.body}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyComments}>No comments yet.</Text>
                    )}
                  </View>

                  <View style={styles.commentComposer}>
                    <TextInput
                      value={reviewCommentDraft}
                      onChangeText={setReviewCommentDraft}
                      placeholder="Write a comment…"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                      style={styles.commentInput}
                    />
                    <TouchableOpacity
                      style={[styles.postButton, !String(reviewCommentDraft || '').trim() && styles.postButtonDisabled]}
                      onPress={postReviewComment}
                      disabled={!String(reviewCommentDraft || '').trim()}
                    >
                      <Text style={styles.postButtonText}>Post</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyComments}>No review found yet.</Text>
              )}

              <TouchableOpacity style={styles.modalClose} onPress={() => setReviewModalVisible(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <TouchableOpacity
          style={styles.recommendButton}
          onPress={openRecommendationComposer}
        >
          <Text style={styles.recommendButtonText}>Make Recommendation</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal
        visible={showRecommendationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecommendationModal(false)}
      >
        <View style={styles.recommendationModalOverlay}>
          <View style={styles.recommendationModalCard}>
            <Text style={styles.recommendationModalTitle}>Recommend to Friends</Text>

            <Text style={styles.recommendationModalSubtitle}>
              {title ? title : 'This book'}
            </Text>

            <ScrollView style={styles.recommendationRecipients}>
              {(Array.isArray(currentUser?.friends) ? currentUser.friends : []).map((u) => {
                const selected = selectedRecommendationRecipients.includes(u)
                return (
                  <TouchableOpacity
                    key={u}
                    style={[styles.recipientRow, selected && styles.recipientRowSelected]}
                    onPress={() => toggleRecipient(u)}
                  >
                    <View style={[styles.recipientCheckbox, selected && styles.recipientCheckboxSelected]}>
                      {selected ? <Text style={styles.recipientCheckmark}>✓</Text> : null}
                    </View>
                    <Text style={styles.recipientUsername}>@{u}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            <TextInput
              style={styles.recommendationNoteInput}
              value={recommendationNote}
              onChangeText={setRecommendationNote}
              placeholder="Write a note (optional)"
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.recommendationModalButtons}>
              <TouchableOpacity
                style={styles.recommendationCancelButton}
                onPress={() => setShowRecommendationModal(false)}
                disabled={sendingRecommendation}
              >
                <Text style={styles.recommendationCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.recommendationSendButton,
                  (sendingRecommendation || selectedRecommendationRecipients.length === 0 || !title.trim()) &&
                    styles.recommendationSendButtonDisabled,
                ]}
                onPress={sendRecommendations}
                disabled={sendingRecommendation || selectedRecommendationRecipients.length === 0 || !title.trim()}
              >
                {sendingRecommendation ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.recommendationSendButtonText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditionsModal(false)}
      >
        <View style={styles.editionsModalOverlay}>
          <View style={styles.editionsModalCard}>
            <View style={styles.editionsModalHeader}>
              <Text style={styles.editionsModalTitle}>Select Edition</Text>
              <TouchableOpacity onPress={() => setShowEditionsModal(false)}>
                <Text style={styles.editionsModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingEditions ? (
              <ActivityIndicator size="large" color="#3b82f6" style={styles.editionsLoader} />
            ) : (
              <ScrollView style={styles.editionsList}>
                {editions.length > 0 ? (
                  editions.map((edition, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.editionItem}
                      onPress={() => selectEdition(edition)}
                    >
                      {edition.cover ? (
                        <Image source={{ uri: edition.cover }} style={styles.editionCover} />
                      ) : (
                        <View style={styles.editionCoverPlaceholder}>
                          <Text>📚</Text>
                        </View>
                      )}
                      <View style={styles.editionInfo}>
                        <Text style={styles.editionTitle} numberOfLines={2}>
                          {edition.title}
                        </Text>
                        <Text style={styles.editionAuthor} numberOfLines={1}>
                          {edition.author}
                        </Text>
                        {edition.year && (
                          <Text style={styles.editionYear}>{edition.year}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.editionsEmptyText}>No editions found</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
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
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  coverContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  cover: {
    width: 150,
    height: 225,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 15,
  },
  authorContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  authorInput: {
    flex: 1,
  },
  authorSearchButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  authorSearchButtonText: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  statusButtonText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  statusButtonTextActive: {
    color: '#3b82f6',
  },
  buttonContent: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackIcon: {
    position: 'absolute',
    right: -12,
    top: -6,
    fontSize: 14,
    fontWeight: '700',
  },
  feedbackCheck: {
    color: '#22c55e',
  },
  feedbackX: {
    color: '#ef4444',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearRatingButton: {
    padding: 8,
    marginRight: 8,
  },
  clearRatingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starWrapper: {
    position: 'relative',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  halfStarTouchLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '50%',
    height: '100%',
    zIndex: 10,
  },
  halfStarTouchRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '50%',
    height: '100%',
    zIndex: 10,
  },
  starEmpty: {
    fontSize: 32,
    color: 'rgba(255, 255, 255, 0.2)',
  },
  starFillContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starFilled: {
    fontSize: 32,
    color: '#fbbf24',
  },
  progressContainer: {
    gap: 12,
  },
  progressInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    width: 80,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  activityList: {
    gap: 8,
  },
  activityItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
  },
  activityContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  activityText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  activityUsername: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  activityAction: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  activityTag: {
    color: '#fff',
    fontWeight: '600',
  },
  activityTime: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  emptyActivity: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  recommendButton: {
    backgroundColor: 'rgba(238, 107, 254, 0.12)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(238, 107, 254, 0.35)',
    marginTop: 6,
    marginBottom: 10,
  },
  recommendButtonText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#ee6bfe',
    textTransform: 'uppercase',
  },
  recommendationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  recommendationModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
  },
  recommendationModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  recommendationModalSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 16,
  },
  recommendationRecipients: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  recipientRowSelected: {
    backgroundColor: 'rgba(238, 107, 254, 0.10)',
  },
  recipientCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientCheckboxSelected: {
    borderColor: 'rgba(238, 107, 254, 0.6)',
    backgroundColor: 'rgba(238, 107, 254, 0.18)',
  },
  recipientCheckmark: {
    color: '#ee6bfe',
    fontWeight: '900',
  },
  recipientUsername: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  recommendationNoteInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
    minHeight: 90,
  },
  recommendationModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  recommendationCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  recommendationCancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  recommendationSendButton: {
    flex: 1,
    backgroundColor: '#ee6bfe',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  recommendationSendButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recommendationSendButtonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0b1225',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalHeadline: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
  },
  spoilerBox: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
    marginBottom: 10,
  },
  spoilerText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '700',
    marginBottom: 10,
  },
  spoilerButton: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  spoilerButtonText: {
    color: '#fca5a5',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 11,
  },
  reviewBody: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  reviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '700',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeIcon: {
    fontSize: 20,
  },
  liked: {
    fontSize: 20,
  },
  likeCount: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  commentsBox: {
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    maxHeight: 220,
  },
  commentItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  commentHeader: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  commentBody: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    lineHeight: 17,
  },
  emptyComments: {
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    paddingVertical: 10,
  },
  commentComposer: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  commentInput: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#fff',
  },
  postButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  modalClose: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  modalCloseText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 12,
  },
  spoilerCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  checkboxChecked: {
    borderColor: '#f87171',
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
  },
  checkmark: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '900',
  },
  spoilerLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
})
