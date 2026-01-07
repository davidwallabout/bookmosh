import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'

const statusOptions = ['Reading', 'To Read', 'Read', 'DNF']

export default function BookDetailScreen({ user }) {
  const navigation = useNavigation()
  const route = useRoute()
  const bookId = route.params?.bookId

  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [bookActivity, setBookActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)

  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [status, setStatus] = useState('Reading')
  const [rating, setRating] = useState(0)
  const [progress, setProgress] = useState(0)
  const [review, setReview] = useState('')

  useEffect(() => {
    loadCurrentUser()
    if (bookId) {
      loadBook()
    }
  }, [bookId])

  const loadCurrentUser = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setCurrentUser(data)
    } catch (error) {
      console.error('Load user error:', error)
    }
  }

  const loadBook = async () => {
    try {
      const { data, error } = await supabase
        .from('bookmosh_books')
        .select('*')
        .eq('id', bookId)
        .single()

      if (error) throw error
      
      setBook(data)
      setTitle(data.title || '')
      setAuthor(data.author || '')
      setStatus(data.status || 'Reading')
      setRating(data.rating || 0)
      setProgress(data.progress || 0)
      setReview(data.review || '')
      
      // Load activity for this book
      loadBookActivity(data.title)
    } catch (error) {
      console.error('Load book error:', error)
      Alert.alert('Error', 'Failed to load book details')
    } finally {
      setLoading(false)
    }
  }

  const loadBookActivity = async (bookTitle) => {
    if (!currentUser || !bookTitle) return
    setActivityLoading(true)
    try {
      const friends = Array.isArray(currentUser.friends) ? currentUser.friends : []
      const usernames = [currentUser.username, ...friends]
      
      const { data, error } = await supabase
        .from('book_events')
        .select('*')
        .eq('book_title', bookTitle)
        .in('owner_username', usernames)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (error) throw error
      setBookActivity(data || [])
    } catch (error) {
      console.error('Failed to load book activity:', error)
      setBookActivity([])
    } finally {
      setActivityLoading(false)
    }
  }

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

  const saveBook = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('bookmosh_books')
        .update({
          title: title.trim(),
          author: author.trim() || 'Unknown author',
          status,
          rating,
          progress,
          review: review.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookId)

      if (error) throw error
      Alert.alert('Success', 'Book updated successfully')
      navigation.goBack()
    } catch (error) {
      console.error('Save book error:', error)
      Alert.alert('Error', error.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteBook = async () => {
    Alert.alert(
      'Delete Book',
      'Are you sure you want to delete this book?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bookmosh_books')
                .delete()
                .eq('id', bookId)

              if (error) throw error
              Alert.alert('Success', 'Book deleted')
              navigation.goBack()
            } catch (error) {
              console.error('Delete book error:', error)
              Alert.alert('Error', error.message)
            }
          },
        },
      ]
    )
  }

  const navigateToAuthorSearch = () => {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Details</Text>
        <TouchableOpacity onPress={deleteBook} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {book?.cover && (
          <View style={styles.coverContainer}>
            <Image source={{ uri: book.cover }} style={styles.cover} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Book title"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Author</Text>
          <View style={styles.authorContainer}>
            <TextInput
              style={[styles.input, styles.authorInput]}
              value={author}
              onChangeText={setAuthor}
              placeholder="Author name"
              placeholderTextColor="#666"
            />
            <TouchableOpacity
              style={styles.authorSearchButton}
              onPress={navigateToAuthorSearch}
            >
              <Text style={styles.authorSearchButtonText}>View Books</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusButtons}>
            {statusOptions.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusButton,
                  status === s && styles.statusButtonActive,
                ]}
                onPress={() => setStatus(s)}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    status === s && styles.statusButtonTextActive,
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Rating ({rating}/5)</Text>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                style={styles.starButton}
              >
                <Text style={styles.star}>
                  {star <= rating ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Progress ({progress}%)</Text>
          <View style={styles.progressContainer}>
            <TextInput
              style={styles.progressInput}
              value={progress.toString()}
              onChangeText={(text) => {
                const num = parseInt(text) || 0
                setProgress(Math.min(100, Math.max(0, num)))
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#666"
            />
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${progress}%` }]}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Review/Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={review}
            onChangeText={setReview}
            placeholder="Your thoughts about this book..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Activity</Text>
          {activityLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : bookActivity.length > 0 ? (
            <View style={styles.activityList}>
              {bookActivity.map((item) => (
                <View key={item.id} style={styles.activityItem}>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>
                      <Text style={styles.activityUsername}>{item.owner_username}</Text>
                      <Text style={styles.activityAction}>
                        {item.event_type === 'created' ? ' added this book' : 
                         item.event_type === 'tags_updated' ? ' updated tags' :
                         item.event_type === 'status_changed' ? ' changed status' :
                         ' updated this book'}
                      </Text>
                      {item.tags && item.tags.length > 0 && (
                        <Text style={styles.activityAction}> to </Text>
                      )}
                      {item.tags && item.tags.map((tag, idx) => (
                        <Text key={idx}>
                          <Text style={styles.activityTag}>{tag}</Text>
                          {idx < item.tags.length - 1 && <Text style={styles.activityAction}>, </Text>}
                        </Text>
                      ))}
                    </Text>
                    <Text style={styles.activityTime}>{formatTimeAgo(item.created_at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyActivity}>No activity yet for this book.</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveBook}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
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
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  coverContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  cover: {
    width: 150,
    height: 225,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 15,
  },
  authorContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  authorInput: {
    flex: 1,
  },
  authorSearchButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  authorSearchButtonText: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  statusButtonText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  statusButtonTextActive: {
    color: '#3b82f6',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 32,
    color: '#fbbf24',
  },
  progressContainer: {
    gap: 12,
  },
  progressInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    width: 80,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  activityList: {
    gap: 8,
  },
  activityItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
  },
  activityContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  activityText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  activityUsername: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  activityAction: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  activityTag: {
    color: '#fff',
    fontWeight: '600',
  },
  activityTime: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  emptyActivity: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
})
