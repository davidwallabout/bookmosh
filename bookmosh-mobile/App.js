import React, { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View, StyleSheet, Image, Animated, Text } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { SvgXml } from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './lib/supabase'
import AuthScreen from './screens/AuthScreen'
import HomeScreen from './screens/HomeScreen'
import FeedScreen from './screens/FeedScreen'
import PitsScreen from './screens/PitsScreen'
import CommunityScreen from './screens/CommunityScreen'
import ProfileScreen from './screens/ProfileScreen'
import FullLibraryScreen from './screens/FullLibraryScreen'
import DiscoveryScreen from './screens/DiscoveryScreen'
import BookDetailScreen from './screens/BookDetailScreen'
import FriendProfileScreen from './screens/FriendProfileScreen'
import ReadByYearScreen from './screens/ReadByYearScreen'
import ListsScreen from './screens/ListsScreen'
import ListDetailScreen from './screens/ListDetailScreen'
import RecommendationsScreen from './screens/RecommendationsScreen'
import MyReviewsScreen from './screens/MyReviewsScreen'

const Tab = createBottomTabNavigator()
const Stack = createStackNavigator()

// Cute pixelated icons for tab bar
const PIXEL_ICONS = {
  // Library - pixelated book/bookshelf
  library: (color) => `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="3" height="16" fill="${color}"/>
    <rect x="7" y="6" width="3" height="14" fill="${color}"/>
    <rect x="11" y="3" width="3" height="17" fill="${color}"/>
    <rect x="15" y="5" width="3" height="15" fill="${color}"/>
    <rect x="19" y="4" width="2" height="16" fill="${color}"/>
    <rect x="2" y="20" width="20" height="2" fill="${color}"/>
  </svg>`,
  
  // Discovery - pixelated magnifying glass
  discovery: (color) => `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
  </svg>`,
  
  // Feed - pixelated heart
  feed: (color) => `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="6" width="2" height="2" fill="${color}"/>
    <rect x="6" y="4" width="2" height="2" fill="${color}"/>
    <rect x="8" y="4" width="2" height="2" fill="${color}"/>
    <rect x="10" y="6" width="2" height="2" fill="${color}"/>
    <rect x="12" y="6" width="2" height="2" fill="${color}"/>
    <rect x="14" y="4" width="2" height="2" fill="${color}"/>
    <rect x="16" y="4" width="2" height="2" fill="${color}"/>
    <rect x="18" y="6" width="2" height="2" fill="${color}"/>
    <rect x="4" y="8" width="2" height="2" fill="${color}"/>
    <rect x="6" y="8" width="2" height="2" fill="${color}"/>
    <rect x="8" y="8" width="2" height="2" fill="${color}"/>
    <rect x="10" y="8" width="2" height="2" fill="${color}"/>
    <rect x="12" y="8" width="2" height="2" fill="${color}"/>
    <rect x="14" y="8" width="2" height="2" fill="${color}"/>
    <rect x="16" y="8" width="2" height="2" fill="${color}"/>
    <rect x="18" y="8" width="2" height="2" fill="${color}"/>
    <rect x="6" y="10" width="2" height="2" fill="${color}"/>
    <rect x="8" y="10" width="2" height="2" fill="${color}"/>
    <rect x="10" y="10" width="2" height="2" fill="${color}"/>
    <rect x="12" y="10" width="2" height="2" fill="${color}"/>
    <rect x="14" y="10" width="2" height="2" fill="${color}"/>
    <rect x="16" y="10" width="2" height="2" fill="${color}"/>
    <rect x="8" y="12" width="2" height="2" fill="${color}"/>
    <rect x="10" y="12" width="2" height="2" fill="${color}"/>
    <rect x="12" y="12" width="2" height="2" fill="${color}"/>
    <rect x="14" y="12" width="2" height="2" fill="${color}"/>
    <rect x="10" y="14" width="2" height="2" fill="${color}"/>
    <rect x="12" y="14" width="2" height="2" fill="${color}"/>
    <rect x="11" y="16" width="2" height="2" fill="${color}"/>
  </svg>`,
  
  // Community - pixelated people/friends
  community: (color) => `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="2" height="2" fill="${color}"/>
    <rect x="6" y="4" width="2" height="2" fill="${color}"/>
    <rect x="4" y="6" width="2" height="2" fill="${color}"/>
    <rect x="6" y="6" width="2" height="2" fill="${color}"/>
    <rect x="3" y="10" width="2" height="2" fill="${color}"/>
    <rect x="5" y="10" width="2" height="2" fill="${color}"/>
    <rect x="7" y="10" width="2" height="2" fill="${color}"/>
    <rect x="3" y="12" width="2" height="6" fill="${color}"/>
    <rect x="5" y="12" width="2" height="6" fill="${color}"/>
    <rect x="7" y="12" width="2" height="6" fill="${color}"/>
    <rect x="16" y="4" width="2" height="2" fill="${color}"/>
    <rect x="18" y="4" width="2" height="2" fill="${color}"/>
    <rect x="16" y="6" width="2" height="2" fill="${color}"/>
    <rect x="18" y="6" width="2" height="2" fill="${color}"/>
    <rect x="15" y="10" width="2" height="2" fill="${color}"/>
    <rect x="17" y="10" width="2" height="2" fill="${color}"/>
    <rect x="19" y="10" width="2" height="2" fill="${color}"/>
    <rect x="15" y="12" width="2" height="6" fill="${color}"/>
    <rect x="17" y="12" width="2" height="6" fill="${color}"/>
    <rect x="19" y="12" width="2" height="6" fill="${color}"/>
    <rect x="10" y="2" width="2" height="2" fill="${color}"/>
    <rect x="12" y="2" width="2" height="2" fill="${color}"/>
    <rect x="10" y="4" width="2" height="2" fill="${color}"/>
    <rect x="12" y="4" width="2" height="2" fill="${color}"/>
    <rect x="9" y="8" width="2" height="2" fill="${color}"/>
    <rect x="11" y="8" width="2" height="2" fill="${color}"/>
    <rect x="13" y="8" width="2" height="2" fill="${color}"/>
    <rect x="9" y="10" width="2" height="8" fill="${color}"/>
    <rect x="11" y="10" width="2" height="8" fill="${color}"/>
    <rect x="13" y="10" width="2" height="8" fill="${color}"/>
  </svg>`,

  // Profile - pixelated face
  profile: (color) => `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="4" width="10" height="2" fill="${color}"/>
    <rect x="6" y="6" width="12" height="2" fill="${color}"/>
    <rect x="5" y="8" width="14" height="10" fill="${color}"/>
    <rect x="7" y="10" width="2" height="2" fill="#020617"/>
    <rect x="15" y="10" width="2" height="2" fill="#020617"/>
    <rect x="9" y="14" width="6" height="2" fill="#020617"/>
    <rect x="6" y="18" width="12" height="2" fill="${color}"/>
  </svg>`,
}

