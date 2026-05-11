/**
 * Smoke-test Supabase URL + public key (anon or publishable).
 * Run: npm run check:supabase
 * Uses .env.local via Node --env-file (nothing secret printed).
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  ''

if (!url || !key) {
  console.error('FAIL: Set NEXT_PUBLIC_SUPABASE_URL and anon or publishable key in .env.local')
  process.exit(1)
}

const keyKind = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'anon' : 'publishable'
console.log('Using public key type:', keyKind)
console.log('Project host:', new URL(url).host)

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const { error: sessErr, data: sessData } = await supabase.auth.getSession()
if (sessErr) {
  console.error('FAIL: auth.getSession()', sessErr.message)
  process.exit(1)
}
console.log(
  'OK: auth.getSession —',
  sessData.session ? 'has stored session' : 'no session (normal when logged out)',
)

const { data: rows, error: qErr } = await supabase.from('providers').select('id').limit(1)
if (qErr) {
  const missing =
    qErr.code === 'PGRST205' ||
    /schema cache|does not exist|not find the table/i.test(qErr.message || '')
  if (missing) {
    console.error(
      'FAIL: public.providers is missing or not exposed. Run supabase/schema.sql in the Supabase SQL Editor for this project, then re-run this check.',
    )
    process.exit(1)
  }
  console.error('FAIL: providers.select', qErr.message, qErr.code || '')
  process.exit(1)
}
console.log('OK: providers.select —', rows?.length ?? 0, 'row(s) (0 expected when not signed in)')

console.log('All checks passed.')
