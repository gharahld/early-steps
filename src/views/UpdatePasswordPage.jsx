'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase.js'
import { validatePasswordReset, passwordStrength } from '../lib/validators.js'
import { Button, Input, StrengthBar, T } from '../components/ui/index.jsx'

export function UpdatePasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    let sawRecovery = false

    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash.includes('type=recovery')) {
        sawRecovery = true
        setReady(true)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY') {
        sawRecovery = true
        setReady(true)
        setInvalid(false)
      }
    })

    const timer = setTimeout(() => {
      if (cancelled || sawRecovery) return
      setInvalid(true)
    }, 4000)

    return () => {
      cancelled = true
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  const pwScore = passwordStrength(password)

  const handleSubmit = async () => {
    setGlobalError('')
    const fieldErrors = validatePasswordReset({ password, confirmPassword })
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setGlobalError('Could not update password. Try a stronger password or request a new link.')
        return
      }
      setDone(true)
      await supabase.auth.signOut()
      setTimeout(() => router.replace('/'), 1200)
    } finally {
      setSubmitting(false)
    }
  }

  if (invalid && !ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '420px', background: T.card, borderRadius: '16px', border: `1px solid ${T.border}`, padding: '32px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '800', color: T.text, marginBottom: '12px' }}>Link invalid or expired</h1>
          <p style={{ fontSize: '13px', color: T.muted, marginBottom: '20px', lineHeight: 1.5 }}>
            Request a new reset link and open it from the same device/browser.
          </p>
          <Link href="/forgot-password" style={{ color: T.brand, fontWeight: '700', fontSize: '14px' }}>Request new link</Link>
          <p style={{ marginTop: '16px' }}>
            <Link href="/" style={{ color: T.muted, fontSize: '13px' }}>Sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  if (!ready && !invalid) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.muted, fontFamily: 'sans-serif' }}>
        Verifying link…
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.success, fontWeight: '600' }}>
        Password updated. Redirecting to sign in…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: T.card, borderRadius: '16px', border: `1px solid ${T.border}`, padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: T.text, margin: '0 0 8px' }}>Choose a new password</h1>
        <p style={{ fontSize: '13px', color: T.muted, margin: '0 0 24px' }}>Use at least 8 characters. Mix letters, numbers, and symbols for a stronger password.</p>

        {globalError && (
          <div role="alert" style={{ background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: T.danger }}>
            {globalError}
          </div>
        )}

        <Input
          label="New password"
          value={password}
          onChange={setPassword}
          type="password"
          placeholder="At least 8 characters"
          error={errors.password}
          required
          autoComplete="new-password"
        />
        {password.length > 0 && <StrengthBar score={pwScore} />}
        <Input
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          type="password"
          placeholder="Repeat password"
          error={errors.confirmPassword}
          required
          autoComplete="new-password"
        />
        <Button onClick={handleSubmit} disabled={submitting} full style={{ marginTop: '16px' }}>
          {submitting ? 'Saving…' : 'Update password'}
        </Button>
        <p style={{ marginTop: '16px', textAlign: 'center' }}>
          <Link href="/" style={{ color: T.muted, fontSize: '13px' }}>Cancel</Link>
        </p>
      </div>
    </div>
  )
}
