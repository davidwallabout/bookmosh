import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { SvgXml } from 'react-native-svg'
import { supabase } from '../lib/supabase'
import { PROFILE_ICONS } from '../constants/avatars'

export default function PitsScreen({ user }) {
  const navigation = useNavigation()
  const [moshes, setMoshes] = useState([])
  const [activeMosh, setActiveMosh] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [userAvatar, setUserAvatar] = useState(null)
  const flatListRef = useRef(null)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadMoshes()
    }
  }, [currentUser])

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
  }

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
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatTitle}>{activeMosh.title}</Text>
            <Text style={styles.chatBook}>
              {activeMosh.book_title} by {activeMosh.book_author}
            </Text>
          </View>
        </View>

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
          onPress={() => navigation.navigate('ProfileScreen')}
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

      <FlatList
        data={moshes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMoshItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No pit chats yet</Text>
        }
      />
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
  moshItem: {
    padding: 16,
    marginHorizontal: 15,
    marginTop: 12,
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
    borderBottomColor: '#333',
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
    color: '#888',
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
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
    borderWidth: 1,
    borderColor: '#333',
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
    borderTopColor: '#333',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
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
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 40,
  },
})
