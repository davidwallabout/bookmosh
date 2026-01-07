import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'

export default function ReadByYearScreen({ user }) {
  const navigation = useNavigation()
  const route = useRoute()

  const now = new Date()
  const currentYear = now.getFullYear()

  const [username, setUsername] = useState('')
  const [selectedYear, setSelectedYear] = useState(route.params?.initialYear || currentYear)
  const [customYear, setCustomYear] = useState('')

  const [availableYears, setAvailableYears] = useState([currentYear, currentYear - 1])
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingYears, setLoadingYears] = useState(false)

  const yearRange = useMemo(() => {
    const start = new Date(Date.UTC(Number(selectedYear), 0, 1, 0, 0, 0))
    const end = new Date(Date.UTC(Number(selectedYear) + 1, 0, 1, 0, 0, 0))
    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    }
  }, [selectedYear])

  useEffect(() => {
    const loadUsername = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('username')
          .eq('id', user.id)
          .single()

        if (error) throw error
        setUsername(data?.username || '')
      } catch (error) {
        console.error('Load username error:', error)
      }
    }

    loadUsername()
  }, [user.id])

  useEffect(() => {
    if (!username) return

    const loadYears = async () => {
      setLoadingYears(true)
      try {
        const { data, error } = await supabase
          .from('bookmosh_books')
          .select('updated_at')
          .eq('owner', username)
          .eq('status', 'Read')
          .order('updated_at', { ascending: false })
          .limit(500)

        if (error) throw error

        const years = new Set()
        for (const row of data || []) {
          const dt = row?.updated_at ? new Date(row.updated_at) : null
          const y = dt && Number.isFinite(dt.getFullYear()) ? dt.getFullYear() : null
          if (y) years.add(y)
        }

        const next = Array.from(years).sort((a, b) => b - a)
        const fallback = [currentYear, currentYear - 1]
        setAvailableYears(next.length ? next : fallback)
      } catch (error) {
        console.error('Load read years error:', error)
      } finally {
        setLoadingYears(false)
      }
    }

    loadYears()
  }, [username, currentYear])

  useEffect(() => {
    if (!username) return

    const loadBooks = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('bookmosh_books')
          .select('id, title, author, cover, status, updated_at')
          .eq('owner', username)
          .eq('status', 'Read')
          .gte('updated_at', yearRange.startISO)
          .lt('updated_at', yearRange.endISO)
          .order('updated_at', { ascending: false })
          .limit(500)

        if (error) throw error
        setBooks(data || [])
      } catch (error) {
        console.error('Load books by year error:', error)
        setBooks([])
      } finally {
        setLoading(false)
      }
    }

    loadBooks()
  }, [username, yearRange.startISO, yearRange.endISO])

  const applyCustomYear = () => {
    const y = Number(customYear.trim())
    if (!Number.isInteger(y) || y < 1900 || y > 3000) return
    setSelectedYear(y)
    setCustomYear('')
    if (!availableYears.includes(y)) {
      const next = Array.from(new Set([...availableYears, y])).sort((a, b) => b - a)
      setAvailableYears(next)
    }
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
        {item.updated_at ? (
          <Text style={styles.bookMeta}>
            Finished: {new Date(item.updated_at).toLocaleDateString()}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Read by Year</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.yearPanel}>
        <View style={styles.yearRow}>
          <Text style={styles.yearLabel}>Year</Text>
          {loadingYears ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={availableYears}
              keyExtractor={(y) => String(y)}
              contentContainerStyle={styles.yearList}
              renderItem={({ item: y }) => (
                <TouchableOpacity
                  onPress={() => setSelectedYear(y)}
                  style={[styles.yearChip, selectedYear === y && styles.yearChipActive]}
                >
                  <Text style={[styles.yearChipText, selectedYear === y && styles.yearChipTextActive]}>
                    {y}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        <View style={styles.customYearRow}>
          <TextInput
            value={customYear}
            onChangeText={setCustomYear}
            placeholder="Enter year"
            placeholderTextColor="rgba(255, 255, 255, 0.35)"
            keyboardType="number-pad"
            style={styles.customYearInput}
            maxLength={4}
            onSubmitEditing={applyCustomYear}
          />
          <TouchableOpacity onPress={applyCustomYear} style={styles.customYearButton}>
            <Text style={styles.customYearButtonText}>Go</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.summaryText}>{books.length} read in {selectedYear}</Text>
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
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No books marked Read in {selectedYear}.</Text>
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
  yearPanel: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  yearLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    width: 50,
  },
  yearList: {
    gap: 10,
    paddingRight: 10,
  },
  yearChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  yearChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  yearChipText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  yearChipTextActive: {
    color: '#fff',
  },
  customYearRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  customYearInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  customYearButton: {
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
  },
  customYearButtonText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#3b82f6',
    textTransform: 'uppercase',
  },
  summaryText: {
    marginTop: 10,
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    marginTop: 40,
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
  bookMeta: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
  },
})
