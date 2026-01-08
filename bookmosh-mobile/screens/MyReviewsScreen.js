import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'

const formatTimeAgo = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function MyReviewsScreen({ user }) {
  const navigation = useNavigation()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadReviews()
  }, [])

  const loadReviews = async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from('book_reviews')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      // PGRST205 = table/column doesn't exist - treat as empty silently
      if (error && (error.code === 'PGRST205' || error.code === '42P01')) {
        setReviews([])
        return
      }
      if (error) throw error
      setReviews(data || [])
    } catch (error) {
      // Suppress PGRST205 errors (table doesn't exist yet)
      if (error?.code === 'PGRST205' || error?.code === '42P01') {
        setReviews([])
        return
      }
      console.error('[MY_REVIEWS] Load error:', error)
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadReviews()
    setRefreshing(false)
  }

  const openReview = (review) => {
    // Navigate to the book detail screen with the review
    if (review.book_id) {
      navigation.navigate('BookDetailScreen', { bookId: review.book_id })
    }
  }

  const filteredReviews = reviews.filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      (r.title || '').toLowerCase().includes(q) ||
      (r.body || '').toLowerCase().includes(q)
    )
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reviews</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search reviews..."
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
              colors={['#3b82f6']}
            />
          }
        >
          {filteredReviews.length > 0 ? (
            filteredReviews.map((review) => (
              <TouchableOpacity
                key={review.id}
                style={styles.reviewCard}
                activeOpacity={0.8}
                onPress={() => openReview(review)}
              >
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewTitle} numberOfLines={2}>
                    {review.title || 'Untitled Book'}
                  </Text>
                  <Text style={styles.reviewTime}>{formatTimeAgo(review.created_at)}</Text>
                </View>

                {review.spoiler_warning && (
                  <View style={styles.spoilerBadge}>
                    <Text style={styles.spoilerBadgeText}>⚠️ Spoilers</Text>
                  </View>
                )}

                <Text style={styles.reviewBody} numberOfLines={4}>
                  {review.body || 'No content'}
                </Text>

                {review.edited_at && (
                  <Text style={styles.editedLabel}>Edited {formatTimeAgo(review.edited_at)}</Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'No reviews match your search.'
                  : 'You haven\'t written any reviews yet.'}
              </Text>
              {!searchQuery.trim() && (
                <Text style={styles.emptySubtext}>
                  Go to a book and write a review to see it here.
                </Text>
              )}
            </View>
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
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSpacer: {
    width: 60,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    fontSize: 15,
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  reviewCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  reviewTime: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  spoilerBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  spoilerBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ef4444',
  },
  reviewBody: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  editedLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.35)',
    textAlign: 'center',
    marginTop: 8,
  },
})
