import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { signInViaEdge, signUpViaEdge } from '../lib/authEdge.js'
import { rateLimiter } from '../lib/rateLimiter.js'
import {
  sanitizeEmail,
  sanitizeName,
  GENERIC_AUTH_ERROR,
  safeSignupErrorMessage,
} from '../lib/validators.js'

const AuthCtx = createContext(null)

/** Server-side rate limits via Supabase Edge Functions (opt-in — see README). */
const AUTH_VIA_EDGE = process.env.NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS === 'true'

/** 30-minute inactivity timeout (milliseconds). */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)  // true while resolving initial session
  /** Set when signUp succeeds but there is no session yet (email confirmation required). */
  const [pendingEmailVerification, setPendingEmailVerification] = useState(null)

  const activityTimer = useRef(null)
  /** Once true, ignore stale `getSession()` resolves that would overwrite a fresh login. */
  const initialAuthHydrated = useRef(false)

  // ── Activity-based session expiry ─────────────────────────────────────────
  const resetActivityTimer = useCallback(() => {
    clearTimeout(activityTimer.current)
    activityTimer.current = setTimeout(async () => {
      await supabase.auth.signOut()
      setUser(null)
    }, SESSION_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    if (!user) return
    const events = ['mousemove', 'keydown', 'click', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetActivityTimer, { passive: true }))
    resetActivityTimer()
    return () => {
      clearTimeout(activityTimer.current)
      events.forEach(e => window.removeEventListener(e, resetActivityTimer))
    }
  }, [user, resetActivityTimer])

  // ── Resolve existing session on mount ────────────────────────────────────
  useEffect(() => {
    initialAuthHydrated.current = false

    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      // Login may finish before this resolves; do not overwrite a user already set.
      if (!initialAuthHydrated.current) {
        initialAuthHydrated.current = true
        setUser(session?.user ?? null)
      } else if (session?.user) {
        setUser(session.user)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null)
        return
      }
      if (session?.user) {
        initialAuthHydrated.current = true
        setUser(session.user)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const key  = `login:${sanitizeEmail(email)}`
    const gate = rateLimiter.check(key)

    if (!gate.allowed)
      throw new Error(`Too many attempts. Try again in ${gate.remaining}s.`)

    setLoading(true)
    try {
      setPendingEmailVerification(null)
      const emailClean = sanitizeEmail(email)

      if (AUTH_VIA_EDGE) {
        try {
          const setData = await signInViaEdge(emailClean, password)
          rateLimiter.reset(key)
          initialAuthHydrated.current = true
          const resolved =
            setData?.session?.user ??
            setData?.user ??
            (await supabase.auth.getSession()).data.session?.user ??
            null
          setUser(resolved)
        } catch (err) {
          rateLimiter.consume(key)
          throw err
        }
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailClean,
        password,
      })

      if (error) {
        rateLimiter.consume(key)
        const raw = (error.message || '').toLowerCase()
        if (raw.includes('email not confirmed') || raw.includes('email_not_confirmed')) {
          throw new Error(
            'Confirm your email using the link we sent, then sign in. If you did not get an email, check spam or request a new link from Sign up again.',
          )
        }
        throw new Error(GENERIC_AUTH_ERROR)
      }

      rateLimiter.reset(key)
      initialAuthHydrated.current = true
      const resolved =
        data.session?.user ??
        data.user ??
        (await supabase.auth.getSession()).data.session?.user ??
        null
      setUser(resolved)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Signup ─────────────────────────────────────────────────────────────────
  const signup = useCallback(async (email, password, name) => {
    const key  = `signup:${sanitizeEmail(email)}`
    const gate = rateLimiter.check(key)

    if (!gate.allowed)
      throw new Error(`Too many attempts. Try again in ${gate.remaining}s.`)

    setLoading(true)
    try {
      setPendingEmailVerification(null)
      const emailClean = sanitizeEmail(email)
      const nameClean  = sanitizeName(name)

      if (AUTH_VIA_EDGE) {
        try {
          const { user: newUser } = await signUpViaEdge(emailClean, password, nameClean)
          rateLimiter.reset(key)
          initialAuthHydrated.current = true
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            setUser(session.user)
            return
          }
          setUser(null)
          setPendingEmailVerification(newUser?.email ?? emailClean)
        } catch (err) {
          rateLimiter.consume(key)
          throw err
        }
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email: emailClean,
        password,
        options: {
          data: { full_name: nameClean },
        },
      })

      if (error) {
        rateLimiter.consume(key)
        throw new Error(safeSignupErrorMessage(error))
      }

      rateLimiter.reset(key)
      if (data.session?.user) {
        initialAuthHydrated.current = true
        setUser(data.session.user)
        return
      }
      setUser(null)
      setPendingEmailVerification(
        data.user?.email ?? data.user?.new_email ?? emailClean,
      )
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    clearTimeout(activityTimer.current)
    setPendingEmailVerification(null)
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  const dismissPendingEmailVerification = useCallback(() => {
    setPendingEmailVerification(null)
  }, [])

  return (
    <AuthCtx.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        pendingEmailVerification,
        dismissPendingEmailVerification,
      }}
    >
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
