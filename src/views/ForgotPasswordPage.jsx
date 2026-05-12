'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { sanitizeEmail, isValidEmail } from '../lib/validators.js'
import { Button, Input, T } from '../components/ui/index.jsx'

export function ForgotPasswordPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (user) router.replace('/')
  }, [user, router])

  const handleSubmit = async () => {
    setError('')
    const clean = sanitizeEmail(email)
    if (!clean) {
      setError('Email is required.')
      return
    }
    if (!isValidEmail(clean)) {
      setError('Enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error: supaErr } = await supabase.auth.resetPasswordForEmail(clean, {
        redirectTo: `${origin}/auth/update-password`,
      })
      if (supaErr) {
        setError('Unable to send reset email. Please try again later.')
        return
      }
      setSent(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="portal-standalone-auth" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: T.card, borderRadius: '16px', border: `1px solid ${T.border}`, padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: T.text, margin: '0 0 8px' }}>Reset password</h1>
        <p style={{ fontSize: '13px', color: T.muted, margin: '0 0 24px', lineHeight: 1.5 }}>
          Enter the email on your account. If it matches a registered provider, we will send a reset link.
        </p>

        {sent ? (
          <div role="status" style={{ background: T.successBg, border: `1px solid ${T.successBorder}`, borderRadius: '8px', padding: '14px', fontSize: '13px', color: T.success, lineHeight: 1.5 }}>
            If an account exists for that address, you will receive an email with a link to choose a new password. Check your spam folder if nothing arrives within a few minutes.
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" style={{ background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: T.danger }}>
                {error}
              </div>
            )}
            <Input
              label="Email address"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="provider@example.com"
              required
              autoComplete="email"
            />
            <Button onClick={handleSubmit} disabled={submitting} full style={{ marginTop: '16px' }}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </>
        )}

        <p style={{ marginTop: '20px', fontSize: '13px', textAlign: 'center' }}>
          <Link href="/" style={{ color: T.brand, fontWeight: '600', textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
