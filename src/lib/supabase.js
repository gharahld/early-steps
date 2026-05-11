import { createClient } from '@supabase/supabase-js'
import { getSupabasePublicKey } from './supabaseEnv.js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = getSupabasePublicKey()

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL plus either NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy JWT) or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see README).',
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Persist session in localStorage (default).
    // Set to false if you prefer sessionStorage (cleared on tab close).
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
