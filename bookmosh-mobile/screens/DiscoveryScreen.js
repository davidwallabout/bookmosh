import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Animated,
} from 'react-native'
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native'
import { SvgXml } from 'react-native-svg'
import { supabase } from '../lib/supabase'
import { PROFILE_ICONS } from '../constants/avatars'

const PIXEL_DISCOVERY_ICON = (color) => `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="4" width="2" height="2" fill="${color}"/>
  <rect x="10" y="4" width="2" height="2" fill="${color}"/>
  <rect x="6" y="6" width="2" height="2" fill="${color}"/>
  <rect x="12" y="6" width="2" height="2" fill="${color}"/>
  <rect x="4" y="8" width="2" height="2" fill="${color}"/>
  <rect x="14" y="8" width="2" height="2" fill="${color}"/>
  <rect x="4" y="10" width="2" height="2" fill="${color}"/>
  <rect x="14" y="10" width="2" height="2" fill="${color}"/>
  <rect x="6" y="12" width="2" height="2" fill="${color}"/>
  <rect x="12" y="12" width="2" height="2" fill="${color}"/>
  <rect x="8" y="14" width="2" height="2" fill="${color}"/>
  <rect x="10" y="14" width="2" height="2" fill="${color}"/>
  <rect x="14" y="14" width="2" height="2" fill="${color}"/>
  <rect x="16" y="16" width="2" height="2" fill="${color}"/>
  <rect x="18" y="18" width="2" height="2" fill="${color}"/>
  <rect x="20" y="20" width="2" height="2" fill="${color}"/>
</svg>`

