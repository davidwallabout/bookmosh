import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native'
import { useNavigation, useIsFocused } from '@react-navigation/native'
import { supabase } from '../lib/supabase'

export default function RecommendationsScreen({ user, route }) {
  const navigation = useNavigation()
  const isFocused = useIsFocused()

  const [currentUser, setCurrentUser] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)

  const [activeRecommendation, setActiveRecommendation] = useState(null)
  const [showRecommendationModal, setShowRecommendationModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('To Read')
  const [isOwned, setIsOwned] = useState(false)
  const [addingToLibrary, setAddingToLibrary] = useState(false)

  const [commentDraft, setCommentDraft] = useState('')
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (!currentUser) return
    if (!isFocused) return
    loadRecommendations()
  }, [currentUser?.id, isFocused])

  useEffect(() => {
    if (route?.params?.selectedRecommendation) {
      const rec = route.params.selectedRecommendation
      setActiveRecommendation(rec)
      setShowRecommendationModal(true)
      if (currentUser) {
        loadComments(rec.id)
      }
      navigation.setParams({ selectedRecommendation: null })
    }
  }, [route?.params?.selectedRecommendation])

  useEffect(() => {
    if (activeRecommendation && currentUser && showRecommendationModal) {
      loadComments(activeRecommendation.id)
    }
  }, [currentUser])

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
      console.error('[RECOMMENDATIONS] Load user error:', error)
    }
  }

  const loadRecommendations = async () => {
    if (!currentUser) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setRecommendations(data || [])
    } catch (error) {
      console.error('[RECOMMENDATIONS] Load error:', error)
      setRecommendations([])
    } finally {
      setLoading(false)
    }
  }

  const openRecommendation = (rec) => {
    setActiveRecommendation(rec)
    setSelectedStatus('To Read')
    setIsOwned(false)
    setCommentDraft('')
    setComments([])
    setShowRecommendationModal(true)
    if (rec?.id) {
      loadComments(rec.id)
    }
  }

  const loadComments = async (recommendationId) => {
    if (!recommendationId) return
    setCommentsLoading(true)
    try {
      const { data, error } = await supabase
        .from('recommendation_comments')
        .select('*')
        .eq('recommendation_id', recommendationId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('[RECOMMENDATIONS] Load comments error:', error)
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }

  const postComment = async () => {
    if (!currentUser?.id || !activeRecommendation?.id) return
    const body = String(commentDraft || '').trim()
    if (!body) return
    try {
      const { error } = await supabase.from('recommendation_comments').insert({
        recommendation_id: activeRecommendation.id,
        commenter_id: currentUser.id,
        commenter_username: currentUser.username,
        body,
      })
      if (error) throw error
      setCommentDraft('')
      await loadComments(activeRecommendation.id)
    } catch (error) {
      console.error('[RECOMMENDATIONS] Post comment error:', error)
    }
  }

  const addBookToLibrary = async () => {
    if (!currentUser || !activeRecommendation) return

    setAddingToLibrary(true)
    try {
      const tags = [selectedStatus]
      if (isOwned) tags.push('Owned')

      const payload = {
        owner: currentUser.username,
        title: activeRecommendation.book_title,
        author: activeRecommendation.book_author || 'Unknown author',
        cover: activeRecommendation.book_cover,
        status: selectedStatus,
        tags: tags,
        progress: selectedStatus === 'Read' ? 100 : 0,
        rating: 0,
      }

      // Try with new columns first
      let { error } = await supabase.from('bookmosh_books').insert([{
        ...payload,
        read_at: selectedStatus === 'Read' ? new Date().toISOString() : null,
        status_updated_at: new Date().toISOString(),
      }])

      // Fallback if columns don't exist
      if (error && String(error.code) === '42703') {
        const msg = String(error.message || '')
        const fallbackPayload = { ...payload }
        if (msg.includes('read_at')) delete fallbackPayload.read_at
        if (msg.includes('status_updated_at')) delete fallbackPayload.status_updated_at
        ;({ error } = await supabase.from('bookmosh_books').insert([fallbackPayload]))
      }

      if (error) throw error

      setShowRecommendationModal(false)
      // Show success feedback
      alert(`Added "${activeRecommendation.book_title}" to your library!`)
    } catch (error) {
      console.error('[RECOMMENDATIONS] Add book error:', error)
      alert(error.message || 'Failed to add book')
    } finally {
      setAddingToLibrary(false)
    }
  }

  const openDiscoveryForRecommendation = (rec) => {
    const q = rec?.book_title
    if (!q) return
    setShowRecommendationModal(false)
    navigation.navigate('Tabs', {
      screen: 'Discovery',
      params: { initialQuery: q },
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recommendations</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('FullLibraryScreen', { filter: 'all' })}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : recommendations.length > 0 ? (
        <ScrollView contentContainerStyle={styles.feed}>
          {recommendations.map((rec) => {
            const isSent = Boolean(currentUser?.id && rec.sender_id === currentUser.id)
            const headline = isSent
              ? `You recommended to @${rec.recipient_username}`
              : `@${rec.sender_username} recommended to you`

            return (
              <TouchableOpacity
                key={rec.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => openRecommendation(rec)}
              >
                <Text style={styles.headline}>{headline}</Text>
                <View style={styles.row}>
                  {rec.book_cover ? (
                    <Image source={{ uri: rec.book_cover }} style={styles.cover} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Text style={styles.coverPlaceholderText}>📚</Text>
                    </View>
                  )}
                  <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={2}>
                      {rec.book_title}
                    </Text>
                    {rec.book_author ? (
                      <Text style={styles.author} numberOfLines={1}>
                        {rec.book_author}
                      </Text>
                    ) : null}
                    {rec.note ? (
                      <Text style={styles.note} numberOfLines={2}>
                        {rec.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No recommendations yet.</Text>
        </View>
      )}

      <Modal
        visible={showRecommendationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecommendationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Recommendation</Text>

            {activeRecommendation ? (
              <>
                <Text style={styles.modalHeadline}>
                  {currentUser?.id && activeRecommendation.sender_id === currentUser.id
                    ? `You recommended this to @${activeRecommendation.recipient_username}`
                    : `@${activeRecommendation.sender_username} recommended this to you`}
                </Text>

                <View style={styles.modalRow}>
                  {activeRecommendation.book_cover ? (
                    <Image source={{ uri: activeRecommendation.book_cover }} style={styles.modalCover} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Text style={styles.coverPlaceholderText}>📚</Text>
                    </View>
                  )}
                  <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={3}>
                      {activeRecommendation.book_title}
                    </Text>
                    {activeRecommendation.book_author ? (
                      <Text style={styles.author} numberOfLines={2}>
                        {activeRecommendation.book_author}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {activeRecommendation.note ? (
                  <Text style={styles.modalNote}>{activeRecommendation.note}</Text>
                ) : null}

                <View style={styles.addToLibrarySection}>
                  <Text style={styles.sectionLabel}>Add to Library</Text>
                  
                  <View style={styles.statusButtons}>
                    {['To Read', 'Reading', 'Read'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusButton,
                          selectedStatus === status && styles.statusButtonActive,
                        ]}
                        onPress={() => setSelectedStatus(status)}
                      >
                        <Text
                          style={[
                            styles.statusButtonText,
                            selectedStatus === status && styles.statusButtonTextActive,
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
                    <Text style={styles.checkboxLabel}>I own this book</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.addToLibraryButton}
                    onPress={addBookToLibrary}
                    disabled={addingToLibrary}
                  >
                    <Text style={styles.addToLibraryButtonText}>
                      {addingToLibrary ? 'Adding...' : 'Add to Library'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.addToLibrarySection}>
                  <View style={styles.commentsHeaderRow}>
                    <Text style={styles.sectionLabel}>Comments</Text>
                    <TouchableOpacity
                      onPress={() => activeRecommendation?.id && loadComments(activeRecommendation.id)}
                      style={styles.refreshCommentsButton}
                    >
                      <Text style={styles.refreshCommentsText}>Refresh</Text>
                    </TouchableOpacity>
                  </View>

                  {commentsLoading ? (
                    <ActivityIndicator size="small" color="#3b82f6" />
                  ) : comments.length > 0 ? (
                    <View style={styles.commentsList}>
                      {comments.map((c) => (
                        <View key={c.id} style={styles.commentItem}>
                          <Text style={styles.commentHeader}>@{c.commenter_username}</Text>
                          <Text style={styles.commentBody}>{c.body}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.modalNote}>No comments yet.</Text>
                  )}

                  <View style={styles.commentComposer}>
                    <TextInput
                      value={commentDraft}
                      onChangeText={setCommentDraft}
                      placeholder="Write a comment…"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                      style={styles.commentInput}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.addToLibraryButton, !String(commentDraft || '').trim() && styles.postButtonDisabled]}
                      onPress={postComment}
                      disabled={!String(commentDraft || '').trim()}
                    >
                      <Text style={styles.addToLibraryButtonText}>Post</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.modalAction}
                  onPress={() => openDiscoveryForRecommendation(activeRecommendation)}
                >
                  <Text style={styles.modalActionText}>Search this book</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowRecommendationModal(false)}
            >
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
  headerActions: {
    width: 60,
    alignItems: 'flex-end',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3b82f6',
    marginTop: -2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feed: {
    padding: 20,
    gap: 12,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 14,
  },
  headline: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.55)',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  cover: {
    width: 56,
    height: 82,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  coverPlaceholder: {
    width: 56,
    height: 82,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 18,
  },
  author: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  note: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    lineHeight: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalHeadline: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modalCover: {
    width: 70,
    height: 100,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalNote: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    marginBottom: 14,
  },
  modalAction: {
    backgroundColor: 'rgba(238, 107, 254, 0.12)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(238, 107, 254, 0.35)',
    marginBottom: 12,
  },
  modalActionText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#ee6bfe',
    textTransform: 'uppercase',
  },
  modalClose: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  addToLibrarySection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
  },
  statusButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  statusButtonTextActive: {
    color: '#3b82f6',
  },
  ownedCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  checkboxChecked: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  checkmark: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '900',
  },
  checkboxLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  addToLibraryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  addToLibraryButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  commentsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  refreshCommentsButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  refreshCommentsText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  commentsList: {
    gap: 10,
  },
  commentItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  commentHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  commentBody: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
  },
  commentComposer: {
    gap: 10,
  },
  commentInput: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#fff',
    minHeight: 70,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
})
