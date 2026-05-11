/**
 * Client-side rate limiter.
 *
 * ⚠️  This is a UX-layer defense (prevents accidental hammering & provides
 *     user feedback). For real brute-force protection, add server-side
 *     rate limiting via a Supabase Edge Function or middleware (e.g. Redis
 *     with sliding-window counters).
 *
 * Buckets: keyed by string (e.g. "login:user@email.com")
 * Strategy: fixed window — MAX_ATTEMPTS per WINDOW_MS, then lockout.
 */

const MAX_ATTEMPTS = 5
const WINDOW_MS    = 15 * 60 * 1000  // 15 minutes

// In-memory store — resets on page refresh (intentional for client-side).
const store = /** @type {Record<string, { attempts: number, lockedUntil: number }>} */ ({})

export const rateLimiter = {
  /**
   * Check whether a key is currently allowed.
   * @returns {{ allowed: boolean, remaining: number, attemptsLeft: number }}
   */
  check(key) {
    const now = Date.now()
    const rec = store[key] ?? { attempts: 0, lockedUntil: 0 }

    if (now < rec.lockedUntil) {
      const remaining = Math.ceil((rec.lockedUntil - now) / 1000)
      return { allowed: false, remaining, attemptsLeft: 0 }
    }

    return {
      allowed: true,
      remaining: 0,
      attemptsLeft: MAX_ATTEMPTS - rec.attempts,
    }
  },

  /**
   * Record a failed attempt. Locks the key if MAX_ATTEMPTS is reached.
   */
  consume(key) {
    const now = Date.now()
    const rec = store[key] ?? { attempts: 0, lockedUntil: 0 }
    rec.attempts += 1

    if (rec.attempts >= MAX_ATTEMPTS) {
      rec.lockedUntil = now + WINDOW_MS
      rec.attempts    = 0  // reset counter after locking
    }

    store[key] = rec
  },

  /** Clear the record for a key (call on successful auth). */
  reset(key) {
    delete store[key]
  },
}
