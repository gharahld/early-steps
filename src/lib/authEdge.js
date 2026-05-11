import { supabase } from './supabase.js'
import { GENERIC_AUTH_ERROR } from './validators.js'

const baseUrl = () => String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function headers() {
  const key = anonKey()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    apikey: key,
  }
}

/**
 * Sign in via Edge Function (server-enforced rate limit). Sets Supabase session on success.
 */
export async function signInViaEdge(email, password) {
  let res
  try {
    res = await fetch(`${baseUrl()}/functions/v1/auth-rate-limited-signin`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error(
      'Cannot reach auth service. Deploy auth-rate-limited-signin or set NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS=false.',
    )
  }
  const body = await res.json().catch(() => ({}))

  if (res.status === 429) {
    throw new Error(
      body.error || 'Too many sign-in attempts. Please try again later.',
    )
  }

  if (res.status === 404 || res.status === 503) {
    throw new Error(
      'Sign-in service is not available. Deploy auth-rate-limited-signin or set NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS=false.',
    )
  }

  if (!res.ok) {
    throw new Error(GENERIC_AUTH_ERROR)
  }

  const session = body.session
  if (!session?.access_token || !session?.refresh_token) {
    throw new Error(GENERIC_AUTH_ERROR)
  }

  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error) throw new Error(GENERIC_AUTH_ERROR)
}

/**
 * Sign up via Edge Function (server-enforced rate limit). Sets session when Supabase returns one.
 */
export async function signUpViaEdge(email, password, name) {
  let res
  try {
    res = await fetch(`${baseUrl()}/functions/v1/auth-rate-limited-signup`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, password, name }),
    })
  } catch {
    throw new Error(
      'Cannot reach auth service. If you enabled Edge auth, deploy the signup function or set NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS=false.',
    )
  }
  const body = await res.json().catch(() => ({}))

  if (res.status === 429) {
    throw new Error(body.error || 'Too many attempts. Please try again later.')
  }

  if (res.status === 404 || res.status === 503) {
    throw new Error(
      'Signup service is not available. Deploy auth-rate-limited-signup or turn off NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS.',
    )
  }

  if (!res.ok) {
    throw new Error(body.error || 'Unable to complete registration. Please try again.')
  }

  const session = body.session
  if (session?.access_token && session?.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    if (error) {
      throw new Error('Unable to complete registration. Please try again.')
    }
  }

  return { user: body.user ?? null, session: session ?? null }
}
