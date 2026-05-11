import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example → .env.local and fill in NEXT_PUBLIC_* values.'
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
