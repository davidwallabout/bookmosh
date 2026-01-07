import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
  RefreshControl,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'

export default function FullLibraryScreen({ user }) {
  const navigation = useNavigation()
  const route = useRoute()
  const initialFilter = route.params?.filter || 'all'

  const [books, setBooks] = useState([])
  const [filter, setFilter] = useState(initialFilter)
  const [ownedFilter, setOwnedFilter] = useState('any')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const searchTimeoutRef = useRef(null)
  const prevFilterRef = useRef(filter)
  const prevOwnedFilterRef = useRef(ownedFilter)
  const LIMIT = 10
  const [refreshing, setRefreshing] = useState(false)

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

  useEffect(() => {
    const prevFilter = prevFilterRef.current
    prevFilterRef.current = filter

    const prevOwned = prevOwnedFilterRef.current
    prevOwnedFilterRef.current = ownedFilter

    // If filter changed, refresh immediately. If only search changed, debounce.
    if (prevFilter !== filter || prevOwned !== ownedFilter) {
      loadBooks(true)
      return
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      loadBooks(true)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [filter, ownedFilter, searchQuery])

  const loadBooks = async (reset = false, isRefresh = false) => {
    if ((loading || loadingMore) && !isRefresh) return

    const currentOffset = reset ? 0 : offset
    
    if (reset) {
      // Don't set loading=true during refresh - let RefreshControl handle the spinner
      if (!isRefresh) {
        setLoading(true)
        setBooks([])
      }
      setOffset(0)
      setHasMore(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single()

      if (userError) throw userError
      const username = userData?.username

      if (!username) return

      const q = String(searchQuery || '').trim()
      const safeQ = q.replace(/,/g, ' ')

      let query = supabase
        .from('bookmosh_books')
        .select('*')
        .eq('owner', username)
        .order('status_updated_at', { ascending: false })
        .range(currentOffset, currentOffset + LIMIT - 1)

      if (filter === 'reading') {
        query = query.eq('status', 'Reading')
      } else if (filter === 'to-read') {
        query = query.or('status.eq.To Read,status.eq.to-read')
      } else if (filter === 'read') {
        query = query.eq('status', 'Read')
      }

      if (ownedFilter === 'owned') {
        query = query.contains('tags', ['Owned'])
      } else if (ownedFilter === 'not-owned') {
        // Note: this may exclude rows where tags is NULL. If tags is always an array, it's fine.
        query = query.not('tags', 'cs', '{Owned}')
      }

      if (safeQ) {
        // Search by title OR author
        query = query.or(`title.ilike.%${safeQ}%,author.ilike.%${safeQ}%`)
      }

      let { data, error } = await query

      if (error && String(error.code) === '42703' && String(error.message || '').includes('status_updated_at')) {
        let fallbackQuery = supabase
          .from('bookmosh_books')
          .select('*')
          .eq('owner', username)
          .order('updated_at', { ascending: false })
          .range(currentOffset, currentOffset + LIMIT - 1)

        if (filter === 'reading') {
          fallbackQuery = fallbackQuery.eq('status', 'Reading')
        } else if (filter === 'to-read') {
          fallbackQuery = fallbackQuery.or('status.eq.To Read,status.eq.to-read')
        } else if (filter === 'read') {
          fallbackQuery = fallbackQuery.eq('status', 'Read')
        }

        if (ownedFilter === 'owned') {
          fallbackQuery = fallbackQuery.contains('tags', ['Owned'])
        } else if (ownedFilter === 'not-owned') {
          fallbackQuery = fallbackQuery.not('tags', 'cs', '{Owned}')
        }

        if (safeQ) {
          fallbackQuery = fallbackQuery.or(`title.ilike.%${safeQ}%,author.ilike.%${safeQ}%`)
        }

        const fallback = await fallbackQuery
        data = fallback.data
        error = fallback.error
      }

      if (error) throw error

      const newBooks = data || []
      
      if (reset) {
        setBooks(newBooks)
      } else {
        setBooks(prev => [...prev, ...newBooks])
      }

      setHasMore(newBooks.length === LIMIT)
      setOffset(currentOffset + newBooks.length)
    } catch (error) {
      console.error('Load books error:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadBooks(false)
    }
  }

  const deleteBook = async (bookId) => {
    Alert.alert(
      'Delete Book',
      'Are you sure you want to delete this book?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('bookmosh_books').delete().eq('id', bookId)
              if (error) throw error
              setBooks(prev => prev.filter(b => b.id !== bookId))
            } catch (error) {
              console.error('Delete book error:', error)
            }
          },
        },
      ]
    )
  }

  const renderBook = ({ item }) => (
    <TouchableOpacity
      style={styles.bookItem}
      onPress={() => navigation.navigate('BookDetailScreen', { bookId: item.id })}
      activeOpacity={0.7}
    >
      {item.cover ? (
        <Image source={{ uri: item.cover }} style={styles.bookCover} />
      ) : (
        <View style={styles.bookCoverPlaceholder}>
          <Text style={styles.placeholderText}>📚</Text>
        </View>
      )}
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>{item.author}</Text>
        <Text style={styles.bookTimestamp}>
          Marked {item.status}{' '}
          {formatTimeAgo(item.status_updated_at ?? item.read_at ?? item.updated_at)}
        </Text>
        <View style={styles.tagsRow}>
          {item.status ? (
            <View style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>
                {String(item.status).toUpperCase()}
              </Text>
            </View>
          ) : null}
          {Array.isArray(item.tags) && item.tags.includes('Owned') ? (
            <View style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>OWNED</Text>
            </View>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation()
          deleteBook(item.id)
        }}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteButtonText}>×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )

  const renderFooter = () => {
    if (!loadingMore) return null
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3b82f6" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Library</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {['all', 'reading', 'to-read', 'read'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterButton, filter === f && styles.filterButtonActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              <Text
                numberOfLines={1}
                style={[styles.filterButtonText, filter === f && styles.filterButtonTextActive]}
              >
                {f === 'all'
                  ? 'All'
                  : f === 'reading'
                  ? 'Reading'
                  : f === 'to-read'
                  ? 'To Read'
                  : 'Read'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.ownedFilterRow}>
        <TouchableOpacity
          onPress={() => setOwnedFilter('any')}
          style={[styles.ownedPill, ownedFilter === 'any' && styles.ownedPillActive]}
        >
          <Text numberOfLines={1} style={[styles.ownedPillText, ownedFilter === 'any' && styles.ownedPillTextActive]}>Any</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOwnedFilter('owned')}
          style={[styles.ownedPill, ownedFilter === 'owned' && styles.ownedPillActive]}
        >
          <Text numberOfLines={1} style={[styles.ownedPillText, ownedFilter === 'owned' && styles.ownedPillTextActive]}>Owned</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOwnedFilter('not-owned')}
          style={[styles.ownedPill, ownedFilter === 'not-owned' && styles.ownedPillActive]}
        >
          <Text numberOfLines={1} style={[styles.ownedPillText, ownedFilter === 'not-owned' && styles.ownedPillTextActive]}>Not Owned</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search your library..."
          placeholderTextColor="rgba(255, 255, 255, 0.35)"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderBook}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No books in this category</Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true)
                await loadBooks(true, true)
                setRefreshing(false)
              }}
              tintColor="#3b82f6"
              colors={['#3b82f6']}
            />
          }
        />
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
  filterContainer: {
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 15,
  },
  filterScrollContent: {
    paddingVertical: 6,
    paddingRight: 10,
    gap: 10,
  },
  searchContainer: {
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filterButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    minWidth: 92,
  },
  filterButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterButtonText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    flexShrink: 0,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  ownedFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 6,
    gap: 10,
  },
  ownedPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  ownedPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  ownedPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ownedPillTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookItem: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 15,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  bookCover: {
    width: 60,
    height: 90,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 12,
  },
  bookCoverPlaceholder: {
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
  placeholderText: {
    fontSize: 30,
  },
  bookInfo: {
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
    marginBottom: 4,
  },
  bookTimestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.35)',
    marginBottom: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 8,
    marginBottom: 6,
    flexShrink: 0,
  },
  tagText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 24,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    marginTop: 40,
  },
})
