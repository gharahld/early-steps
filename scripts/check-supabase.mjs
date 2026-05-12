/**
 * Smoke-test Supabase: URL + key, Auth API, PostgREST tables, optional Edge auth, optional real login.
 * Run: npm run check:supabase
 * Uses .env.local via Node --env-file (passwords / sessions are never printed).
 *
 * Optional (full login → DB wiring proof):
 *   CHECK_SUPABASE_LOGIN_EMAIL=you@example.com
 *   CHECK_SUPABASE_LOGIN_PASSWORD=your-password
 * Do not commit these; keep in .env.local only.
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

function isMissingTable(err) {
  return (
    err?.code === 'PGRST205' ||
    /schema cache|does not exist|not find the table/i.test(err?.message || '')
  )
}

async function assertTable(name) {
  const { error } = await supabase.from(name).select('id').limit(1)
  if (error) {
    if (isMissingTable(error)) {
      console.error(
        `FAIL: public.${name} is missing or not exposed. Run supabase/schema.sql in the Supabase SQL Editor, then re-run.`,
      )
      process.exit(1)
    }
    console.error(`FAIL: ${name}.select`, error.message, error.code || '')
    process.exit(1)
  }
  console.log(`OK: ${name}.select — table reachable (RLS may return 0 rows when logged out)`)
}

// ── Auth API: same path the app uses for login (invalid credentials → expected error) ──
const fakeEmail = `__smoke_check_${Date.now()}@early-steps.invalid`
const { data: bogus, error: signErr } = await supabase.auth.signInWithPassword({
  email: fakeEmail,
  password: 'DefinitelyNotARealPassword!999',
})
if (bogus?.session) {
  console.error('FAIL: signInWithPassword unexpectedly returned a session for a fake user')
  process.exit(1)
}
if (!signErr) {
  console.error('FAIL: signInWithPassword returned no error and no session (unexpected)')
  process.exit(1)
}
const softAuth =
  signErr.status === 400 ||
  /invalid login|invalid credentials|email not confirmed|invalid/i.test(signErr.message || '')
if (!softAuth) {
  console.error(
    'FAIL: signInWithPassword — expected invalid-credentials style error; got:',
    signErr.message,
    'status:',
    signErr.status,
  )
  process.exit(1)
}
console.log('OK: signInWithPassword — Auth API accepts password login (invalid user rejected as expected)')

await assertTable('providers')
await assertTable('service_logs')

// ── Optional: Edge auth function deployed ──
if (process.env.NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS === 'true') {
  const fnUrl = `${String(url).replace(/\/$/, '')}/functions/v1/auth-rate-limited-signin`
  let res
  try {
    res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ email: '', password: '' }),
    })
  } catch (e) {
    console.error('FAIL: Edge sign-in fetch failed (network / CORS):', e.message)
    process.exit(1)
  }
  if (res.status === 404) {
    console.error(
      'FAIL: NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS=true but auth-rate-limited-signin returned 404. Deploy the function or set the flag to false.',
    )
    process.exit(1)
  }
  if (res.status === 503) {
    console.error(
      'FAIL: Edge sign-in returned 503. Function may be misconfigured or project paused.',
    )
    process.exit(1)
  }
  console.log(
    'OK: Edge auth-rate-limited-signin — reachable (status',
    res.status + ', empty body should be 400)',
  )
}

// ── Optional: real credentials → session + providers row (DB + trigger + RLS) ──
const loginEmail = process.env.CHECK_SUPABASE_LOGIN_EMAIL?.trim()
const loginPassword = process.env.CHECK_SUPABASE_LOGIN_PASSWORD
if (loginEmail && loginPassword) {
  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: loginPassword,
  })
  if (loginErr) {
    console.error('FAIL: real login:', loginErr.message)
    if (/email not confirmed/i.test(loginErr.message || '')) {
      console.error('Hint: confirm the email in Supabase or disable "Confirm email" for this test user.')
    }
    process.exit(1)
  }
  const uid = loginData.session?.user?.id ?? loginData.user?.id
  if (!uid) {
    console.error('FAIL: login succeeded but no user id in response')
    await supabase.auth.signOut()
    process.exit(1)
  }
  const { data: prov, error: provErr } = await supabase
    .from('providers')
    .select('id, full_name')
    .eq('id', uid)
    .maybeSingle()
  if (provErr) {
    console.error('FAIL: providers lookup after login:', provErr.message, provErr.code || '')
    await supabase.auth.signOut()
    process.exit(1)
  }
  if (!prov) {
    console.error(
      'FAIL: Signed in OK but no public.providers row for this user.',
      'Signup trigger handle_new_user may be missing, or this user was created before schema was applied.',
    )
    console.error('Fix: ensure supabase/schema.sql ran; for existing auth users run a one-off insert into public.providers.')
    await supabase.auth.signOut()
    process.exit(1)
  }
  console.log('OK: login + providers row — database wiring matches app expectations')
  const { error: svcErr } = await supabase.from('service_logs').select('id').limit(1)
  if (svcErr) {
    console.error('FAIL: service_logs after login:', svcErr.message)
    await supabase.auth.signOut()
    process.exit(1)
  }
  console.log('OK: service_logs — readable with session (RLS allows own rows)')
  await supabase.auth.signOut()
} else if (loginEmail && !loginPassword) {
  console.error('FAIL: CHECK_SUPABASE_LOGIN_EMAIL is set but CHECK_SUPABASE_LOGIN_PASSWORD is missing')
  process.exit(1)
}

console.log('All checks passed.')
