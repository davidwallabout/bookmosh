import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const cookieStorage = {
  getItem: (key) => {
    if (typeof document === 'undefined') return null
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${encodeURIComponent(key)}=`))
    if (!match) return null
    return decodeURIComponent(match.split('=').slice(1).join('='))
  },
  setItem: (key, value) => {
    if (typeof document === 'undefined') return
    // 30 days
    const maxAge = 60 * 60 * 24 * 30
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:'
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${isHttps ? '; Secure' : ''}`
  },
  removeItem: (key) => {
    if (typeof document === 'undefined') return
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:'
    document.cookie = `${encodeURIComponent(key)}=; Path=/; Max-Age=0; SameSite=Lax${isHttps ? '; Secure' : ''}`
  },
}

const storage = {
  getItem: (key) => {
    const cookieValue = cookieStorage.getItem(key)
    if (cookieValue) return cookieValue
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  },
  setItem: (key, value) => {
    cookieStorage.setItem(key, value)
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, value)
  },
  removeItem: (key) => {
    cookieStorage.removeItem(key)
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(key)
  },
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, { 
        auth: { 
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage
        } 
      })
    : null
