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
import { PREVIEW_USER } from '../lib/devPreviewUser.js'

const AuthCtx = createContext(null)

/** Server-side rate limits via Supabase Edge Functions (opt-in — see README). */
const AUTH_VIA_EDGE = process.env.NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS === 'true'

/** Dev-only: skip login to inspect dashboard/invoice UI (no real Supabase session). */
const PREVIEW_DASHBOARD =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_PREVIEW_DASHBOARD === 'true'

/** 30-minute inactivity timeout (milliseconds). */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)  // true while resolving initial session
  /** Set when signUp succeeds but there is no session yet (email confirmation required). */
  const [pendingEmailVerification, setPendingEmailVerification] = useState(null)
  /** After Log out in preview mode, show real login until page refresh. */
  const [previewDismissed, setPreviewDismissed] = useState(false)

  const activityTimer = useRef(null)

  const isPreviewMode =
    PREVIEW_DASHBOARD &&
    !previewDismissed &&
    user?.user_metadata?.__preview === true

  // ── Activity-based session expiry ─────────────────────────────────────────
  const resetActivityTimer = useCallback(() => {
    clearTimeout(activityTimer.current)
    activityTimer.current = setTimeout(async () => {
      await supabase.auth.signOut()
      setUser(null)
    }, SESSION_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    if (!user || isPreviewMode) return
    const events = ['mousemove', 'keydown', 'click', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetActivityTimer, { passive: true }))
    resetActivityTimer()
    return () => {
      clearTimeout(activityTimer.current)
      events.forEach(e => window.removeEventListener(e, resetActivityTimer))
    }
  }, [user, resetActivityTimer, isPreviewMode])

  // ── Resolve existing session on mount ────────────────────────────────────
  useEffect(() => {
    if (PREVIEW_DASHBOARD && !previewDismissed) {
      setUser(PREVIEW_USER)
      setLoading(false)
      return
    }

    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      // Never clobber a signed-in user with null from unrelated events (race after SIGNED_IN).
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null)
        return
      }
      if (session?.user) {
        setUser(session.user)
        return
      }
      if (event === 'INITIAL_SESSION') {
        setUser(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [previewDismissed])

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
          await signInViaEdge(emailClean, password)
        } catch (err) {
          rateLimiter.consume(key)
          throw err
        }
        rateLimiter.reset(key)
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
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
      setUser(data.session?.user ?? data.user ?? null)
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
    if (isPreviewMode) {
      setPreviewDismissed(true)
      setUser(null)
      return
    }
    await supabase.auth.signOut()
    setUser(null)
  }, [isPreviewMode])

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
        isPreviewMode,
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