const TabIcon = ({ name, color, size }) => (
  <SvgXml xml={PIXEL_ICONS[name](color)} width={size} height={size} />
)

function MainTabs({ user, onSignOut, feedBadgeCount, setFeedBadgeCount, communityBadgeCount, friendRequestCount, unreadPitCount, unreadRecsCount }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#020617',
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          borderTopWidth: 1,
          paddingBottom: 25,
          paddingTop: 8,
          height: 80,
        },
        tabBarActiveTintColor: '#ee6bfe',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.4)',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tab.Screen
        name="Library"
        children={() => <HomeScreen user={user} onSignOut={onSignOut} />}
        options={{
          tabBarLabel: 'Library',
          tabBarIcon: ({ color, size }) => <TabIcon name="library" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Discovery"
        children={() => <DiscoveryScreen user={user} />}
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color, size }) => <TabIcon name="discovery" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Feed"
        children={() => <FeedScreen user={user} setFeedBadgeCount={setFeedBadgeCount} />}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ color, size }) => <TabIcon name="feed" color={color} size={size} />,
          tabBarBadge: feedBadgeCount > 0 ? feedBadgeCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: 10,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tab.Screen
        name="Community"
        children={() => <CommunityScreen user={user} friendRequestCount={friendRequestCount} unreadPitCount={unreadPitCount} unreadRecsCount={unreadRecsCount} />}
        options={{
          tabBarLabel: 'Community',
          tabBarIcon: ({ color, size }) => <TabIcon name="community" color={color} size={size} />,
          tabBarBadge: communityBadgeCount > 0 ? communityBadgeCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: 10,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
          },
        }}
      />
    </Tab.Navigator>
  )
}

