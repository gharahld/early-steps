import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext.jsx'
import { Button, Input, StrengthBar, T } from '../components/ui/index.jsx'
import {
  sanitizeEmail, sanitizeName,
  validateLogin, validateSignup,
  passwordStrength,
} from '../lib/validators.js'

export function AuthPage() {
  const {
    login,
    signup,
    loading,
    pendingEmailVerification,
    dismissPendingEmailVerification,
  } = useAuth()

  const [mode,        setMode]        = useState('login')  // 'login' | 'signup'
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [name,        setName]        = useState('')
  const [errors,      setErrors]      = useState({})
  const [globalError, setGlobalError] = useState('')
  const [countdown,   setCountdown]   = useState(0)

  const pwScore = passwordStrength(password)

  // Live countdown ticker
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleSubmit = async () => {
    setGlobalError('')
    const fieldErrors = mode === 'login'
      ? validateLogin({ email, password })
      : validateSignup({ email, password, name })

    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return }
    setErrors({})

    try {
      if (mode === 'login') {
        await login(sanitizeEmail(email), password)
      } else {
        await signup(sanitizeEmail(email), password, sanitizeName(name))
      }
    } catch (err) {
      const msg = err.message || ''
      // Check for lockout message from rateLimiter
      const secMatch = msg.match(/Try again in (\d+)s/)
      if (secMatch) {
        setCountdown(parseInt(secMatch[1], 10))
      }
      setGlobalError(msg)
    }
  }

  const switchMode = () => {
    setMode(m => m === 'login' ? 'signup' : 'login')
    setErrors({})
    setGlobalError('')
  }

  const locked = countdown > 0

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: T.navy }}>
      {/* ── Left branding panel ────────────────────────────────────────────── */}
      <div style={{
        width: '420px', flexShrink: 0, minHeight: '100vh',
        background: 'linear-gradient(160deg, #0f172a 0%, #1e3a5f 100%)',
        display: 'flex', flexDirection: 'column', padding: '48px 44px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '800', color: '#fff', fontSize: '15px',
          }}>ES</div>
          <div>
            <div style={{ color: '#fff', fontWeight: '700', fontSize: '15px' }}>Broward Early Steps</div>
            <div style={{ color: '#64748b', fontSize: '11px', letterSpacing: '0.06em' }}>PROVIDER PORTAL</div>
          </div>
        </div>

        <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <h1 style={{ color: '#fff', fontSize: '32px', fontWeight: '800', lineHeight: 1.2, margin: '0 0 16px' }}>
            Therapy Provider<br />Invoice System
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.7, margin: '0 0 36px' }}>
            Securely log services, collect digital signatures, and submit monthly invoices.
          </p>
          {[
            ['🔒', 'Secure access for authorized providers'],
            ['📋', 'HIPAA-aligned data handling'],
            ['⚡', 'Instant PDF generation'],
            ['🛡️', 'Secure authentication'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <span style={{ fontSize: '16px' }}>{icon}</span>
              <span style={{ color: '#cbd5e1', fontSize: '13px' }}>{text}</span>
            </div>
          ))}
        </div>

        <p style={{ color: '#334155', fontSize: '11px' }}>
          © {new Date().getFullYear()} Broward Early Steps. All rights reserved.
        </p>
      </div>

      {/* ── Right form panel ───────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: T.bg, padding: '48px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{
            background: T.card, borderRadius: '16px',
            border: `1px solid ${T.border}`, padding: '36px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: T.text, margin: '0 0 4px' }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p style={{ fontSize: '13px', color: T.muted, margin: '0 0 28px' }}>
              {mode === 'login'
                ? 'Sign in to access your provider dashboard.'
                : 'Register to start submitting service logs.'}
            </p>

            {/* Email confirmation — Supabase often returns no session until the user confirms */}
            {pendingEmailVerification && (
              <div role="status" style={{
                background: T.successBg, border: `1px solid ${T.successBorder}`,
                borderRadius: '8px', padding: '12px 14px', marginBottom: '20px',
                fontSize: '13px', color: T.success,
              }}>
                <div style={{ fontWeight: '700', marginBottom: '6px' }}>Account created — check your email</div>
                <div style={{ lineHeight: 1.5 }}>
                  We sent a confirmation link to <strong>{pendingEmailVerification}</strong>.
                  After you tap the link, return here and use <strong>Sign in</strong> with the same email and password.
                </div>
                <button
                  type="button"
                  onClick={dismissPendingEmailVerification}
                  style={{
                    marginTop: '10px', background: 'none', border: 'none',
                    color: T.brand, fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0,
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Lockout banner */}
            {locked && (
              <div role="alert" style={{
                background: T.dangerBg, border: `1px solid ${T.dangerBorder}`,
                borderRadius: '8px', padding: '10px 14px', marginBottom: '20px',
                fontSize: '13px', color: T.danger,
              }}>
                Too many attempts. Try again in <strong>{countdown}s</strong>.
              </div>
            )}

            {/* Global error (show even if “check email” is visible — e.g. login after signup) */}
            {globalError && !locked && (
              <div role="alert" style={{
                background: T.dangerBg, border: `1px solid ${T.dangerBorder}`,
                borderRadius: '8px', padding: '10px 14px', marginBottom: '20px',
                fontSize: '13px', color: T.danger,
              }}>
                {globalError}
              </div>
            )}

            {mode === 'signup' && (
              <Input
                label="Full Name" value={name} onChange={setName}
                placeholder="Maria Gonzalez" error={errors.name}
                required autoComplete="name" maxLength={100}
              />
            )}

            <Input
              label="Email address" value={email} onChange={setEmail}
              type="email" placeholder="provider@example.com"
              error={errors.email} required autoComplete="email"
            />

            <Input
              label="Password" value={password} onChange={setPassword}
              type="password"
              placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'}
              error={errors.password} required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />

            {mode === 'signup' && password.length > 0 && (
              <StrengthBar score={pwScore} />
            )}

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '16px' }}>
                <Link
                  href="/forgot-password"
                  style={{ fontSize: '12px', color: T.brand, fontWeight: '600', textDecoration: 'none' }}
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={loading || locked}
              full
              style={{ padding: '12px', fontSize: '15px', marginTop: '4px' }}
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>

            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: T.muted }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={switchMode}
                style={{ background: 'none', border: 'none', color: T.brand, fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: '#94a3b8' }}>
            For your security, sessions may end after a period of inactivity.
          </p>
        </div>
      </div>
    </div>
  )
}
