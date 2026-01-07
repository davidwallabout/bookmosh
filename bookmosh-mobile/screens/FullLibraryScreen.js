import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'

export default function FullLibraryScreen({ user }) {
  const navigation = useNavigation()
  const route = useRoute()
  const initialFilter = route.params?.filter || 'all'

  const [books, setBooks] = useState([])
  const [filter, setFilter] = useState(initialFilter)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const LIMIT = 10

  useEffect(() => {
    loadBooks(true)
  }, [filter])

  const loadBooks = async (reset = false) => {
    if (loading || loadingMore) return

    const currentOffset = reset ? 0 : offset
    
    if (reset) {
      setLoading(true)
      setBooks([])
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

      let query = supabase
        .from('bookmosh_books')
        .select('*')
        .eq('owner', username)
        .order('updated_at', { ascending: false })
        .range(currentOffset, currentOffset + LIMIT - 1)

      if (filter === 'reading') {
        query = query.eq('status', 'Reading')
      } else if (filter === 'to-read') {
        query = query.or('status.eq.To Read,status.eq.to-read')
      } else if (filter === 'read') {
        query = query.eq('status', 'Read')
      }

      const { data, error } = await query

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
        <Text style={styles.bookStatus}>{item.status}</Text>
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
        {['all', 'reading', 'to-read', 'read'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterButtonText, filter === f && styles.filterButtonTextActive]}>
              {f === 'all' ? 'All' : f === 'reading' ? 'Reading' : f === 'to-read' ? 'To Read' : 'Read'}
            </Text>
          </TouchableOpacity>
        ))}
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
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
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
  },
  filterButtonTextActive: {
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
  bookStatus: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
