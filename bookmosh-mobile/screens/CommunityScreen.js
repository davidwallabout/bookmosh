import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from 'react-native'
import { useNavigation, useIsFocused, useRoute } from '@react-navigation/native'
import { SvgXml } from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import { PROFILE_ICONS } from '../constants/avatars'
import PixelBookEmoji from '../components/PixelBookEmoji'

export default function CommunityScreen({ user, friendRequestCount = 0, unreadPitCount = 0, unreadPitById = {}, unreadRecsCount = 0, onPitViewed }) {
  const navigation = useNavigation()
  const route = useRoute()
  const isFocused = useIsFocused()
  const [currentUser, setCurrentUser] = useState(null)
  const [friends, setFriends] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [friendRequests, setFriendRequests] = useState([])
  const [userAvatar, setUserAvatar] = useState(null)
  const [activeTab, setActiveTab] = useState('friends')
  const [moshes, setMoshes] = useState([])
  const [activeMosh, setActiveMosh] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const flatListRef = useRef(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [recommendations, setRecommendations] = useState([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [showPitSettings, setShowPitSettings] = useState(false)
  const [editingPitName, setEditingPitName] = useState(false)
  const [pitNameDraft, setPitNameDraft] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)
  const [addMemberQuery, setAddMemberQuery] = useState('')
  const [addMemberResults, setAddMemberResults] = useState([])
  const [showCreatePit, setShowCreatePit] = useState(false)
  const [newPitName, setNewPitName] = useState('')
  const [newPitMembers, setNewPitMembers] = useState([])
  const [newPitMemberQuery, setNewPitMemberQuery] = useState('')
  const [newPitMemberResults, setNewPitMemberResults] = useState([])
  const [creatingPit, setCreatingPit] = useState(false)
  const [showShareBook, setShowShareBook] = useState(false)
  const [shareBookQuery, setShareBookQuery] = useState('')
  const [shareBookResults, setShareBookResults] = useState([])
  const [shareBookSearching, setShareBookSearching] = useState(false)
  const [showSharedBooks, setShowSharedBooks] = useState(false)
  const [sharedBooks, setSharedBooks] = useState([])
  const [sharedBookLibraryIndex, setSharedBookLibraryIndex] = useState({})

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadFriends()
      loadFriendRequests()
      if (activeTab === 'pits') {
        loadMoshes()
        // Mark pits as viewed
        AsyncStorage.setItem(`pits_last_viewed_${user?.id}`, new Date().toISOString())
      }
      if (activeTab === 'recommendations') {
        loadRecommendations()
        // Mark recommendations as viewed
        AsyncStorage.setItem(`recs_last_viewed_${user?.id}`, new Date().toISOString())
      }
    }
  }, [currentUser, activeTab])

  useEffect(() => {
    const next = route?.params?.initialTab
    if (!next) return
    if (next === 'friends' || next === 'pits' || next === 'recommendations') {
      setActiveTab(next)
    }
    navigation.setParams({ initialTab: null })
  }, [route?.params?.initialTab, navigation])

  useEffect(() => {
    if (!isFocused) return
    if (!currentUser) return
    // When tab is re-focused while in a pit chat, close the pit (go back to list)
    if (activeMosh) {
      setActiveMosh(null)
      setMessages([])
    }
    if (activeTab === 'recommendations') {
      loadRecommendations()
    }
    if (activeTab === 'pits') {
      loadMoshes()
    }
  }, [isFocused, currentUser?.id, activeTab])

  useEffect(() => {
    if (activeMosh) {
      loadMessages()
      subscribeToMessages()
    }
  }, [activeMosh?.id])

  useEffect(() => {
    if (!currentUser?.username) return
    if (!activeMosh?.id) return
    if (!Array.isArray(messages) || messages.length === 0) return

    const bookRegex = /📚 Shared a book: "(.+)" by (.+?)(\|\|\|COVER:(.+?)\|\|\|)?$/
    const unique = new Map()
    for (const m of messages) {
      const body = String(m?.body || '')
      const match = body.match(bookRegex)
      if (!match) continue
      const title = match[1]
      const author = match[2]
      const key = `${title}|${author}`
      if (!unique.has(key)) unique.set(key, { title, author })
    }
    if (unique.size === 0) return

    let canceled = false
    ;(async () => {
      try {
        const titles = Array.from(unique.values()).map((b) => b.title)
        const { data, error } = await supabase
          .from('bookmosh_books')
          .select('title, author, status, tags')
          .eq('owner', currentUser.username)
          .in('title', titles)
          .limit(100)

        if (error) return
        if (canceled) return

        const next = {}
        for (const row of data || []) {
          const key = `${row.title}|${row.author}`
          next[key] = {
            status: row.status || null,
            tags: Array.isArray(row.tags) ? row.tags : [],
          }
        }

        setSharedBookLibraryIndex((prev) => ({ ...prev, ...next }))
      } catch {}
    })()

    return () => {
      canceled = true
    }
  }, [currentUser?.username, activeMosh?.id, messages])

  useEffect(() => {
    if (!activeMosh) return
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    })
    return () => keyboardDidShow.remove()
  }, [activeMosh?.id])

  const loadCurrentUser = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setCurrentUser(data)
      setUserAvatar(data?.avatar_url)
    } catch (error) {
      console.error('Load user error:', error)
    }
  }

  const loadFriends = async () => {
    if (!currentUser) return

    const friendUsernames = Array.isArray(currentUser.friends)
      ? currentUser.friends
      : []

    if (friendUsernames.length === 0) {
      setFriends([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email')
        .in('username', friendUsernames)

      if (error) throw error
      setFriends(data || [])
    } catch (error) {
      console.error('Load friends error:', error)
    }
  }

  const loadFriendRequests = async () => {
    if (!currentUser) return

    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('recipient_username', currentUser.username)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Build a set of existing friend usernames (lowercase for comparison)
      const existingFriends = new Set(
        (currentUser.friends || []).map((f) => f?.toLowerCase?.() || '')
      )

      // Dedupe by requester_username and exclude users who are already friends
      const seen = new Set()
      const deduped = (data || []).filter((req) => {
        const key = req.requester_username?.toLowerCase()
        if (!key || seen.has(key)) return false
        // Skip if already a friend
        if (existingFriends.has(key)) return false
        seen.add(key)
        return true
      })
      setFriendRequests(deduped)
    } catch (error) {
      console.error('Load friend requests error:', error)
    }
  }

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email')
        .ilike('username', `%${searchQuery}%`)
        .limit(10)

      if (error) throw error
      setSearchResults(data || [])
    } catch (error) {
      console.error('Search users error:', error)
    }
  }

  const sendFriendRequest = async (toUsername) => {
    if (!currentUser) return

    try {
      const { data: recipientRows, error: recipientErr } = await supabase
        .from('users')
        .select('id')
        .eq('username', toUsername)
        .limit(1)

      if (recipientErr) throw recipientErr

      const recipientId = recipientRows?.[0]?.id
      const { error } = await supabase.from('friend_requests').insert([
        {
          requester_id: currentUser.id,
          requester_username: currentUser.username,
          recipient_id: recipientId || null,
          recipient_username: toUsername,
          status: 'pending',
        },
      ])

      if (error) throw error
      // Friend request sent - no alert needed, UI updates
    } catch (error) {
      Alert.alert('Error', error.message)
    }
  }

  const acceptFriendRequest = async (request) => {
    if (!currentUser) return

    try {
      const { error } = await supabase.rpc('accept_friend_request', {
        request_id: request.id,
      })

      if (error) throw error

      await loadCurrentUser()
      await loadFriendRequests()
      Alert.alert('Friend Added!', `You and @${request.requester_username} are now friends.`)
    } catch (error) {
      Alert.alert('Error', error.message)
    }
  }

  const loadMoshes = async () => {
    if (!currentUser?.id) return

    try {
      const { data: byParticipantsIds, error: byParticipantsIdsError } = await supabase
        .from('moshes')
        .select('*')
        .contains('participants_ids', [currentUser.id])
        .eq('archived', false)
        .order('created_at', { ascending: false })

      if (!byParticipantsIdsError) {
        setMoshes(byParticipantsIds || [])
        return
      }

      const schemaErrCodes = new Set(['PGRST204', 'PGRST205', '42P01', '42703'])
      if (!schemaErrCodes.has(byParticipantsIdsError.code)) throw byParticipantsIdsError

      // Fallback: query by participants_usernames instead
      const { data: byUsername, error: byUsernameError } = await supabase
        .from('moshes')
        .select('*')
        .contains('participants_usernames', [currentUser.username])
        .eq('archived', false)
        .order('created_at', { ascending: false })

      if (byUsernameError) throw byUsernameError

      setMoshes(byUsername || [])
    } catch (error) {
      console.error('[LOAD MOSHES] Error:', error)
    }
  }

  const loadRecommendations = async () => {
    if (!currentUser) return

    setRecommendationsLoading(true)
    try {
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setRecommendations(data || [])
    } catch (error) {
      console.error('[RECOMMENDATIONS] Load error:', error)
      setRecommendations([])
    } finally {
      setRecommendationsLoading(false)
    }
  }

  const openRecommendation = (rec) => {
    navigation.navigate('RecommendationsScreen', { selectedRecommendation: rec })
  }

  const loadMessages = async () => {
    if (!activeMosh) return

    try {
      const { data, error } = await supabase
        .from('mosh_messages')
        .select('*')
        .eq('mosh_id', activeMosh.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    } catch (error) {
      console.error('Load messages error:', error)
    }
  }

  const subscribeToMessages = () => {
    if (!activeMosh?.id) return

    const channel = supabase
      .channel(`mosh_messages:${activeMosh.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mosh_messages',
          filter: `mosh_id=eq.${activeMosh.id}`,
        },
        (payload) => {
          const newMsg = payload?.new
          const newId = String(newMsg?.id ?? '')
          if (!newId) return

          setMessages((prev) => {
            const has = prev.some((m) => String(m?.id ?? '') === newId)
            if (has) return prev
            return [...prev, newMsg]
          })

          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true })
          }, 100)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const sendMessage = async () => {
    if (!messageText.trim() || !activeMosh || !currentUser) return

    const body = messageText.trim()
    setMessageText('')

    try {
      const { error } = await supabase.from('mosh_messages').insert([
        {
          mosh_id: activeMosh.id,
          sender_id: currentUser.id,
          sender_username: currentUser.username,
          body,
        },
      ])

      if (error) throw error
      // Reload messages after sending
      await loadMessages()
    } catch (error) {
      console.error('Send message error:', error)
    }
  }

  const openMosh = (mosh) => {
    setActiveMosh(mosh)
    // Mark this pit as read immediately (per-pit)
    if (mosh?.id) {
      AsyncStorage.setItem(`pit_last_viewed_${user?.id}_${mosh.id}`, new Date().toISOString())
      if (typeof onPitViewed === 'function') {
        onPitViewed(mosh.id)
      }
    }
  }

  const closeMosh = () => {
    setActiveMosh(null)
    setMessages([])
    setShowPitSettings(false)
    setEditingPitName(false)
    setShowAddMember(false)
    setAddMemberQuery('')
    setAddMemberResults([])
  }

  const openPitSettings = () => {
    setPitNameDraft(activeMosh?.mosh_title || activeMosh?.title || '')
    setShowPitSettings(true)
  }

  const savePitName = async () => {
    if (!activeMosh?.id || !pitNameDraft.trim()) return

    try {
      const { error } = await supabase
        .from('moshes')
        .update({ mosh_title: pitNameDraft.trim(), updated_at: new Date().toISOString() })
        .eq('id', activeMosh.id)

      if (error) throw error
      setActiveMosh({ ...activeMosh, mosh_title: pitNameDraft.trim(), title: pitNameDraft.trim() })
      setEditingPitName(false)
      loadMoshes()
    } catch (error) {
      console.error('Update pit name error:', error)
      Alert.alert('Error', 'Failed to update pit name')
    }
  }

  const searchFriendsToAdd = async () => {
    if (!addMemberQuery.trim() || !currentUser) return

    try {
      const currentParticipants = activeMosh?.participants || []
      const { data, error } = await supabase
        .from('users')
        .select('id, username, avatar_icon, avatar_url')
        .ilike('username', `%${addMemberQuery.trim()}%`)
        .limit(10)

      if (error) throw error
      // Filter out users already in the pit
      const filtered = (data || []).filter(
        (u) => !currentParticipants.includes(u.id) && u.id !== currentUser.id
      )
      setAddMemberResults(filtered)
    } catch (error) {
      console.error('Search friends error:', error)
    }
  }

  const addMemberToPit = async (userToAdd) => {
    if (!activeMosh?.id || !userToAdd?.id) return

    try {
      const currentParticipants = activeMosh?.participants || []
      const currentUsernames = activeMosh?.participants_usernames || []

      if (currentParticipants.includes(userToAdd.id)) {
        Alert.alert('Already Added', 'This user is already in the pit')
        return
      }

      const newParticipants = [...currentParticipants, userToAdd.id]
      const newUsernames = [...currentUsernames, userToAdd.username]

      const { error } = await supabase
        .from('moshes')
        .update({
          participants: newParticipants,
          participants_usernames: newUsernames,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeMosh.id)

      if (error) throw error

      setActiveMosh({
        ...activeMosh,
        participants: newParticipants,
        participants_usernames: newUsernames,
      })
      setAddMemberQuery('')
      setAddMemberResults([])
      setShowAddMember(false)
      loadMoshes()
    } catch (error) {
      console.error('Add member error:', error)
      Alert.alert('Error', 'Failed to add member')
    }
  }

  const removeMemberFromPit = async (userId, username) => {
    if (!activeMosh?.id || !userId) return

    Alert.alert(
      'Remove Member',
      `Remove @${username} from this pit?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentParticipants = activeMosh?.participants || []
              const currentUsernames = activeMosh?.participants_usernames || []

              const newParticipants = currentParticipants.filter((id) => id !== userId)
              const newUsernames = currentUsernames.filter((u) => u !== username)

              const { error } = await supabase
                .from('moshes')
                .update({
                  participants: newParticipants,
                  participants_usernames: newUsernames,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', activeMosh.id)

              if (error) throw error

              setActiveMosh({
                ...activeMosh,
                participants: newParticipants,
                participants_usernames: newUsernames,
              })
              loadMoshes()
            } catch (error) {
              console.error('Remove member error:', error)
              Alert.alert('Error', 'Failed to remove member')
            }
          },
        },
      ]
    )
  }

  const viewFriendProfile = (friend) => {
    navigation.navigate('FriendProfileScreen', { friendUsername: friend.username })
  }

  // Create new pit functions
  const openCreatePit = () => {
    setShowCreatePit(true)
    setNewPitName('')
    setNewPitMembers([])
    setNewPitMemberQuery('')
    setNewPitMemberResults([])
  }

  const closeCreatePit = () => {
    setShowCreatePit(false)
    setNewPitName('')
    setNewPitMembers([])
    setNewPitMemberQuery('')
    setNewPitMemberResults([])
  }

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
      // Filter out already added members
      const filtered = (data || []).filter(
        (u) => !newPitMembers.some((m) => m.id === u.id)
      )
      setNewPitMemberResults(filtered)
    } catch (error) {
      console.error('Search members error:', error)
    }
  }

  const addNewPitMember = async (userOrUsername) => {
    // If passed a username string, look up the user ID
    if (typeof userOrUsername === 'string' || !userOrUsername.id || userOrUsername.id === userOrUsername.username) {
      const username = typeof userOrUsername === 'string' ? userOrUsername : userOrUsername.username
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
      } catch (err) {
        console.error('Add member error:', err)
      }
    } else {
      if (newPitMembers.some((m) => m.id === userOrUsername.id)) return
      setNewPitMembers((prev) => [...prev, userOrUsername])
    }
    setNewPitMemberQuery('')
    setNewPitMemberResults([])
  }

  const removeNewPitMember = (userId) => {
    setNewPitMembers(newPitMembers.filter((m) => m.id !== userId))
  }

  const createNewPit = async () => {
    if (!newPitName.trim()) {
      Alert.alert('Error', 'Please enter a pit name')
      return
    }
    if (newPitMembers.length === 0) {
      Alert.alert('Error', 'Please add at least one member')
      return
    }

    setCreatingPit(true)
    try {
      const participantIds = [currentUser.id, ...newPitMembers.map((m) => m.id)]
      const participantUsernames = [currentUser.username, ...newPitMembers.map((m) => m.username)]

      const moshTitle = newPitName.trim()
      const schemaErrCodes = new Set(['PGRST204', 'PGRST205', '42P01', '42703'])

      const insertAttempts = [
        {
          mosh_title: moshTitle,
          book_title: '',
          participants_ids: participantIds,
          participants_usernames: participantUsernames,
          archived: false,
        },
        {
          mosh_title: moshTitle,
          book_title: '',
          participants_usernames: participantUsernames,
          archived: false,
        },
        {
          mosh_title: moshTitle,
          book_title: '',
          participants_ids: participantIds,
          archived: false,
        },
        {
          mosh_title: moshTitle,
          book_title: '',
          archived: false,
        },
      ]

      let lastError = null
      let inserted = false

      for (const payload of insertAttempts) {
        const { error } = await supabase.from('moshes').insert(payload)
        if (!error) {
          inserted = true
          break
        }

        lastError = error
        if (!schemaErrCodes.has(error.code)) break
      }

      if (!inserted) {
        Alert.alert('Error', 'Failed to create pit: ' + (lastError?.message || lastError?.code || 'Unknown error'))
        return
      }

      closeCreatePit()
      await loadMoshes()
    } catch (error) {
      Alert.alert('Error', 'Failed to create pit: ' + (error?.message || 'Unknown error'))
    } finally {
      setCreatingPit(false)
    }
  }

  // Share book in pit functions
  const openShareBook = () => {
    setShowShareBook(true)
    setShareBookQuery('')
    setShareBookResults([])
  }

  const closeShareBook = () => {
    setShowShareBook(false)
    setShareBookQuery('')
    setShareBookResults([])
  }

  const searchBooksToShare = async () => {
    if (!shareBookQuery.trim() || !currentUser) return

    setShareBookSearching(true)
    try {
      // Search user's library
      const { data: userData } = await supabase
        .from('users')
        .select('username')
        .eq('id', currentUser.id)
        .single()

      if (userData?.username) {
        const { data, error } = await supabase
          .from('bookmosh_books')
          .select('id, title, author, cover')
          .eq('owner', userData.username)
          .ilike('title', `%${shareBookQuery.trim()}%`)
          .limit(10)

        if (error) throw error
        setShareBookResults(data || [])
      }
    } catch (error) {
      console.error('Search books error:', error)
    } finally {
      setShareBookSearching(false)
    }
  }

  const shareBookInPit = async (book) => {
    if (!activeMosh?.id || !currentUser || !book) return

    try {
      // Include cover URL in message body so we can extract it later
      const coverPart = book.cover ? `|||COVER:${book.cover}|||` : ''
      const bookMessage = `📚 Shared a book: "${book.title}" by ${book.author}${coverPart}`
      
      const { error } = await supabase.from('mosh_messages').insert([{
        mosh_id: activeMosh.id,
        sender_id: currentUser.id,
        sender_username: currentUser.username,
        body: bookMessage,
      }])

      if (error) throw error
      
      // Add to local sharedBooks immediately so cover shows
      setSharedBooks(prev => [...prev, { title: book.title, author: book.author, cover: book.cover }])
      
      closeShareBook()
      loadMessages()
    } catch (error) {
      console.error('Share book error:', error)
      Alert.alert('Error', 'Failed to share book')
    }
  }

  // View all shared books in pit
  const loadSharedBooks = async () => {
    if (!activeMosh?.id) return

    try {
      const { data, error } = await supabase
        .from('mosh_messages')
        .select('*')
        .eq('mosh_id', activeMosh.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Extract books from messages by parsing the body
      const bookRegex = /📚 Shared a book: "(.+)" by (.+)$/
      const booksFromMessages = (data || [])
        .filter((msg) => bookRegex.test(msg.body || ''))
        .map((msg) => {
          const match = (msg.body || '').match(bookRegex)
          return match ? { title: match[1], author: match[2] } : null
        })
        .filter(Boolean)

      // Get unique books
      const uniqueBooks = []
      const seen = new Set()
      for (const book of booksFromMessages) {
        const key = `${book.title}|${book.author}`
        if (!seen.has(key)) {
          seen.add(key)
          uniqueBooks.push(book)
        }
      }

      // Try to get covers from bookmosh_books for these titles
      if (uniqueBooks.length > 0) {
        const titles = uniqueBooks.map(b => b.title)
        const { data: booksData } = await supabase
          .from('bookmosh_books')
          .select('title, author, cover')
          .in('title', titles)
          .limit(50)

        const coverMap = {}
        for (const b of (booksData || [])) {
          coverMap[b.title] = b.cover
        }

        for (const book of uniqueBooks) {
          book.cover = coverMap[book.title] || null
        }
      }

      setSharedBooks(uniqueBooks)
      setShowSharedBooks(true)
    } catch (error) {
      console.error('Load shared books error:', error)
      setSharedBooks([])
      setShowSharedBooks(true)
    }
  }

  const closeSharedBooks = () => {
    setShowSharedBooks(false)
    setSharedBooks([])
  }

  const sendEmailInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail.trim())) {
      Alert.alert('Error', 'Please enter a valid email address')
      return
    }

    setInviteSending(true)
    try {
      const { error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          type: 'friend_invite',
          to: inviteEmail.trim(),
          data: {
            inviterName: currentUser?.username || 'A friend',
            inviterEmail: currentUser?.email,
          },
        },
      })

      if (error) throw error
      setInviteEmail('')
    } catch (error) {
      console.error('Send invite error:', error)
      setInviteEmail('')
    } finally {
      setInviteSending(false)
    }
  }

  const renderFriend = ({ item }) => (
    <TouchableOpacity 
      style={styles.friendItem}
      onPress={() => viewFriendProfile(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.friendUsername}>@{item.username}</Text>
      <Text style={styles.friendArrow}>→</Text>
    </TouchableOpacity>
  )

  const renderSearchResult = ({ item }) => {
    const isFriend = currentUser?.friends?.includes(item.username)
    const isMe = item.id === currentUser?.id

    return (
      <View style={styles.searchResultItem}>
        <Text style={styles.searchUsername}>@{item.username}</Text>
        {!isMe && !isFriend && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => sendFriendRequest(item.username)}
          >
            <Text style={styles.addButtonText}>Add Friend</Text>
          </TouchableOpacity>
        )}
        {isFriend && <Text style={styles.friendBadge}>Friend</Text>}
      </View>
    )
  }

  const renderFriendRequest = ({ item }) => (
    <View style={styles.requestItem}>
      <Text style={styles.requestUsername}>@{item.requester_username}</Text>
      <TouchableOpacity
        style={styles.acceptButton}
        onPress={() => acceptFriendRequest(item)}
      >
        <Text style={styles.acceptButtonText}>Accept</Text>
      </TouchableOpacity>
    </View>
  )

  const renderMoshItem = ({ item }) => {
    const unread = Number(unreadPitById?.[item?.id] || 0)
    return (
      <TouchableOpacity style={styles.moshItem} onPress={() => openMosh(item)}>
        <View style={styles.moshRowTop}>
          <Text style={styles.moshTitle}>{item.mosh_title || item.title}</Text>
          {unread > 0 && (
            <View style={styles.moshBadge}>
              <Text style={styles.moshBadgeText}>{unread}</Text>
            </View>
          )}
        </View>
        <View style={styles.moshMeta}>
          <Text style={styles.moshMetaText}>
            {item.participants_usernames?.length || 0} members
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  const [addingBookFromPit, setAddingBookFromPit] = useState(null)
  const [reactionMenuMessage, setReactionMenuMessage] = useState(null)

  const toggleReaction = async (messageId, emoji) => {
    if (!currentUser || !messageId) return
    setReactionMenuMessage(null)
    
    try {
      // Check if user already reacted with this emoji
      const { data: existing } = await supabase
        .from('mosh_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', currentUser.id)
        .eq('emoji', emoji)
        .limit(1)

      if (existing && existing.length > 0) {
        // Remove reaction
        await supabase
          .from('mosh_message_reactions')
          .delete()
          .eq('id', existing[0].id)
      } else {
        // Add reaction
        await supabase
          .from('mosh_message_reactions')
          .insert({
            message_id: messageId,
            user_id: currentUser.id,
            username: currentUser.username,
            emoji,
          })
      }
      
      // Reload messages to show updated reactions
      loadMessages()
    } catch (error) {
      // Table might not exist - silently ignore
      console.log('Reaction toggle (table may not exist):', error?.code)
    }
  }

  const addBookFromPitMessage = async (bookInfo, status, isOwned = false, preserveOwned = false) => {
    if (!currentUser || !bookInfo) return
    try {
      const nextTags = isOwned ? [status, 'Owned'] : [status]
      const tags = preserveOwned && !isOwned ? Array.from(new Set([...nextTags, 'Owned'])) : nextTags
      const { error } = await supabase.from('bookmosh_books').insert({
        owner: currentUser.username,
        title: bookInfo.title,
        author: bookInfo.author,
        cover: bookInfo.cover || null,
        status,
        tags,
        updated_at: new Date().toISOString(),
      })
      if (error) {
        // Book exists -> update instead (so pills update your tags/status)
        if (error.code === '23505') {
          const { error: updateError } = await supabase
            .from('bookmosh_books')
            .update({
              status,
              tags,
              updated_at: new Date().toISOString(),
            })
            .eq('owner', currentUser.username)
            .eq('title', bookInfo.title)
            .eq('author', bookInfo.author)
          if (updateError) throw updateError

          setSharedBookLibraryIndex((prev) => ({
            ...prev,
            [`${bookInfo.title}|${bookInfo.author}`]: { status, tags },
          }))
          return
        }
        if (error.code === 'PGRST204' || error.message?.includes('schema cache')) {
          // Schema cache issue - ignore and continue
          console.log('Schema cache issue, continuing:', error.message)
          return
        }
        throw error
      }

      setSharedBookLibraryIndex((prev) => ({
        ...prev,
        [`${bookInfo.title}|${bookInfo.author}`]: { status, tags },
      }))
      const ownedText = isOwned ? ' (Owned)' : ''
      Alert.alert('Added!', `"${bookInfo.title}" added as ${status}${ownedText}`)
    } catch (error) {
      console.error('Add book from pit error:', error)
      // Don't show alert for schema issues
      if (!error.message?.includes('schema cache')) {
        Alert.alert('Error', error.message || 'Failed to add book to library')
      }
    }
  }

  const parseBookShare = (messageBody) => {
    // Extract cover URL if present
    const coverMatch = messageBody.match(/\|\|\|COVER:(.+?)\|\|\|/)
    const cover = coverMatch ? coverMatch[1] : null
    
    // Remove cover part for title/author parsing
    const cleanBody = messageBody.replace(/\|\|\|COVER:.+?\|\|\|/, '')
    
    const match = cleanBody.match(/📚 Shared a book: "(.+)" by (.+)$/)
    if (match) {
      return { title: match[1], author: match[2], cover }
    }
    return null
  }

  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === currentUser?.id
    const messageBody = item.body || ''

    if (!messageBody) return null

    const bookShare = parseBookShare(messageBody)

    if (bookShare) {
      // Use cover from parsed message first, fallback to sharedBooks lookup
      const fallbackBook = sharedBooks.find(b => b.title === bookShare.title)
      const coverUrl = bookShare.cover || fallbackBook?.cover || null

      const bookData = { ...bookShare, cover: coverUrl }
      const libraryKey = `${bookShare.title}|${bookShare.author}`
      const libraryRow = sharedBookLibraryIndex[libraryKey] || null
      const selectedStatus = libraryRow?.status || null
      const selectedTags = Array.isArray(libraryRow?.tags) ? libraryRow.tags : []
      const ownedSelected = selectedTags.includes('Owned')
      
      return (
        <View style={[styles.messageContainer, isMe && styles.messageContainerMe]}>
          {!isMe && <Text style={styles.messageUsername}>@{item.sender_username}</Text>}
          <View style={styles.bookShareBubbleWide}>
            <View style={styles.bookShareContent}>
              <TouchableOpacity
                onPress={() => {
                  // Navigate directly to book details - user can add from there
                  navigation.navigate('BookDetailScreen', { 
                    bookTitle: bookShare.title,
                    bookAuthor: bookShare.author,
                    bookCover: coverUrl,
                  })
                }}
              >
                {coverUrl ? (
                  <Image source={{ uri: coverUrl, cache: 'force-cache' }} style={styles.bookShareCoverLarge} />
                ) : (
                  <View style={styles.bookShareCoverPlaceholderLarge}>
                    <PixelBookEmoji size={24} />
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.bookShareInfo}>
                <Text style={styles.bookShareTitle} numberOfLines={2}>{bookShare.title}</Text>
                <Text style={styles.bookShareAuthor} numberOfLines={1}>{bookShare.author}</Text>
              </View>
            </View>
            <View style={styles.bookShareActions}>
              <View style={styles.bookShareQuadrant}>
                <TouchableOpacity
                  style={[styles.bookShareQuadrantBtn, selectedStatus === 'Reading' && styles.bookShareQuadrantBtnActive]}
                  onPress={() => addBookFromPitMessage(bookData, 'Reading', false, ownedSelected)}
                >
                  <Text style={styles.bookShareQuadrantText}>Reading</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bookShareQuadrantBtn, selectedStatus === 'to-read' && styles.bookShareQuadrantBtnActive]}
                  onPress={() => addBookFromPitMessage(bookData, 'to-read', false, ownedSelected)}
                >
                  <Text style={styles.bookShareQuadrantText}>To Read</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.bookShareQuadrant}>
                <TouchableOpacity
                  style={[styles.bookShareQuadrantBtn, selectedStatus === 'Read' && styles.bookShareQuadrantBtnActive]}
                  onPress={() => addBookFromPitMessage(bookData, 'Read', false, ownedSelected)}
                >
                  <Text style={styles.bookShareQuadrantText}>Read</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bookShareQuadrantBtn, styles.bookShareOwnedBtn, ownedSelected && styles.bookShareOwnedBtnActive]}
                  onPress={() => addBookFromPitMessage(bookData, 'to-read', true)}
                >
                  <Text style={styles.bookShareOwnedText}>Owned</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )
    }

    return (
      <View
        style={[styles.messageContainer, isMe && styles.messageContainerMe]}
      >
        {!isMe && <Text style={styles.messageUsername}>@{item.sender_username}</Text>}
        <TouchableOpacity
          style={[styles.messageBubble, isMe && styles.messageBubbleMe]}
          activeOpacity={0.8}
          onLongPress={() => setReactionMenuMessage(item)}
        >
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {messageBody}
          </Text>
          {item.reactions && item.reactions.length > 0 && (
            <View style={styles.reactionsRow}>
              {item.reactions.map((r, idx) => (
                <Text key={idx} style={styles.reactionEmoji}>{r.emoji}</Text>
              ))}
            </View>
          )}
        </TouchableOpacity>
        {reactionMenuMessage?.id === item.id && (
          <View style={styles.reactionMenu}>
            <TouchableOpacity onPress={() => toggleReaction(item.id, '👍')} style={styles.reactionBtn}>
              <Text style={styles.reactionBtnText}>👍</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleReaction(item.id, '👎')} style={styles.reactionBtn}>
              <Text style={styles.reactionBtnText}>👎</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReactionMenuMessage(null)} style={styles.reactionCloseBtn}>
              <Text style={styles.reactionCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  if (activeMosh) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={closeMosh}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chatHeaderInfo} onPress={openPitSettings}>
            <Text style={styles.chatTitle} numberOfLines={1}>{activeMosh.mosh_title || activeMosh.title || 'Pit'}</Text>
            <Text style={styles.chatMemberCount}>
              {activeMosh.participants_usernames?.length || 0} members · Tap to manage
            </Text>
          </TouchableOpacity>
          <View style={styles.chatHeaderActions}>
            <TouchableOpacity style={styles.chatHeaderActionBtn} onPress={loadSharedBooks}>
              <Text style={styles.chatHeaderActionIcon}>Books</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatHeaderActionBtn} onPress={openShareBook}>
              <Text style={styles.chatHeaderActionIcon}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Shared Books Modal */}
        {showSharedBooks && (
          <View style={styles.sharedBooksModal}>
            <View style={styles.sharedBooksHeader}>
              <Text style={styles.sharedBooksTitle}>Shared Books</Text>
              <TouchableOpacity onPress={closeSharedBooks}>
                <Text style={styles.sharedBooksClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sharedBooksList}>
              {sharedBooks.length > 0 ? (
                sharedBooks.map((book, idx) => (
                  <TouchableOpacity
                    key={`${book.book_id || book.title}-${idx}`}
                    style={styles.sharedBookItem}
                    onPress={() => {
                      closeSharedBooks()
                      if (book.book_id) {
                        navigation.navigate('BookDetailScreen', { bookId: book.book_id })
                      }
                    }}
                  >
                    {book.cover ? (
                      <Image source={{ uri: book.cover }} style={styles.sharedBookCover} />
                    ) : (
                      <View style={styles.sharedBookCoverPlaceholder}>
                        <PixelBookEmoji size={18} />
                      </View>
                    )}
                    <View style={styles.sharedBookInfo}>
                      <Text style={styles.sharedBookTitle} numberOfLines={2}>{book.title}</Text>
                      <Text style={styles.sharedBookAuthor} numberOfLines={1}>{book.author}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.sharedBooksEmpty}>No books have been shared in this pit yet.</Text>
              )}
            </ScrollView>
          </View>
        )}

        {showPitSettings && (
          <View style={styles.pitSettingsPanel}>
            <View style={styles.pitSettingsHeader}>
              <Text style={styles.pitSettingsTitle}>Pit Settings</Text>
              <TouchableOpacity onPress={() => setShowPitSettings(false)}>
                <Text style={styles.pitSettingsClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Rename Pit */}
            <View style={styles.pitSettingsSection}>
              <Text style={styles.pitSettingsLabel}>Pit Name</Text>
              {editingPitName ? (
                <View style={styles.pitNameEditRow}>
                  <TextInput
                    style={styles.pitNameInput}
                    value={pitNameDraft}
                    onChangeText={setPitNameDraft}
                    placeholder="Enter pit name"
                    placeholderTextColor="#666"
                    autoFocus
                  />
                  <TouchableOpacity style={styles.pitNameSaveBtn} onPress={savePitName}>
                    <Text style={styles.pitNameSaveBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingPitName(false)}>
                    <Text style={styles.pitNameCancelBtn}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setEditingPitName(true)}>
                  <Text style={styles.pitNameValue}>{activeMosh.mosh_title || activeMosh.title} ✎</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Members */}
            <View style={styles.pitSettingsSection}>
              <View style={styles.pitMembersHeader}>
                <Text style={styles.pitSettingsLabel}>
                  Members ({activeMosh.participants_usernames?.length || 0})
                </Text>
                <TouchableOpacity
                  style={styles.addMemberBtn}
                  onPress={() => setShowAddMember(!showAddMember)}
                >
                  <Text style={styles.addMemberBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>

              {showAddMember && (
                <View style={styles.addMemberSection}>
                  <View style={styles.addMemberInputRow}>
                    <TextInput
                      style={styles.addMemberInput}
                      value={addMemberQuery}
                      onChangeText={setAddMemberQuery}
                      placeholder="Search username..."
                      placeholderTextColor="#666"
                      onSubmitEditing={searchFriendsToAdd}
                    />
                    <TouchableOpacity style={styles.addMemberSearchBtn} onPress={searchFriendsToAdd}>
                      <Text style={styles.addMemberSearchBtnText}>Search</Text>
                    </TouchableOpacity>
                  </View>
                  {addMemberResults.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={styles.addMemberResult}
                      onPress={() => addMemberToPit(u)}
                    >
                      <Text style={styles.addMemberResultText}>@{u.username}</Text>
                      <Text style={styles.addMemberResultAdd}>+ Add</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.membersList}>
                {(activeMosh.participants_usernames || []).map((username, idx) => {
                  const participantId = activeMosh.participants?.[idx]
                  const isCurrentUser = participantId === currentUser?.id
                  return (
                    <View key={username} style={styles.memberItem}>
                      <Text style={styles.memberName}>@{username}</Text>
                      {!isCurrentUser && (
                        <TouchableOpacity
                          onPress={() => removeMemberFromPit(participantId, username)}
                        >
                          <Text style={styles.memberRemove}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })}
              </View>
            </View>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#666"
            value={messageText}
            onChangeText={setMessageText}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>

        {/* Share Book Modal */}
        {showShareBook && (
          <View style={styles.shareBookModal}>
            <View style={styles.shareBookHeader}>
              <Text style={styles.shareBookTitle}>Share a Book</Text>
              <TouchableOpacity onPress={closeShareBook}>
                <Text style={styles.shareBookClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.shareBookSearchRow}>
              <TextInput
                style={styles.shareBookInput}
                value={shareBookQuery}
                onChangeText={setShareBookQuery}
                placeholder="Search your library..."
                placeholderTextColor="#666"
                onSubmitEditing={searchBooksToShare}
              />
              <TouchableOpacity style={styles.shareBookSearchBtn} onPress={searchBooksToShare}>
                <Text style={styles.shareBookSearchBtnText}>Search</Text>
              </TouchableOpacity>
            </View>
            {shareBookSearching ? (
              <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 12 }} />
            ) : (
              <ScrollView style={styles.shareBookResults}>
                {shareBookResults.map((book) => (
                  <TouchableOpacity
                    key={book.id}
                    style={styles.shareBookItem}
                    onPress={() => shareBookInPit(book)}
                  >
                    {book.cover ? (
                      <Image source={{ uri: book.cover }} style={styles.shareBookCover} />
                    ) : (
                      <View style={styles.shareBookCoverPlaceholder}>
                        <PixelBookEmoji size={18} />
                      </View>
                    )}
                    <View style={styles.shareBookInfo}>
                      <Text style={styles.shareBookItemTitle} numberOfLines={1}>{book.title}</Text>
                      <Text style={styles.shareBookItemAuthor} numberOfLines={1}>{book.author}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {shareBookResults.length === 0 && shareBookQuery.trim() && !shareBookSearching && (
                  <Text style={styles.shareBookEmpty}>No books found. Try a different search.</Text>
                )}
              </ScrollView>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Tabs', { screen: 'Library' })}>
          <Image
            source={require('../assets/bookmosh-vert.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.avatarButton}
        >
          {userAvatar ? (
            <Image
              source={{ uri: userAvatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatar}>
              <SvgXml
                xml={PROFILE_ICONS.find(i => i.id === currentUser?.avatar_icon)?.svg || PROFILE_ICONS[0].svg}
                width="100%"
                height="100%"
              />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => setActiveTab('friends')}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
              Friends
            </Text>
            {friendRequestCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{friendRequestCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pits' && styles.tabActive]}
          onPress={() => setActiveTab('pits')}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, activeTab === 'pits' && styles.tabTextActive]}>
              Pits
            </Text>
            {unreadPitCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadPitCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recommendations' && styles.tabActive]}
          onPress={() => setActiveTab('recommendations')}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, activeTab === 'recommendations' && styles.tabTextActive]}>
              Recs
            </Text>
            {unreadRecsCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadRecsCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {activeTab === 'friends' ? (
        <ScrollView style={styles.friendsScrollView} contentContainerStyle={styles.friendsScrollContent}>
          {friendRequests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Friend Requests</Text>
              <FlatList
                data={friendRequests}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderFriendRequest}
                scrollEnabled={false}
              />
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Users</Text>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by username..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchUsers}
              />
              <TouchableOpacity style={styles.searchButton} onPress={searchUsers}>
                <Text style={styles.searchButtonText}>Search</Text>
              </TouchableOpacity>
            </View>
            {searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderSearchResult}
                scrollEnabled={false}
              />
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Friends ({friends.length})
            </Text>
            <FlatList
              data={friends}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderFriend}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No friends yet</Text>
              }
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invite a Friend to BookMosh</Text>
            <Text style={styles.inviteDescription}>
              Send an email invitation to join BookMosh
            </Text>
            <View style={styles.inviteContainer}>
              <TextInput
                style={styles.inviteInput}
                placeholder="friend@email.com"
                placeholderTextColor="#666"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[
                  styles.inviteButton,
                  inviteSending && styles.inviteButtonDisabled,
                ]}
                onPress={sendEmailInvite}
                disabled={inviteSending}
              >
                {inviteSending ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Text style={styles.inviteButtonText}>Send Invite</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : activeTab === 'pits' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.pitsHeader}>
            <Text style={styles.sectionTitle}>Your Pits</Text>
            <TouchableOpacity style={styles.createPitBtn} onPress={openCreatePit}>
              <Text style={styles.createPitBtnText}>+ New Pit</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={moshes}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMoshItem}
            contentContainerStyle={styles.pitsContainer}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No pits yet. Create one to start chatting!</Text>
            }
          />

          {/* Create Pit Modal */}
          {showCreatePit && (
            <View style={styles.createPitModal}>
              <View style={styles.createPitHeader}>
                <Text style={styles.createPitTitle}>Create New Pit</Text>
                <TouchableOpacity onPress={closeCreatePit}>
                  <Text style={styles.createPitClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.createPitLabel}>Pit Name</Text>
              <TextInput
                style={styles.createPitInput}
                value={newPitName}
                onChangeText={setNewPitName}
                placeholder="Enter pit name..."
                placeholderTextColor="#666"
              />

              <Text style={styles.createPitLabel}>Add Members</Text>
              <TextInput
                style={styles.createPitSearchInput}
                value={newPitMemberQuery}
                onChangeText={setNewPitMemberQuery}
                placeholder="Search friends..."
                placeholderTextColor="#666"
              />

              <ScrollView style={styles.createPitFriendsList} nestedScrollEnabled>
                {(Array.isArray(currentUser?.friends) ? currentUser.friends : [])
                  .filter((u) => !newPitMemberQuery.trim() || u.toLowerCase().includes(newPitMemberQuery.toLowerCase()))
                  .filter((u) => !newPitMembers.some((m) => m.username === u))
                  .map((friendUsername) => (
                    <TouchableOpacity
                      key={friendUsername}
                      style={styles.createPitResultItem}
                      onPress={() => addNewPitMember(friendUsername)}
                    >
                      <Text style={styles.createPitResultText}>@{friendUsername}</Text>
                      <Text style={styles.createPitResultAdd}>+ Add</Text>
                    </TouchableOpacity>
                  ))}
                {(Array.isArray(currentUser?.friends) ? currentUser.friends : []).length === 0 && (
                  <Text style={styles.createPitNoFriends}>No friends yet. Add friends first!</Text>
                )}
              </ScrollView>

              {newPitMembers.length > 0 && (
                <View style={styles.createPitMembers}>
                  <Text style={styles.createPitMembersLabel}>Members to add:</Text>
                  {newPitMembers.map((m) => (
                    <View key={m.id} style={styles.createPitMemberItem}>
                      <Text style={styles.createPitMemberName}>@{m.username}</Text>
                      <TouchableOpacity onPress={() => removeNewPitMember(m.id)}>
                        <Text style={styles.createPitMemberRemove}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.createPitSubmitBtn, creatingPit && styles.createPitSubmitBtnDisabled]}
                onPress={createNewPit}
                disabled={creatingPit}
              >
                {creatingPit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.createPitSubmitBtnText}>Create Pit</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.recsContainer}>
          <View style={styles.recsHeaderRow}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('RecommendationsScreen')}
              style={styles.recsViewAll}
            >
              <Text style={styles.recsViewAllText}>View All →</Text>
            </TouchableOpacity>
          </View>

          {recommendationsLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 12 }} />
          ) : recommendations.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recommendations.slice(0, 12).map((rec) => {
                const isSent = Boolean(currentUser?.id && rec.sender_id === currentUser.id)
                const headline = isSent
                  ? `To @${rec.recipient_username}`
                  : `From @${rec.sender_username}`

                return (
                  <TouchableOpacity
                    key={rec.id}
                    style={styles.recCard}
                    activeOpacity={0.7}
                    onPress={() => openRecommendation(rec)}
                  >
                    {rec.book_cover ? (
                      <Image source={{ uri: rec.book_cover }} style={styles.recCover} />
                    ) : (
                      <View style={styles.recCoverPlaceholder}>
                        <PixelBookEmoji size={18} />
                      </View>
                    )}
                    <Text style={styles.recTitle} numberOfLines={2}>{rec.book_title}</Text>
                    <Text style={styles.recMeta} numberOfLines={1}>{headline}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>No recommendations yet</Text>
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  friendsScrollView: {
    flex: 1,
  },
  friendsScrollContent: {
    paddingBottom: 40,
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
  logo: {
    height: 40,
    width: 120,
  },
  avatarButton: {
    padding: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 12,
    color: '#fff',
    fontSize: 15,
  },
  searchButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  searchButtonText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  friendUsername: {
    fontSize: 16,
    color: '#fff',
  },
  friendArrow: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchUsername: {
    fontSize: 16,
    color: '#fff',
  },
  addButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  addButtonText: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  friendBadge: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  requestUsername: {
    fontSize: 16,
    color: '#fff',
  },
  acceptButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  acceptButtonText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
    marginTop: 10,
  },
  inviteDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 15,
  },
  inviteContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  inviteInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 12,
    color: '#fff',
    fontSize: 15,
  },
  inviteButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    minWidth: 110,
  },
  inviteButtonDisabled: {
    opacity: 0.5,
  },
  inviteButtonText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  pitsContainer: {
    padding: 15,
  },
  moshItem: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  moshRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  moshMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moshBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  moshBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  moshMetaText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  backButton: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  chatHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  chatBook: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  messagesList: {
    padding: 15,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  messageContainerMe: {
    alignItems: 'flex-end',
  },
  messageUsername: {
    fontSize: 12,
    color: '#3b82f6',
    marginBottom: 4,
    marginLeft: 8,
  },
  messageBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageBubbleMe: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  messageText: {
    fontSize: 15,
    color: '#fff',
  },
  messageTextMe: {
    color: '#fff',
  },
  bookShareBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 12,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  bookShareBubbleWide: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderRadius: 16,
    padding: 14,
    width: '80%',
    borderWidth: 1,
    borderColor: 'rgba(11, 27, 58, 0.7)',
  },
  bookShareLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bookShareContent: {
    flexDirection: 'row',
    gap: 12,
  },
  bookShareCover: {
    width: 50,
    height: 75,
    borderRadius: 6,
  },
  bookShareCoverLarge: {
    width: 70,
    height: 105,
    borderRadius: 8,
  },
  bookShareCoverPlaceholder: {
    width: 50,
    height: 75,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookShareCoverPlaceholderLarge: {
    width: 70,
    height: 105,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookSharePlaceholderText: {
    fontSize: 20,
  },
  bookShareInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookShareTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  bookShareAuthor: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  bookShareViewDetails: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 6,
    fontWeight: '500',
  },
  bookShareActions: {
    marginTop: 12,
    gap: 6,
  },
  bookShareQuadrant: {
    flexDirection: 'row',
    gap: 6,
  },
  bookShareQuadrantBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(11, 27, 58, 0.35)',
    alignItems: 'center',
  },
  bookShareQuadrantBtnActive: {
    backgroundColor: 'rgba(238, 107, 254, 0.22)',
    borderColor: 'rgba(238, 107, 254, 0.55)',
  },
  bookShareQuadrantText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.92)',
  },
  bookShareOwnedBtn: {
    backgroundColor: 'rgba(238, 107, 254, 0.18)',
    borderColor: 'rgba(238, 107, 254, 0.45)',
  },
  bookShareOwnedBtnActive: {
    backgroundColor: 'rgba(238, 107, 254, 0.28)',
    borderColor: 'rgba(238, 107, 254, 0.65)',
  },
  bookShareOwnedText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.92)',
  },
  bookShareDetailsBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
  },
  bookShareDetailsBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  reactionsRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionMenu: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 40, 60, 0.95)',
    borderRadius: 20,
    padding: 6,
    marginTop: 6,
    gap: 4,
    alignSelf: 'flex-start',
  },
  reactionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  reactionBtnText: {
    fontSize: 18,
  },
  reactionCloseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  reactionCloseBtnText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  recsContainer: {
    padding: 20,
  },
  recsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recsViewAll: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  recsViewAllText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  recCard: {
    width: 120,
    marginRight: 12,
  },
  recCover: {
    width: 120,
    height: 170,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
  },
  recCoverPlaceholder: {
    width: 120,
    height: 170,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  recCoverPlaceholderText: {
    fontSize: 32,
  },
  recTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  recMeta: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  chatSettingsHint: {
    fontSize: 10,
    color: 'rgba(59, 130, 246, 0.7)',
    marginTop: 4,
  },
  pitSettingsPanel: {
    backgroundColor: 'rgba(11, 18, 37, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
  },
  pitSettingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pitSettingsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  pitSettingsClose: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.5)',
    padding: 4,
  },
  pitSettingsSection: {
    marginBottom: 16,
  },
  pitSettingsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  pitNameValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  pitNameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pitNameInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    color: '#fff',
    fontSize: 15,
  },
  pitNameSaveBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pitNameSaveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  pitNameCancelBtn: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    padding: 8,
  },
  pitMembersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addMemberBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addMemberBtnText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  addMemberSection: {
    marginTop: 12,
  },
  addMemberInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  addMemberInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    color: '#fff',
    fontSize: 14,
  },
  addMemberSearchBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  addMemberSearchBtnText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  addMemberResult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  addMemberResultText: {
    color: '#fff',
    fontSize: 14,
  },
  addMemberResultAdd: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  membersList: {
    marginTop: 12,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  memberName: {
    color: '#fff',
    fontSize: 14,
  },
  memberRemove: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  chatMemberCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  shareBookBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    padding: 10,
    marginLeft: 'auto',
  },
  shareBookBtnText: {
    fontSize: 20,
  },
  chatHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatHeaderActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  chatHeaderActionIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
  },
  shareBookModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.98)',
    padding: 20,
    paddingTop: 60,
    zIndex: 100,
  },
  shareBookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shareBookTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  shareBookClose: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.5)',
    padding: 4,
  },
  shareBookSearchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  shareBookInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    color: '#fff',
    fontSize: 14,
  },
  shareBookSearchBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  shareBookSearchBtnText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  shareBookResults: {
    maxHeight: 200,
  },
  shareBookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  shareBookCover: {
    width: 40,
    height: 60,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  shareBookCoverPlaceholder: {
    width: 40,
    height: 60,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBookInfo: {
    flex: 1,
  },
  shareBookItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  shareBookItemAuthor: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  shareBookEmpty: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  pitsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  createPitBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  createPitBtnText: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '600',
  },
  createPitModal: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(11, 18, 37, 0.98)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    maxHeight: 500,
  },
  createPitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  createPitTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  createPitClose: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.5)',
    padding: 4,
  },
  createPitLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  createPitInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 15,
  },
  createPitSearchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  createPitSearchInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    color: '#fff',
    fontSize: 14,
  },
  createPitSearchBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  createPitSearchBtnText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  createPitResults: {
    marginTop: 8,
  },
  createPitFriendsList: {
    maxHeight: 150,
    marginTop: 8,
  },
  createPitNoFriends: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  createPitResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  createPitResultText: {
    color: '#fff',
    fontSize: 14,
  },
  createPitResultAdd: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  createPitMembers: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
  },
  createPitMembersLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
  },
  createPitMemberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  createPitMemberName: {
    color: '#fff',
    fontSize: 14,
  },
  createPitMemberRemove: {
    color: '#ef4444',
    fontSize: 14,
    padding: 4,
  },
  createPitSubmitBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  createPitSubmitBtnDisabled: {
    opacity: 0.6,
  },
  createPitSubmitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  viewSharedBooksBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    padding: 10,
  },
  viewSharedBooksBtnText: {
    fontSize: 18,
  },
  sharedBooksModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.98)',
    padding: 20,
    paddingTop: 60,
    zIndex: 100,
  },
  sharedBooksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sharedBooksTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  sharedBooksClose: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.5)',
    padding: 4,
  },
  sharedBooksList: {
    flex: 1,
  },
  sharedBookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  sharedBookCover: {
    width: 50,
    height: 75,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sharedBookCoverPlaceholder: {
    width: 50,
    height: 75,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sharedBookInfo: {
    flex: 1,
  },
  sharedBookTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  sharedBookAuthor: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  sharedBooksEmpty: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 40,
  },
})