function MainStack({ user, onSignOut, feedBadgeCount, setFeedBadgeCount, communityBadgeCount, friendRequestCount, unreadPitCount, unreadRecsCount }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs">
        {() => <MainTabs user={user} onSignOut={onSignOut} feedBadgeCount={feedBadgeCount} setFeedBadgeCount={setFeedBadgeCount} communityBadgeCount={communityBadgeCount} friendRequestCount={friendRequestCount} unreadPitCount={unreadPitCount} unreadRecsCount={unreadRecsCount} />}
      </Stack.Screen>
      <Stack.Screen name="ProfileScreen">
        {() => <ProfileScreen user={user} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="FullLibraryScreen">
        {() => <FullLibraryScreen user={user} />}
      </Stack.Screen>
      <Stack.Screen name="BookDetailScreen">
        {() => <BookDetailScreen user={user} />}
      </Stack.Screen>
      <Stack.Screen name="FriendProfileScreen">
        {() => <FriendProfileScreen user={user} />}
      </Stack.Screen>
      <Stack.Screen name="ReadByYearScreen">
        {() => <ReadByYearScreen user={user} />}
      </Stack.Screen>
      <Stack.Screen name="ListsScreen">
        {() => <ListsScreen user={user} />}
      </Stack.Screen>
      <Stack.Screen name="ListDetailScreen">
        {() => <ListDetailScreen user={user} />}
      </Stack.Screen>
      <Stack.Screen name="RecommendationsScreen">
        {() => <RecommendationsScreen user={user} />}
      </Stack.Screen>
      <Stack.Screen name="MyReviewsScreen">
        {() => <MyReviewsScreen user={user} />}
      </Stack.Screen>
    </Stack.Navigator>
  )
}

