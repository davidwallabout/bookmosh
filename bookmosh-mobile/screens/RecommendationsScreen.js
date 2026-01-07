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
} from 'react-native'
import { useNavigation, useIsFocused } from '@react-navigation/native'
import { supabase } from '../lib/supabase'

export default function RecommendationsScreen({ user }) {
  const navigation = useNavigation()
  const isFocused = useIsFocused()

  const [currentUser, setCurrentUser] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)

  const [activeRecommendation, setActiveRecommendation] = useState(null)
  const [showRecommendationModal, setShowRecommendationModal] = useState(false)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (!currentUser) return
    if (!isFocused) return
    loadRecommendations()
  }, [currentUser?.id, isFocused])

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
    setShowRecommendationModal(true)
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
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
})
