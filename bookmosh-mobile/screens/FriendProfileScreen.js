import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { SvgXml } from 'react-native-svg'
import { supabase } from '../lib/supabase'
import { PROFILE_ICONS } from '../constants/avatars'

export default function FriendProfileScreen({ user }) {
  const navigation = useNavigation()
  const route = useRoute()
  const friendUsername = route.params?.friendUsername

  const [loading, setLoading] = useState(true)
  const [friend, setFriend] = useState(null)
  const [friendBooks, setFriendBooks] = useState([])
  const [stats, setStats] = useState({ books: 0, friends: 0 })
  const [topBooks, setTopBooks] = useState([])

  const isCoverUrl = (value) => {
    const v = (value ?? '').toString().trim()
    return v.startsWith('http') || v.startsWith('data:image')
  }

  const normalizeTitle = (value) =>
    (value ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')

  useEffect(() => {
    if (friendUsername) {
      loadFriendProfile()
    }
  }, [friendUsername])

  const loadFriendProfile = async () => {
    try {
      setLoading(true)

      // Load friend user data
      const { data: friendData, error: friendError } = await supabase
        .from('users')
        .select('*')
        .eq('username', friendUsername)
        .single()

      if (friendError) throw friendError
      setFriend(friendData)

      // Load friend's library
      const { data: booksData, error: booksError } = await supabase
        .from('bookmosh_books')
        .select('id, title, author, cover, status')
        .eq('owner', friendUsername)
        .order('updated_at', { ascending: false })
        .limit(250)

      if (booksError) throw booksError
      setFriendBooks(booksData || [])

      // Load top books (resolve titles to cover URLs when needed)
      const rawTop = Array.isArray(friendData?.top_books) ? friendData.top_books : []
      const top4 = rawTop.slice(0, 4)
      const byTitle = new Map(
        (Array.isArray(booksData) ? booksData : []).map((b) => [normalizeTitle(b.title), b])
      )
      const resolvedTop = top4.map((v) => {
        if (!v) return ''
        if (isCoverUrl(v)) return v
        const match = byTitle.get(normalizeTitle(v))
        return match?.cover && isCoverUrl(match.cover) ? match.cover : ''
      })
      setTopBooks(resolvedTop)

      // Set stats
      setStats({
        books: booksData?.length || 0,
        friends: friendData?.friends?.length || 0,
      })
    } catch (error) {
      console.error('Load friend profile error:', error)
    } finally {
      setLoading(false)
    }
  }

  const navigateToAuthorSearch = (author) => {
    navigation.navigate('Tabs', {
      screen: 'Discovery',
      params: { authorSearch: author },
    })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    )
  }

  if (!friend) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Friend not found</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friend Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {friend.avatar_url ? (
              <Image source={{ uri: friend.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <SvgXml
                  xml={
                    PROFILE_ICONS.find((i) => i.id === friend.avatar_icon)?.svg ||
                    PROFILE_ICONS[0].svg
                  }
                  width="100%"
                  height="100%"
                />
              </View>
            )}
          </View>

          <Text style={styles.username}>@{friend.username}</Text>
        </View>

        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.books}</Text>
            <Text style={styles.statLabel}>Books</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.friends}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
        </View>

        {topBooks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TOP 4 BOOKS</Text>
            <View style={styles.topBooksGrid}>
              {topBooks.slice(0, 4).map((bookCover, index) => {
                // Find the book in friendBooks that matches this cover
                const matchingBook = friendBooks.find(b => b.cover === bookCover)
                
                return (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.topBookSlot}
                    onPress={() => matchingBook && navigation.navigate('BookDetailScreen', { bookId: matchingBook.id })}
                    disabled={!matchingBook}
                    activeOpacity={matchingBook ? 0.7 : 1}
                  >
                    {bookCover && isCoverUrl(bookCover) ? (
                      <Image source={{ uri: bookCover }} style={styles.topBookCover} />
                    ) : (
                      <View style={styles.topBookPlaceholder}>
                        <Text style={styles.topBookPlaceholderText}>📚</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LIBRARY ({friendBooks.length})</Text>
          {friendBooks.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {friendBooks.map((book) => (
                <TouchableOpacity 
                  key={book.id} 
                  style={styles.bookCard}
                  onPress={() => navigation.navigate('BookDetailScreen', { bookId: book.id })}
                  activeOpacity={0.7}
                >
                  {book.cover ? (
                    <Image source={{ uri: book.cover }} style={styles.bookCover} />
                  ) : (
                    <View style={styles.bookCoverPlaceholder}>
                      <Text style={styles.placeholderText}>📚</Text>
                    </View>
                  )}
                  <Text style={styles.bookCardTitle} numberOfLines={2}>
                    {book.title}
                  </Text>
                  <TouchableOpacity onPress={(e) => {
                    e.stopPropagation()
                    navigateToAuthorSearch(book.author)
                  }}>
                    <Text style={styles.bookCardAuthor} numberOfLines={1}>
                      {book.author}
                    </Text>
                  </TouchableOpacity>
                  {book.status && (
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{book.status}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>No books yet</Text>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
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
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  email: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  statsSection: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1.5,
    marginBottom: 15,
  },
  topBooksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  topBookSlot: {
    width: '48%',
    aspectRatio: 2 / 3,
  },
  topBookCover: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  topBookPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBookPlaceholderText: {
    fontSize: 40,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  bookCard: {
    width: 120,
    marginRight: 15,
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
    color: '#3b82f6',
    marginBottom: 4,
    textDecorationLine: 'underline',
  },
  statusBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3b82f6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    marginTop: 20,
  },
})
