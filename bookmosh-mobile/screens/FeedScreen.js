import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { SvgXml } from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
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

export default function FeedScreen({ user, setFeedBadgeCount }) {
  const navigation = useNavigation()
  const [feedItems, setFeedItems] = useState([])
  const [feedLikes, setFeedLikes] = useState({})
  const [feedScope, setFeedScope] = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [userAvatar, setUserAvatar] = useState(null)

  const [reviewModalVisible, setReviewModalVisible] = useState(false)
  const [reviewThreadLoading, setReviewThreadLoading] = useState(false)
  const [reviewThread, setReviewThread] = useState(null)
  const [reviewLikes, setReviewLikes] = useState({ count: 0, likedByMe: false, users: [] })
  const [reviewComments, setReviewComments] = useState([])
  const [reviewCommentDraft, setReviewCommentDraft] = useState('')
  const [showSpoiler, setShowSpoiler] = useState(false)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      fetchFeed()
      // Clear badge when viewing feed
      if (setFeedBadgeCount) {
        setFeedBadgeCount(0)
        const lastViewedKey = `feed_last_viewed_${user.id}`
        AsyncStorage.setItem(lastViewedKey, new Date().toISOString())
      }
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

      const [{ data: eventsData, error: eventsError }, { data: recData, error: recError }] = await Promise.all([
        query,
        supabase
          .from('recommendations')
          .select('*')
          .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      if (eventsError) throw eventsError
      if (recError) throw recError

      const mappedEvents = (eventsData || []).map((e) => ({ ...e, item_type: 'book_event' }))
      const mappedRecs = (recData || []).map((r) => ({
        ...r,
        item_type: 'recommendation',
        owner_username: r.sender_username,
        event_type: r.sender_id === currentUser.id ? 'recommendation_sent' : 'recommendation_received',
        book_title: r.book_title,
        book_author: r.book_author,
        book_cover: r.book_cover,
      }))

      const items = [...mappedEvents, ...mappedRecs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50)

      setFeedItems(items)

      const bookEventIds = items.filter((i) => i.item_type === 'book_event').map((i) => i.id).filter(Boolean)
      if (bookEventIds.length > 0) {
        const { data: likesData } = await supabase
          .from('feed_likes')
          .select('book_id, user_id, username')
          .in('book_id', bookEventIds)

        const likesMap = {}
        for (const item of items) {
          if (item.item_type !== 'book_event') continue
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
      const eventReviewId = eventItem?.review_id ?? null

      if (eventReviewId) {
        const { data: r, error: rErr } = await supabase
          .from('book_reviews')
          .select('*')
          .eq('id', eventReviewId)
          .maybeSingle()

        if (rErr) throw rErr
        if (!r?.id) {
          setReviewThread(null)
          return
        }

        setReviewThread({
          ...r,
          title: r.book_title,
          author: r.book_author,
          cover: r.book_cover,
          review: r.body,
          reviewer_username: r.owner_username,
          __reviewTable: 'book_reviews',
        })

        const [{ data: likesData }, { data: commentsData }] = await Promise.all([
          supabase.from('book_review_likes').select('review_id, user_id, username').eq('review_id', r.id),
          supabase
            .from('book_review_comments')
            .select('*')
            .eq('review_id', r.id)
            .order('created_at', { ascending: true }),
        ])

        const likes = likesData || []
        setReviewLikes({
          count: likes.length,
          likedByMe: likes.some((l) => l.user_id === currentUser.id),
          users: likes.map((l) => l.username),
        })

        setReviewComments(commentsData || [])
        return
      }

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
        __reviewTable: 'bookmosh_books',
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
      console.error('[FEED] Open review thread failed:', error)
    } finally {
      setReviewThreadLoading(false)
    }
  }

  const toggleReviewLike = async () => {
    if (!currentUser?.id || !reviewThread?.id) return
    const reviewId = reviewThread.id
    const current = reviewLikes || { count: 0, likedByMe: false, users: [] }

    const likesTable = reviewThread.__reviewTable === 'book_reviews' ? 'book_review_likes' : 'review_likes'

    try {
      if (current.likedByMe) {
        await supabase.from(likesTable).delete().eq('review_id', reviewId).eq('user_id', currentUser.id)
        setReviewLikes((prev) => ({
          count: Math.max(0, (prev?.count ?? 1) - 1),
          likedByMe: false,
          users: (prev?.users ?? []).filter((u) => u !== currentUser.username),
        }))
      } else {
        const { error } = await supabase.from(likesTable).insert({
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
      console.error('[FEED] Toggle review like failed:', error)
    }
  }

  const postReviewComment = async () => {
    if (!currentUser?.id || !reviewThread?.id) return
    const body = String(reviewCommentDraft || '').trim()
    if (!body) return

    const commentsTable = reviewThread.__reviewTable === 'book_reviews' ? 'book_review_comments' : 'review_comments'

    try {
      const { error } = await supabase.from(commentsTable).insert({
        review_id: reviewThread.id,
        commenter_id: currentUser.id,
        commenter_username: currentUser.username,
        body,
      })
      if (error) throw error
      setReviewCommentDraft('')
      const { data } = await supabase
        .from(commentsTable)
        .select('*')
        .eq('review_id', reviewThread.id)
        .order('created_at', { ascending: true })
      setReviewComments(data || [])
    } catch (error) {
      console.error('[FEED] Post review comment failed:', error)
    }
  }

  const renderFeedItem = ({ item }) => {
    const likes = item.item_type === 'book_event' ? (feedLikes[item.id] || { count: 0, likedByMe: false }) : { count: 0, likedByMe: false }
    const eventText =
      item.event_type === 'created'
        ? 'added'
        : item.event_type === 'tags_updated'
        ? 'updated'
        : item.event_type === 'recommendation_sent'
        ? `recommended to @${item.recipient_username}`
        : item.event_type === 'recommendation_received'
        ? 'recommended to you'
        : item.event_type === 'review_created'
        ? 'reviewed'
        : item.event_type === 'review_updated'
        ? 'edited review'
        : item.event_type

    return (
      <TouchableOpacity 
        style={styles.feedItem}
        activeOpacity={0.8}
        onPress={() => {
          if (item.item_type === 'recommendation') {
            navigation.navigate('RecommendationsScreen', { selectedRecommendation: item })
            return
          }
          openReviewThread(item)
        }}
      >
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

        {item.item_type !== 'recommendation' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={styles.likeButton} 
              onPress={(e) => {
                e.stopPropagation()
                toggleLike(item.id)
              }}
            >
              <Text style={[styles.likeIcon, likes.likedByMe && styles.liked]}>
                {likes.likedByMe ? '❤️' : '🤍'}
              </Text>
              {likes.count > 0 && <Text style={styles.likeCount}>{likes.count}</Text>}
            </TouchableOpacity>

            <Text style={styles.commentButtonText}>💬 Tap to comment</Text>
          </View>
        )}
      </TouchableOpacity>
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  commentButtonText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '700',
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
})
