import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'

export default function ListDetailScreen({ user }) {
  const navigation = useNavigation()
  const route = useRoute()
  const listId = route.params?.listId

  const [currentUser, setCurrentUser] = useState(null)
  const [list, setList] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (!currentUser || !listId) return
    loadList()
  }, [currentUser?.id, listId])

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

  const loadList = async () => {
    setLoading(true)
    try {
      const { data: listRow, error: listErr } = await supabase
        .from('lists')
        .select('*')
        .eq('id', listId)
        .single()

      if (listErr) throw listErr
      setList(listRow)
      setEditTitle(listRow?.title || '')
      setEditDescription(listRow?.description || '')

      const { data: itemRows, error: itemsErr } = await supabase
        .from('list_items')
        .select('id, list_id, added_by, book_title, book_author, book_cover, created_at')
        .eq('list_id', listId)
        .order('created_at', { ascending: false })
        .limit(500)

      if (itemsErr) throw itemsErr
      setItems(Array.isArray(itemRows) ? itemRows : [])
    } catch (error) {
      console.error('Load list error:', error)
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const isOwner = Boolean(currentUser?.id && list?.owner_id && currentUser.id === list.owner_id)

  const saveEdits = async () => {
    const title = editTitle.trim()
    if (!title) {
      Alert.alert('Error', 'Title is required')
      return
    }
    if (!isOwner) {
      Alert.alert('Error', 'Only the list owner can edit this list.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('lists')
        .update({ title, description: editDescription.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', listId)
        .eq('owner_id', currentUser.id)

      if (error) throw error
      setEditing(false)
      await loadList()
    } catch (error) {
      console.error('Save list error:', error)
      Alert.alert('Error', error.message)
    } finally {
      setSaving(false)
    }
  }

  const removeItem = async (itemId) => {
    if (!isOwner) {
      Alert.alert('Error', 'Only the list owner can remove books.')
      return
    }

    try {
      const { error } = await supabase
        .from('list_items')
        .delete()
        .eq('id', itemId)
        .eq('list_id', listId)

      if (error) throw error
      await loadList()
    } catch (error) {
      console.error('Remove item error:', error)
      Alert.alert('Error', error.message)
    }
  }

  const renderItem = ({ item }) => (
    <View style={styles.itemRow}>
      {item.book_cover ? (
        <Image source={{ uri: item.book_cover }} style={styles.itemCover} />
      ) : (
        <View style={styles.itemCoverPlaceholder}>
          <Text style={styles.placeholderText}>📚</Text>
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={2}>{item.book_title}</Text>
        <Text style={styles.itemAuthor} numberOfLines={1}>{item.book_author}</Text>
      </View>
      {isOwner && (
        <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeButton}>
          <Text style={styles.removeButtonText}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>List</Text>
        {isOwner ? (
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.headerAction}>
            <Text style={styles.headerActionText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{list?.title || 'Untitled'}</Text>
            {list?.description ? (
              <Text style={styles.listDescription}>{list.description}</Text>
            ) : null}
            <Text style={styles.listMeta}>{items.length} books</Text>
          </View>

          <FlatList
            data={items}
            keyExtractor={(it) => it.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.itemsContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No books in this list yet.</Text>
            }
          />
        </>
      )}

      <Modal
        visible={editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit List</Text>

            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Title"
              placeholderTextColor="rgba(255, 255, 255, 0.35)"
              style={styles.modalInput}
              autoCorrect={false}
            />
            <TextInput
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Description (optional)"
              placeholderTextColor="rgba(255, 255, 255, 0.35)"
              style={[styles.modalInput, styles.modalInputMultiline]}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setEditing(false)}
                style={styles.modalCancel}
                disabled={saving}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEdits}
                style={styles.modalPrimary}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#020617" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Save</Text>
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
  headerAction: {
    padding: 6,
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#3b82f6',
  },
  headerSpacer: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  listTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  listDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 10,
  },
  listMeta: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  itemsContent: {
    padding: 16,
    paddingBottom: 30,
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 40,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  itemCover: {
    width: 44,
    height: 66,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 12,
  },
  itemCoverPlaceholder: {
    width: 44,
    height: 66,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeholderText: {
    fontSize: 22,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 10,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  itemAuthor: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 24,
    fontWeight: '600',
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
