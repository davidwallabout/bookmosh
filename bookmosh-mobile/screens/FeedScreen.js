import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { SvgXml } from 'react-native-svg'
import { supabase } from '../lib/supabase'
import { PROFILE_ICONS } from '../constants/avatars'

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

export default function FeedScreen({ user }) {
  const navigation = useNavigation()
  const [feedItems, setFeedItems] = useState([])
  const [feedLikes, setFeedLikes] = useState({})
  const [feedScope, setFeedScope] = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [userAvatar, setUserAvatar] = useState(null)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      fetchFeed()
    }
  }, [currentUser, feedScope])

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

  const fetchFeed = async () => {
    if (!currentUser) return

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

      const items = data || []
      setFeedItems(items)

      if (items.length > 0) {
        const bookIds = items.map((i) => i.id).filter(Boolean)
        const { data: likesData } = await supabase
          .from('feed_likes')
          .select('book_id, user_id, username')
          .in('book_id', bookIds)

        const likesMap = {}
        for (const item of items) {
          const itemLikes = (likesData || []).filter((l) => l.book_id === item.id)
          likesMap[item.id] = {
            count: itemLikes.length,
            likedByMe: itemLikes.some((l) => l.user_id === currentUser?.id),
            users: itemLikes.map((l) => l.username),
          }
        }
        setFeedLikes(likesMap)
      }
    } catch (error) {
      console.error('Feed fetch error:', error)
    }
  }

  const toggleLike = async (itemId) => {
    if (!currentUser) return

    const current = feedLikes[itemId] || { count: 0, likedByMe: false, users: [] }

    if (current.likedByMe) {
      await supabase
        .from('feed_likes')
        .delete()
        .eq('book_id', itemId)
        .eq('user_id', currentUser.id)

      setFeedLikes((prev) => ({
        ...prev,
        [itemId]: {
          count: Math.max(0, current.count - 1),
          likedByMe: false,
          users: current.users.filter((u) => u !== currentUser.username),
        },
      }))
    } else {
      await supabase.from('feed_likes').insert([
        {
          book_id: itemId,
          user_id: currentUser.id,
          username: currentUser.username,
        },
      ])

      setFeedLikes((prev) => ({
        ...prev,
        [itemId]: {
          count: current.count + 1,
          likedByMe: true,
          users: [...current.users, currentUser.username],
        },
      }))
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchFeed()
    setRefreshing(false)
  }

  const renderFeedItem = ({ item }) => {
    const likes = feedLikes[item.id] || { count: 0, likedByMe: false }
    const eventText =
      item.event_type === 'created'
        ? 'added'
        : item.event_type === 'tags_updated'
        ? 'updated'
        : item.event_type

    return (
      <View style={styles.feedItem}>
        <View style={styles.feedHeader}>
          <View style={styles.feedHeaderLeft}>
            <Text style={styles.username}>@{item.owner_username}</Text>
            <Text style={styles.eventType}>{eventText}</Text>
          </View>
          <Text style={styles.timestamp}>{formatTimeAgo(item.created_at)}</Text>
        </View>

        <View style={styles.bookInfo}>
          {item.book_cover && (
            <Image source={{ uri: item.book_cover }} style={styles.bookCover} />
          )}
          <View style={styles.bookText}>
            <Text style={styles.bookTitle}>{item.book_title}</Text>
            <Text style={styles.bookAuthor}>{item.book_author}</Text>
            {item.tags && item.tags.length > 0 && (
              <View style={styles.tags}>
                {item.tags.map((tag, idx) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.likeButton}
          onPress={() => toggleLike(item.id)}
        >
          <Text style={[styles.likeIcon, likes.likedByMe && styles.liked]}>
            {likes.likedByMe ? '❤️' : '🤍'}
          </Text>
          {likes.count > 0 && (
            <Text style={styles.likeCount}>{likes.count}</Text>
          )}
        </TouchableOpacity>
      </View>
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

      <View style={styles.scopeButtons}>
        {['all', 'friends', 'me'].map((scope) => (
          <TouchableOpacity
            key={scope}
            style={[
              styles.scopeButton,
              feedScope === scope && styles.scopeButtonActive,
            ]}
            onPress={() => setFeedScope(scope)}
          >
            <Text
              style={[
                styles.scopeButtonText,
                feedScope === scope && styles.scopeButtonTextActive,
              ]}
            >
              {scope === 'all' ? 'All' : scope === 'friends' ? 'Friends' : 'Me'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={feedItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderFeedItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No feed items yet. Add some books!
          </Text>
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
  scopeButtons: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  scopeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  scopeButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  scopeButtonText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  scopeButtonTextActive: {
    color: '#fff',
  },
  feedItem: {
    padding: 16,
    marginHorizontal: 15,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  feedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  timestamp: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.3)',
    letterSpacing: 0.5,
  },
  username: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3b82f6',
    letterSpacing: 0.2,
  },
  eventType: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bookInfo: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  bookCover: {
    width: 60,
    height: 90,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  bookText: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  bookAuthor: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tagText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
    letterSpacing: 0.5,
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
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    marginTop: 40,
  },
})