function LoadingScreen() {
  const translateY = React.useRef(new Animated.Value(0)).current
  const translateX = React.useRef(new Animated.Value(0)).current
  const scale = React.useRef(new Animated.Value(1)).current

  React.useEffect(() => {
    const bounceSequence = Animated.sequence([
      // First bounce
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -20,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -5,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.05,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(translateX, {
          toValue: 0,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(200),
      // Second bounce
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -15,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 5,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.03,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(translateX, {
          toValue: 0,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(200),
      // Third bounce
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -10,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.02,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(translateX, {
          toValue: 0,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(500),
    ])

    const loopAnimation = Animated.loop(bounceSequence)
    loopAnimation.start()

    return () => {
      loopAnimation.stop()
    }
  }, [])

  return (
    <View style={styles.loadingContainer}>
      <Animated.Image
        source={require('./assets/bookmosh-logo.png')}
        style={[
          styles.loadingLogo,
          {
            transform: [
              { translateX },
              { translateY },
              { scale },
            ],
          },
        ]}
        resizeMode="contain"
      />
    </View>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feedBadgeCount, setFeedBadgeCount] = useState(0)
  const [communityBadgeCount, setCommunityBadgeCount] = useState(0)
  const [friendRequestCount, setFriendRequestCount] = useState(0)
  const [unreadPitCount, setUnreadPitCount] = useState(0)
  const [unreadRecsCount, setUnreadRecsCount] = useState(0)

  useEffect(() => {
    const loadApp = async () => {
      const startTime = Date.now()
      
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      
      // Ensure loading screen shows for at least 2 seconds
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, 2000 - elapsedTime)
      
      setTimeout(() => {
        setLoading(false)
      }, remainingTime)
    }

    loadApp()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Check for new feed activity
  useEffect(() => {
    if (!session?.user) return

    const checkFeedActivity = async () => {
      try {
        const lastViewedKey = `feed_last_viewed_${session.user.id}`
        const lastViewed = await AsyncStorage.getItem(lastViewedKey) || new Date(0).toISOString()

        // Count new likes on user's books
        const { data: likesData } = await supabase
          .from('feed_likes')
          .select('id, book_id')
          .gte('created_at', lastViewed)

        // Get user's book IDs
        const { data: userBooks } = await supabase
          .from('bookmosh_books')
          .select('id')
          .eq('owner_id', session.user.id)

        const userBookIds = new Set(userBooks?.map(b => b.id) || [])
        const newLikes = likesData?.filter(like => userBookIds.has(like.book_id)) || []

        // Count new comments on user's reviews
        const { data: commentsData } = await supabase
          .from('review_comments')
          .select('id, review_id')
          .gte('created_at', lastViewed)

        const { data: userReviews } = await supabase
          .from('reviews')
          .select('id')
          .eq('reviewer_id', session.user.id)

        const userReviewIds = new Set(userReviews?.map(r => r.id) || [])
        const newComments = commentsData?.filter(comment => userReviewIds.has(comment.review_id)) || []

        setFeedBadgeCount(newLikes.length + newComments.length)
      } catch (error) {
        console.error('[BADGE] Failed to check feed activity:', error)
      }
    }

    checkFeedActivity()
    const interval = setInterval(checkFeedActivity, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [session?.user])

  // Check for community updates (friend requests, pit messages, recommendations)
  useEffect(() => {
    if (!session?.user) return

    const checkCommunityActivity = async () => {
      try {
        // Get current user data
        const { data: userData } = await supabase
          .from('users')
          .select('id, username')
          .eq('id', session.user.id)
          .single()

        if (!userData) return

        // Count pending friend requests
        const { data: friendRequests } = await supabase
          .from('friendships')
          .select('id')
          .eq('friend_id', userData.id)
          .eq('status', 'pending')

        const friendReqCount = friendRequests?.length || 0
        setFriendRequestCount(friendReqCount)

        // Count unread pit messages
        const lastPitViewedKey = `pits_last_viewed_${session.user.id}`
        const lastPitViewed = await AsyncStorage.getItem(lastPitViewedKey) || new Date(0).toISOString()

        const { data: userPits } = await supabase
          .from('moshes')
          .select('id')
          .contains('participants_ids', [userData.id])
          .eq('archived', false)

        const pitIds = userPits?.map(p => p.id) || []
        let pitMsgCount = 0
        if (pitIds.length > 0) {
          const { data: newMessages } = await supabase
            .from('mosh_messages')
            .select('id')
            .in('mosh_id', pitIds)
            .neq('sender_id', userData.id)
            .gte('created_at', lastPitViewed)

          pitMsgCount = newMessages?.length || 0
        }
        setUnreadPitCount(pitMsgCount)

        // Count unread recommendations
        const lastRecsViewedKey = `recs_last_viewed_${session.user.id}`
        const lastRecsViewed = await AsyncStorage.getItem(lastRecsViewedKey) || new Date(0).toISOString()

        const { data: newRecs } = await supabase
          .from('recommendations')
          .select('id')
          .eq('recipient_id', userData.id)
          .gte('created_at', lastRecsViewed)

        const recsCount = newRecs?.length || 0
        setUnreadRecsCount(recsCount)

        // Total community badge
        setCommunityBadgeCount(friendReqCount + pitMsgCount + recsCount)
      } catch (error) {
        console.error('[BADGE] Failed to check community activity:', error)
      }
    }

    checkCommunityActivity()
    const interval = setInterval(checkCommunityActivity, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [session?.user])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      {session && session.user ? (
        <MainStack 
          user={session.user} 
          onSignOut={handleSignOut} 
          feedBadgeCount={feedBadgeCount} 
          setFeedBadgeCount={setFeedBadgeCount}
          communityBadgeCount={communityBadgeCount}
          friendRequestCount={friendRequestCount}
          unreadPitCount={unreadPitCount}
          unreadRecsCount={unreadRecsCount}
        />
      ) : (
        <AuthScreen onAuthSuccess={() => {}} />
      )}
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 200,
    height: 200,
  },
})
