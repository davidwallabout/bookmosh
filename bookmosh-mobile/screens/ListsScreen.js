import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'

export default function ListsScreen({ user }) {
  const navigation = useNavigation()
  const route = useRoute()

  const [currentUser, setCurrentUser] = useState(null)
  const [lists, setLists] = useState([])
  const [countsByListId, setCountsByListId] = useState({})
  const [loading, setLoading] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const openCreateOnLoad = Boolean(route.params?.openCreate)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (!currentUser) return
    loadLists()
  }, [currentUser?.id])

  useEffect(() => {
    if (openCreateOnLoad) {
      setShowCreateModal(true)
      navigation.setParams({ openCreate: false })
    }
  }, [openCreateOnLoad, navigation])

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

  const loadLists = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('owner_id', currentUser.id)
        .order('updated_at', { ascending: false })

      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      setLists(rows)

      const ids = rows.map((l) => l.id).filter(Boolean)
      if (ids.length) {
        const { data: items, error: itemsErr } = await supabase
          .from('list_items')
          .select('list_id')
          .in('list_id', ids)
          .limit(2000)

        if (itemsErr) throw itemsErr

        const nextCounts = {}
        for (const it of items || []) {
          const k = it.list_id
          if (!k) continue
          nextCounts[k] = (nextCounts[k] || 0) + 1
        }
        setCountsByListId(nextCounts)
      } else {
        setCountsByListId({})
      }
    } catch (error) {
      console.error('Load lists error:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setNewTitle('')
    setNewDescription('')
    setShowCreateModal(true)
  }

  const createList = async () => {
    const title = newTitle.trim()
    if (!title) {
      Alert.alert('Error', 'Add a title for your list.')
      return
    }
    if (!currentUser) return

    setCreating(true)
    try {
      const payload = {
        owner_id: currentUser.id,
        owner_username: currentUser.username,
        title,
        description: newDescription.trim() || null,
        is_public: false,
      }

      const { error } = await supabase.from('lists').insert(payload)
      if (error) throw error

      setShowCreateModal(false)
      await loadLists()
    } catch (error) {
      console.error('Create list error:', error)
      Alert.alert('Error', error.message)
    } finally {
      setCreating(false)
    }
  }

  const renderList = ({ item }) => {
    const count = countsByListId[item.id] || 0
    return (
      <TouchableOpacity
        style={styles.listRow}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ListDetailScreen', { listId: item.id })}
      >
        <View style={styles.listRowText}>
          <Text style={styles.listTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.listMeta}>{count} books</Text>
        </View>
        <Text style={styles.chevron}>→</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Lists</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addButton}>
          <Text style={styles.addButtonText}>＋</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderList}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No lists yet. Tap ＋ to create one.</Text>
          }
        />
      )}

      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create List</Text>

            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Title"
              placeholderTextColor="rgba(255, 255, 255, 0.35)"
              style={styles.modalInput}
              autoCorrect={false}
            />
            <TextInput
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Description (optional)"
              placeholderTextColor="rgba(255, 255, 255, 0.35)"
              style={[styles.modalInput, styles.modalInputMultiline]}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={styles.modalCancel}
                disabled={creating}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={createList}
                style={styles.modalPrimary}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#020617" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
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
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3b82f6',
    marginTop: -2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 40,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  listRowText: {
    flex: 1,
    paddingRight: 12,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  listMeta: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  chevron: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.35)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  modalCancelText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  modalPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  modalPrimaryText: {
    color: '#020617',
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 11,
  },
})
