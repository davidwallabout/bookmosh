import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useNavigation, useIsFocused } from '@react-navigation/native'
import { SvgXml } from 'react-native-svg'
import { supabase } from '../lib/supabase'
import { PROFILE_ICONS } from '../constants/avatars'

export default function HomeScreen({ user }) {
  const navigation = useNavigation()
  const isFocused = useIsFocused()
  const [books, setBooks] = useState([])
  const [readingBooks, setReadingBooks] = useState([])
  const [toReadBooks, setToReadBooks] = useState([])
  const [readBooks, setReadBooks] = useState([])
  const [ownedBooks, setOwnedBooks] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadCurrentUser()
    loadBooks()
  }, [])

  useEffect(() => {
    if (isFocused) {
      loadBooks()
    }
  }, [isFocused])

  const loadCurrentUser = async () => {
    try {
      console.log('[USER] Loading current user for auth id:', user.id)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      console.log('[USER] Query result:', { data, error })
      if (error) throw error
      console.log('[USER] Setting currentUser with id:', data?.id)
      setCurrentUser(data)
    } catch (error) {
      console.error('[USER] Load user error:', error)
    }
  }

  const loadBooks = async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single()

      if (userError) throw userError
      const username = userData?.username

      if (!username) {
        console.error('No username found for user')
        return
      }

      const { data, error } = await supabase
        .from('bookmosh_books')
        .select('*')
        .eq('owner', username)
        .order('updated_at', { ascending: false })

      if (error) throw error
      const allBooks = data || []
      setBooks(allBooks)
      
      setReadingBooks(allBooks.filter(b => b.status === 'Reading'))
      setToReadBooks(allBooks.filter(b => b.status === 'To Read' || b.status === 'to-read'))
      setReadBooks(
        allBooks
          .filter((b) => b.status === 'Read')
          .sort((a, b) => {
            const aKey = new Date(a.read_at ?? a.updated_at ?? 0).getTime()
            const bKey = new Date(b.read_at ?? b.updated_at ?? 0).getTime()
            return bKey - aKey
          }),
      )
      setOwnedBooks(allBooks.filter(b => Array.isArray(b.tags) && b.tags.includes('Owned')))
    } catch (error) {
      console.error('Load books error:', error)
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
              await loadBooks()
            } catch (error) {
              Alert.alert('Error', error.message)
            }
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require('../assets/bookmosh-vert.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.avatarButton}
        >
          {currentUser?.avatar_url ? (
            <Image
              source={{ uri: currentUser.avatar_url }}
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

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true)
              await Promise.all([loadBooks()])
              setRefreshing(false)
            }}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
          />
        }
      >
        {readingBooks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>READING</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('FullLibraryScreen', { filter: 'reading' })}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllText}>View All →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {readingBooks.slice(0, 3).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.bookCard}
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
                  <Text style={styles.bookCardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.bookCardAuthor} numberOfLines={1}>{item.author}</Text>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation()
                      deleteBook(item.id)
                    }}
                    style={styles.deleteCardButton}
                  >
                    <Text style={styles.deleteCardButtonText}>×</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {toReadBooks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TO READ</Text>
              {toReadBooks.length > 3 && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('FullLibraryScreen', { filter: 'to-read' })}
                  style={styles.viewAllButton}
                >
                  <Text style={styles.viewAllText}>View All →</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {toReadBooks.slice(0, 3).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.bookCard}
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
                  <Text style={styles.bookCardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.bookCardAuthor} numberOfLines={1}>{item.author}</Text>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation()
                      deleteBook(item.id)
                    }}
                    style={styles.deleteCardButton}
                  >
                    <Text style={styles.deleteCardButtonText}>×</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {readBooks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>READ</Text>
              {readBooks.length > 3 && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('FullLibraryScreen', { filter: 'read' })}
                  style={styles.viewAllButton}
                >
                  <Text style={styles.viewAllText}>View All →</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {readBooks.slice(0, 3).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.bookCard}
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
                  <Text style={styles.bookCardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.bookCardAuthor} numberOfLines={1}>{item.author}</Text>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation()
                      deleteBook(item.id)
                    }}
                    style={styles.deleteCardButton}
                  >
                    <Text style={styles.deleteCardButtonText}>×</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {ownedBooks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>OWNED</Text>
              {ownedBooks.length > 3 && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('FullLibraryScreen', { filter: 'owned' })}
                  style={styles.viewAllButton}
                >
                  <Text style={styles.viewAllText}>View All →</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {ownedBooks.slice(0, 3).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.bookCard}
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
                  <Text style={styles.bookCardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.bookCardAuthor} numberOfLines={1}>{item.author}</Text>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation()
                      deleteBook(item.id)
                    }}
                    style={styles.deleteCardButton}
                  >
                    <Text style={styles.deleteCardButtonText}>×</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {books.length === 0 && (
          <Text style={styles.emptyText}>No books yet. Add one above!</Text>
        )}
      </ScrollView>
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
  scrollContent: {
    paddingTop: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  listsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addListButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addListButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3b82f6',
    marginTop: -2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1.5,
  },
  viewAllButton: {
    padding: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
  },
  bookCard: {
    width: 120,
    marginRight: 15,
    marginLeft: 20,
    position: 'relative',
  },
  bookCover: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
  },
  bookCoverPlaceholder: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 40,
  },
  bookCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
    lineHeight: 16,
  },
  bookCardAuthor: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  deleteCardButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteCardButtonText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    marginTop: 20,
  },
  listCard: {
    width: 200,
    marginRight: 15,
    marginLeft: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
  },
  listCardContent: {
    gap: 8,
  },
  listCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  listCardCount: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listCardDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 18,
  },
  recommendationsLoadingRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  recommendationsLoadingText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  recommendationsFeed: {
    paddingHorizontal: 20,
    gap: 12,
  },
  recommendationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 14,
  },
  recommendationHeadline: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.55)',
    marginBottom: 10,
  },
  recommendationBookRow: {
    flexDirection: 'row',
    gap: 12,
  },
  recommendationCover: {
    width: 56,
    height: 82,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  recommendationCoverPlaceholder: {
    width: 56,
    height: 82,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendationCoverPlaceholderText: {
    fontSize: 24,
  },
  recommendationBookInfo: {
    flex: 1,
    gap: 6,
  },
  recommendationBookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 18,
  },
  recommendationBookAuthor: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  recommendationNote: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    lineHeight: 16,
  },
  recommendationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  recommendationModalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  recommendationModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  recommendationModalHeadline: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 16,
  },
  recommendationModalBookRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  recommendationModalCover: {
    width: 70,
    height: 100,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  recommendationModalNote: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    marginBottom: 14,
  },
  recommendationModalAction: {
    backgroundColor: 'rgba(238, 107, 254, 0.12)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(238, 107, 254, 0.35)',
    marginBottom: 12,
  },
  recommendationModalActionText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#ee6bfe',
    textTransform: 'uppercase',
  },
  recommendationModalClose: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  recommendationModalCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  recCarouselCard: {
    width: 120,
    marginRight: 15,
    marginLeft: 20,
  },
  recCarouselHeadline: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
})
