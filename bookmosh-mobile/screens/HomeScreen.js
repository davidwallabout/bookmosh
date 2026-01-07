import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { SvgXml } from 'react-native-svg'
import { supabase } from '../lib/supabase'
import { PROFILE_ICONS } from '../constants/avatars'

export default function HomeScreen({ user }) {
  const navigation = useNavigation()
  const [books, setBooks] = useState([])
  const [readingBooks, setReadingBooks] = useState([])
  const [toReadBooks, setToReadBooks] = useState([])
  const [readBooks, setReadBooks] = useState([])
  const [ownedBooks, setOwnedBooks] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [lists, setLists] = useState([])

  useEffect(() => {
    loadCurrentUser()
    loadBooks()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadLists()
    }
  }, [currentUser])

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
      setReadBooks(allBooks.filter(b => b.status === 'Read'))
      setOwnedBooks(allBooks.filter(b => Array.isArray(b.tags) && b.tags.includes('Owned')))
    } catch (error) {
      console.error('Load books error:', error)
    }
  }

  const loadLists = async () => {
    if (!currentUser) return

    try {
      console.log('[LISTS] Loading lists...')
      console.log('[LISTS] user.id (auth):', user.id)
      console.log('[LISTS] currentUser.id:', currentUser.id)
      console.log('[LISTS] currentUser.username:', currentUser.username)
      
      // Debug: Query by owner_username first to see if lists exist
      const { data: byUsername, error: usernameError } = await supabase
        .from('lists')
        .select('id, owner_id, owner_username, title')
        .eq('owner_username', currentUser.username)
        .limit(5)
      
      console.log('[LISTS] Lists by username:', { 
        count: byUsername?.length, 
        lists: byUsername?.map(l => ({ id: l.id, owner_id: l.owner_id, title: l.title })),
        error: usernameError 
      })
      
      // Query by owner_id using currentUser.id (same as web app)
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('owner_id', currentUser.id)
        .order('updated_at', { ascending: false })

      console.log('[LISTS] My lists by owner_id query result:', { count: data?.length, error })
      if (data?.length > 0) {
        console.log('[LISTS] First list:', data[0])
      }

      if (error) {
        console.error('[LISTS] Load lists error:', error)
        throw error
      }
      
      // If no lists found by owner_id but found by username, there's an ID mismatch
      if (data?.length === 0 && byUsername?.length > 0) {
        console.warn('[LISTS] ID MISMATCH DETECTED!')
        console.warn('[LISTS] currentUser.id:', currentUser.id)
        console.warn('[LISTS] List owner_id from DB:', byUsername[0]?.owner_id)
        // Use lists found by username as fallback
        const { data: fallbackData } = await supabase
          .from('lists')
          .select('*')
          .eq('owner_username', currentUser.username)
          .order('updated_at', { ascending: false })
        setLists(fallbackData || [])
        return
      }
      
      setLists(data || [])
    } catch (error) {
      console.error('[LISTS] Load lists error:', error)
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
          onPress={() => navigation.navigate('ProfileScreen')}
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
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

        {lists.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MY LISTS</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {lists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  style={styles.listCard}
                  activeOpacity={0.7}
                >
                  <View style={styles.listCardContent}>
                    <Text style={styles.listCardTitle} numberOfLines={2}>
                      {list.title}
                    </Text>
                    <Text style={styles.listCardCount}>
                      {list.book_ids?.length || 0} books
                    </Text>
                    {list.description && (
                      <Text style={styles.listCardDescription} numberOfLines={2}>
                        {list.description}
                      </Text>
                    )}
                  </View>
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
})
