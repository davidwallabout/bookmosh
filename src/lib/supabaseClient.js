import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Clear any old cookie-based auth tokens on first load
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name] = cookie.split('=')
    const trimmedName = name.trim()
    if (trimmedName.includes('sb-') && trimmedName.includes('-auth-token')) {
      document.cookie = `${trimmedName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`
    }
  }
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, { 
        auth: { 
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          storageKey: 'bookmosh-auth'
        } 
      })
    : null