export default function DiscoveryScreen({ user }) {
  const navigation = useNavigation()
  const route = useRoute()
  const isFocused = useIsFocused()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [userAvatar, setUserAvatar] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [authorSearchMode, setAuthorSearchMode] = useState(false)
  const searchTimeoutRef = React.useRef(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [bookToAdd, setBookToAdd] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('To Read')
  const [isOwned, setIsOwned] = useState(false)
  const [showBookDetail, setShowBookDetail] = useState(false)
  const [detailBook, setDetailBook] = useState(null)
  const [searchHistory, setSearchHistory] = useState([])

  const placeholderScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    const shouldAnimate = isFocused && !hasSearched && !isSearching
    if (!shouldAnimate) return

    placeholderScale.setValue(0.85)
    Animated.sequence([
      Animated.spring(placeholderScale, {
        toValue: 1.08,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.spring(placeholderScale, {
        toValue: 1,
        friction: 5,
        tension: 110,
        useNativeDriver: true,
      }),
    ]).start()
  }, [isFocused, hasSearched, isSearching, placeholderScale])

  // Auto-search as user types with debounce
  useEffect(() => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Don't search if query is empty or too short
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([])
      setHasSearched(false)
      return
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchBooksWithQuery(searchQuery)
    }, 500) // 500ms debounce

    // Cleanup timeout on unmount or when searchQuery changes
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  useEffect(() => {
    const authorSearch = route.params?.authorSearch
    if (authorSearch) {
      setSearchQuery(authorSearch)
      setAuthorSearchMode(true)
      // Auto-search will trigger via the searchQuery useEffect
    }
  }, [route.params?.authorSearch])

  useEffect(() => {
    const initialQuery = route.params?.initialQuery
    if (initialQuery) {
      setSearchQuery(initialQuery)
      setAuthorSearchMode(false)
      // Auto-search will trigger via the searchQuery useEffect
    }
  }, [route.params?.initialQuery])

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

  const invokeIsbndbSearch = async ({ q, pageSize = 20 }) => {
    try {
      // Try using the Edge Function first
      const { data, error } = await supabase.functions.invoke('isbndb-search', {
        body: { q, pageSize },
      })
      
      if (error) {
        // Silently fallback to direct HTTP call if Edge Function fails
        const supabaseUrl = supabase.supabaseUrl
        const supabaseKey = supabase.supabaseKey
        
        if (supabaseUrl && supabaseKey) {
          const response = await fetch(`${supabaseUrl}/functions/v1/isbndb-search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
            body: JSON.stringify({ q, pageSize }),
          })
          
          if (response.ok) {
            const fallbackData = await response.json()
            return fallbackData
          } else {
            console.error('ISBNdb search failed:', response.status, response.statusText)
          }
        }
        
        return { books: [] }
      }
      
      return data
    } catch (error) {
      console.error('ISBNdb search error:', error)
      return { books: [] }
    }
  }

  const computeRelevance = (title, author, termWords) => {
    let score = 0
    const titleLower = (title || '').toLowerCase()
    const authorLower = (author || '').toLowerCase()
    
    for (const word of termWords) {
      const wordLower = word.toLowerCase()
      if (titleLower.includes(wordLower)) score += 2
      if (authorLower.includes(wordLower)) score += 1
    }
    return score
  }

  const searchBooksWithQuery = async (query) => {
    if (!query.trim()) {
      setHasSearched(false)
      setSearchResults([])
      return
    }

    setIsSearching(true)
    setHasSearched(true)

    try {
      const trimmed = query.trim()
      const termWords = trimmed.split(/\s+/).filter(Boolean)

      console.log('[SEARCH] Searching for:', trimmed)
      const isbndbData = await invokeIsbndbSearch({ q: trimmed, pageSize: 50 })
      
      if (!isbndbData) {
        Alert.alert('Search Error', 'Book search is currently unavailable. Please check your internet connection or try again later.')
        setSearchResults([])
        setIsSearching(false)
        return
      }
      
      let isbndbBooks = Array.isArray(isbndbData?.books)
        ? isbndbData.books
        : Array.isArray(isbndbData?.data)
        ? isbndbData.data
        : []

      console.log('[SEARCH] Initial results:', isbndbBooks.length)

      // If query contains apostrophes (straight ' or curly '), always try without apostrophes as fallback
      // ISBNdb API often fails to find books with apostrophes in titles
      if (trimmed.includes("'") || trimmed.includes("'") || trimmed.includes("'")) {
        const queryWithoutApostrophes = trimmed.replace(/[''']/g, '')
        console.log('[SEARCH] Trying fallback without apostrophes:', queryWithoutApostrophes)
        const fallbackData = await invokeIsbndbSearch({ q: queryWithoutApostrophes, pageSize: 50 })
        const fallbackBooks = Array.isArray(fallbackData?.books)
          ? fallbackData.books
          : Array.isArray(fallbackData?.data)
          ? fallbackData.data
          : []
        console.log('[SEARCH] Fallback results:', fallbackBooks.length)
        if (Array.isArray(fallbackBooks) && fallbackBooks.length > 0) {
          isbndbBooks = [...isbndbBooks, ...fallbackBooks]
        }
      }

      console.log('[SEARCH] Total books before mapping:', isbndbBooks.length)

      const mapped = isbndbBooks
        .map((b) => {
          if (!b) return null
          const title = b.title ?? b.title_long ?? null
          if (!title) return null

          const authors = Array.isArray(b.authors) ? b.authors : []
          const author = authors[0] ?? b.author ?? 'Unknown author'
          const isbn13 = b.isbn13 ?? null
          const isbn = isbn13 || b.isbn || b.isbn10 || null
          
          let cover = b.image || b.image_url || null
          if (typeof cover === 'string' && cover.startsWith('http://')) {
            cover = `https://${cover.slice('http://'.length)}`
          }

          const date = String(b.date_published ?? '')
          const year = date ? Number(date.slice(0, 4)) || null : null

          const relevance = computeRelevance(title, author, termWords)

          return {
            key: isbn || `${title}-${author}`,
            title,
            author,
            cover,
            isbn,
            year,
            relevance,
          }
        })
        .filter(Boolean)

      mapped.sort((a, b) => (b.relevance || 0) - (a.relevance || 0))

      setSearchResults(mapped)
    } catch (error) {
      console.error('Search error:', error)
      Alert.alert('Error', 'Failed to search books')
    } finally {
      setIsSearching(false)
    }
  }

  const searchBooks = async () => {
    setAuthorSearchMode(false)
    await searchBooksWithQuery(searchQuery)
  }

  const searchBooksByAuthor = async () => {

    setAuthorSearchMode(true)
    await searchBooksWithQuery(searchQuery)
  }

  const openAddModal = (book) => {
    setBookToAdd(book)
    setSelectedStatus('To Read')
    setIsOwned(false)
    setShowAddModal(true)
  }

  const addBookToLibrary = async () => {
    if (!currentUser || !bookToAdd) {
      console.log('[ADD BOOK] Missing currentUser or bookToAdd:', { currentUser: !!currentUser, bookToAdd: !!bookToAdd })
      Alert.alert('Error', 'Please wait for your profile to load')
      return
    }

    try {
      const tags = [selectedStatus]
      if (isOwned) {
        tags.push('Owned')
      }

      const payload = {
        owner: currentUser.username,
        title: bookToAdd.title,
        author: bookToAdd.author,
        cover: bookToAdd.cover,
        status: selectedStatus,
        tags: tags,
        progress: selectedStatus === 'Read' ? 100 : 0,
        rating: 0,
        read_at: selectedStatus === 'Read' ? new Date().toISOString() : null,
        status_updated_at: new Date().toISOString(),
      }

      console.log('[ADD BOOK] Inserting book with payload:', payload)
      let { error } = await supabase.from('bookmosh_books').upsert([payload], { onConflict: 'owner,title' })

      if (error && String(error.code) === '42703') {
        const msg = String(error.message || '')
        const fallbackPayload = { ...payload }
        if (msg.includes('read_at')) delete fallbackPayload.read_at
        if (msg.includes('status_updated_at')) delete fallbackPayload.status_updated_at
        console.log('[ADD BOOK] Retrying with fallback payload:', fallbackPayload)
        ;({ error } = await supabase.from('bookmosh_books').upsert([fallbackPayload], { onConflict: 'owner,title' }))
      }

      if (error) {
        console.error('[ADD BOOK] Insert error:', error)
        throw error
      }
      console.log('[ADD BOOK] Success!')
      setShowAddModal(false)
      Alert.alert('Success', `Added "${bookToAdd.title}" to your library!`)
    } catch (error) {
      console.error('Add book error:', error)
      Alert.alert('Error', error.message)
    }
  }

  const navigateToAuthorBooks = (authorName) => {
    // Save current search to history
    if (searchQuery && searchQuery !== authorName) {
      setSearchHistory(prev => [...prev, { query: searchQuery, results: searchResults }])
    }
    setSearchQuery(authorName)
    setAuthorSearchMode(true)
    searchBooksWithQuery(authorName)
  }

  const goBackToPreviousSearch = () => {
    if (searchHistory.length === 0) return
    
    const previous = searchHistory[searchHistory.length - 1]
    setSearchQuery(previous.query)
    setSearchResults(previous.results)
    setHasSearched(true)
    setAuthorSearchMode(false)
    setSearchHistory(prev => prev.slice(0, -1))
  }

  const openBookDetail = (book) => {
    navigation.navigate('BookDetailScreen', { 
      book: {
        title: book.title,
        author: book.author,
        cover: book.cover,
        isbn: book.isbn,
        year: book.year,
      }
    })
  }

  const renderBookResult = ({ item }) => (
    <View style={styles.bookResult}>
      <TouchableOpacity
        style={styles.bookResultContent}
        onPress={() => openBookDetail(item)}
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
          <Text style={styles.bookTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <TouchableOpacity onPress={(e) => {
            e.stopPropagation()
            navigateToAuthorBooks(item.author)
          }}>
            <Text style={[styles.bookAuthor, styles.bookAuthorClickable]} numberOfLines={1}>
              {item.author}
            </Text>
          </TouchableOpacity>
          {item.year && (
            <Text style={styles.bookYear}>{item.year}</Text>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => openAddModal(item)}
      >
        <Text style={styles.addButtonText}>+ Add</Text>
      </TouchableOpacity>
    </View>
  )

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
            <Image source={{ uri: userAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <SvgXml
                xml={
                  PROFILE_ICONS.find((i) => i.id === currentUser?.avatar_icon)
                    ?.svg || PROFILE_ICONS[0].svg
                }
                width="100%"
                height="100%"
              />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <Text style={styles.sectionTitle}>DISCOVERY</Text>
        
        <View style={styles.searchContainer}>
          {searchHistory.length > 0 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={goBackToPreviousSearch}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
          )}
          <TextInput
            style={[styles.searchInput, searchHistory.length > 0 && styles.searchInputWithBack]}
            placeholder="Search books, authors..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchBooks}
          />
          <TouchableOpacity
            style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
            onPress={searchBooks}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {isSearching && !hasSearched && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {hasSearched && !isSearching && searchResults.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No books found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      )}

      {searchResults.length > 0 && (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.key}
          renderItem={renderBookResult}
          contentContainerStyle={styles.resultsList}
        />
      )}

      {!hasSearched && !isSearching && (
        <View style={styles.placeholderContainer}>
          <Animated.View style={[styles.placeholderEmoji, { transform: [{ scale: placeholderScale }] }]}>
            <SvgXml xml={PIXEL_DISCOVERY_ICON('#ee6bfe')} width={104} height={104} />
          </Animated.View>
          <Text style={styles.placeholderText}>
            Search for books by title or author
          </Text>
        </View>
      )}

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add to Library</Text>
            
            {bookToAdd && (
              <View style={styles.modalBookInfo}>
                <Text style={styles.modalBookTitle}>{bookToAdd.title}</Text>
                <Text style={styles.modalBookAuthor}>{bookToAdd.author}</Text>
              </View>
            )}

            <Text style={styles.modalLabel}>Status</Text>
            <View style={styles.statusOptions}>
              {['To Read', 'Reading', 'Read'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusOption,
                    selectedStatus === status && styles.statusOptionSelected,
                  ]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      selectedStatus === status && styles.statusOptionTextSelected,
                    ]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.ownedCheckbox}
              onPress={() => setIsOwned(!isOwned)}
            >
              <View style={[styles.checkbox, isOwned && styles.checkboxChecked]}>
                {isOwned && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.ownedLabel}>Mark as Owned</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalAddButton}
                onPress={addBookToLibrary}
              >
                <Text style={styles.modalAddButtonText}>Add Book</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBookDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBookDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.detailScrollContent}>
            <View style={styles.detailModalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowBookDetail(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>

              {detailBook && (
                <>
                  <View style={styles.detailHeader}>
                    {detailBook.cover ? (
                      <Image source={{ uri: detailBook.cover }} style={styles.detailCover} />
                    ) : (
                      <View style={styles.detailCoverPlaceholder}>
                        <Text style={styles.detailPlaceholderText}>📚</Text>
                      </View>
                    )}
                    <View style={styles.detailInfo}>
                      <Text style={styles.detailTitle}>{detailBook.title}</Text>
                      <TouchableOpacity onPress={() => {
                        setShowBookDetail(false)
                        navigateToAuthorBooks(detailBook.author)
                      }}>
                        <Text style={styles.detailAuthor}>{detailBook.author}</Text>
                      </TouchableOpacity>
                      {detailBook.year && (
                        <Text style={styles.detailYear}>Published: {detailBook.year}</Text>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.detailAddButton}
                    onPress={() => {
                      setShowBookDetail(false)
                      openAddModal(detailBook)
                    }}
                  >
                    <Text style={styles.detailAddButtonText}>+ Add to Library</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
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
  searchSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 10,
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
  searchInputWithBack: {
    marginLeft: 8,
  },
  backButton: {
    width: 40,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
  },
  backButtonText: {
    fontSize: 24,
    color: '#3b82f6',
    fontWeight: '600',
  },
  searchButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    minWidth: 90,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  placeholderEmoji: {
    marginBottom: 28,
  },
  placeholderText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalBookInfo: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalBookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  modalBookAuthor: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  statusOptionSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3b82f6',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  statusOptionTextSelected: {
    color: '#3b82f6',
  },
  ownedCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  ownedLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  modalAddButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  modalAddButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  detailScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  detailModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '300',
  },
  detailHeader: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  detailCover: {
    width: 120,
    height: 180,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 16,
  },
  detailCoverPlaceholder: {
    width: 120,
    height: 180,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailPlaceholderText: {
    fontSize: 40,
  },
  detailInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 26,
  },
  detailAuthor: {
    fontSize: 16,
    color: '#3b82f6',
    marginBottom: 8,
    textDecorationLine: 'underline',
  },
  detailYear: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  detailAddButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  detailAddButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  resultsList: {
    padding: 15,
  },
  bookResult: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    marginBottom: 12,
  },
  bookResultContent: {
    flexDirection: 'row',
    marginBottom: 12,
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
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
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
  bookAuthorClickable: {
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  bookYear: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  addButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
})
