import React, { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View, StyleSheet, Image, Animated } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { SvgXml } from 'react-native-svg'
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
}

const TabIcon = ({ name, color, size }) => (
  <SvgXml xml={PIXEL_ICONS[name](color)} width={size} height={size} />
)

function MainTabs({ user, onSignOut }) {
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
        children={() => <FeedScreen user={user} />}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ color, size }) => <TabIcon name="feed" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Community"
        children={() => <CommunityScreen user={user} />}
        options={{
          tabBarLabel: 'Community',
          tabBarIcon: ({ color, size }) => <TabIcon name="community" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  )
}

function MainStack({ user, onSignOut }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs">
        {() => <MainTabs user={user} onSignOut={onSignOut} />}
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
        <MainStack user={session.user} onSignOut={handleSignOut} />
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
