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
} from 'react-native'
import { useNavigation, useIsFocused, useRoute } from '@react-navigation/native'
import { SvgXml } from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import { PROFILE_ICONS } from '../constants/avatars'

export default function CommunityScreen({ user, friendRequestCount = 0, unreadPitCount = 0, unreadRecsCount = 0 }) {
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

      if (error) throw error
      setFriendRequests(data || [])
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
      // Friend accepted - no alert needed, UI updates
    } catch (error) {
      Alert.alert('Error', error.message)
    }
  }

  const loadMoshes = async () => {
    if (!currentUser?.id) return

    try {
      const { data, error } = await supabase
        .from('moshes')
        .select('*')
        .contains('participants_ids', [currentUser.id])
        .eq('archived', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setMoshes(data || [])
    } catch (error) {
      console.error('Load moshes error:', error)
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
    } catch (error) {
      console.error('Send message error:', error)
    }
  }

  const openMosh = (mosh) => {
    setActiveMosh(mosh)
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
    setPitNameDraft(activeMosh?.title || activeMosh?.mosh_title || '')
    setShowPitSettings(true)
  }

  const savePitName = async () => {
    if (!activeMosh?.id || !pitNameDraft.trim()) return

    try {
      const { error } = await supabase
        .from('moshes')
        .update({ title: pitNameDraft.trim(), updated_at: new Date().toISOString() })
        .eq('id', activeMosh.id)

      if (error) throw error
      setActiveMosh({ ...activeMosh, title: pitNameDraft.trim() })
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
      if (error && error.code !== 'PGRST204') {
        console.error('Create pit insert error:', error)
        throw error
      }

      closeCreatePit()
      await loadMoshes()
    } catch (error) {
      // Ignore PGRST204 - it just means no rows returned which is fine
      if (error?.code === 'PGRST204') {
        closeCreatePit()
        await loadMoshes()
        return
      }
      console.error('Create pit error:', error)
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
      // Send a message with book info
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
      closeShareBook()
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

      // Silently handle missing column errors
      if (error?.code === 'PGRST205' || error?.code === '42P01' || error?.code === '42703') {
        setSharedBooks([])
        setShowSharedBooks(true)
        return
      }
      if (error) throw error

      // Extract unique books from messages that have book_share
      const books = (data || [])
        .filter((msg) => msg.book_share)
        .map((msg) => msg.book_share)
      setSharedBooks(books)
      setShowSharedBooks(true)
    } catch (error) {
      // Suppress expected errors silently
      if (error?.code === 'PGRST205' || error?.code === '42P01' || error?.code === '42703') {
        setSharedBooks([])
        setShowSharedBooks(true)
        return
      }
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

  const renderMoshItem = ({ item }) => (
    <TouchableOpacity style={styles.moshItem} onPress={() => openMosh(item)}>
      <Text style={styles.moshTitle}>{item.mosh_title || item.title}</Text>
      <View style={styles.moshMeta}>
        <Text style={styles.moshMetaText}>
          {item.participants_usernames?.length || 0} members
        </Text>
      </View>
    </TouchableOpacity>
  )

  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === currentUser?.id
    const messageBody = item.body || ''

    if (!messageBody) return null

    return (
      <View
        style={[styles.messageContainer, isMe && styles.messageContainerMe]}
      >
        {!isMe && <Text style={styles.messageUsername}>@{item.sender_username}</Text>}
        <View style={[styles.messageBubble, isMe && styles.messageBubbleMe]}>
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {messageBody}
          </Text>
        </View>
      </View>
    )
  }

  if (activeMosh) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={closeMosh}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chatHeaderInfo} onPress={openPitSettings}>
            <Text style={styles.chatTitle}>{activeMosh.title}</Text>
            <Text style={styles.chatMemberCount}>
              {activeMosh.participants_usernames?.length || 0} members
            </Text>
            <Text style={styles.chatSettingsHint}>Tap to manage pit</Text>
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
                        <Text>📚</Text>
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
                  <Text style={styles.pitNameValue}>{activeMosh.title} ✎</Text>
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
                        <Text>📚</Text>
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
                        <Text style={styles.recCoverPlaceholderText}>📚</Text>
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
  moshTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  moshBook: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
  },
  moshMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moshMetaText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  chatHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    fontSize: 16,
    color: '#3b82f6',
    marginBottom: 10,
  },
  chatHeaderInfo: {
    gap: 4,
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  chatBook: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  messagesList: {
    padding: 15,
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
    gap: 8,
  },
  chatHeaderActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  chatHeaderActionIcon: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shareBookModal: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(11, 18, 37, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    maxHeight: 350,
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
    top: 120,
    left: 0,
    right: 0,
    bottom: 60,
    backgroundColor: 'rgba(11, 18, 37, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
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
