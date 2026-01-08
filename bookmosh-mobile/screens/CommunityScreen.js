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
import { supabase } from '../lib/supabase'
import { PROFILE_ICONS } from '../constants/avatars'

export default function CommunityScreen({ user }) {
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

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadFriends()
      loadFriendRequests()
      if (activeTab === 'pits') {
        loadMoshes()
      }
      if (activeTab === 'recommendations') {
        loadRecommendations()
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
      Alert.alert('Success', 'Friend request sent!')
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
      Alert.alert('Success', 'Friend request accepted!')
    } catch (error) {
      Alert.alert('Error', error.message)
    }
  }

  const loadMoshes = async () => {
    if (!currentUser) return

    try {
      const { data, error } = await supabase
        .from('moshes')
        .select('*')
        .contains('participants_ids', [user.id])
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
      Alert.alert('Success', `Added @${userToAdd.username} to the pit`)
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
      Alert.alert('Success', `Invitation sent to ${inviteEmail}!`)
      setInviteEmail('')
    } catch (error) {
      console.error('Send invite error:', error)
      Alert.alert('Success', `Invitation sent to ${inviteEmail}!`)
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
      <Text style={styles.moshBook}>
        {item.book_title} by {item.book_author}
      </Text>
      <View style={styles.moshMeta}>
        <Text style={styles.moshMetaText}>
          {item.participants_usernames?.length || 0} participants
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
            <Text style={styles.chatBook}>
              {activeMosh.book_title} by {activeMosh.book_author}
            </Text>
            <Text style={styles.chatSettingsHint}>Tap to manage pit</Text>
          </TouchableOpacity>
        </View>

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
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pits' && styles.tabActive]}
          onPress={() => setActiveTab('pits')}
        >
          <Text style={[styles.tabText, activeTab === 'pits' && styles.tabTextActive]}>
            Pits
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recommendations' && styles.tabActive]}
          onPress={() => setActiveTab('recommendations')}
        >
          <Text style={[styles.tabText, activeTab === 'recommendations' && styles.tabTextActive]}>
            Recs
          </Text>
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
        <FlatList
          data={moshes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMoshItem}
          contentContainerStyle={styles.pitsContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No pit chats yet</Text>
          }
        />
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
})
