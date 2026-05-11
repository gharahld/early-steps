'use client'

import { useEffect } from 'react'
import { Button, T } from '../components/ui/index.jsx'

export default function AppError({ error, reset }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') console.error(error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
        background: T.bg,
      }}
    >
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <h1 style={{ color: T.text, fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
          Please try again. If the problem continues, refresh the page or sign in again.
        </p>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  )
}
