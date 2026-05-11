'use client'

import { AuthProvider } from '../context/AuthContext.jsx'

export function Providers({ children }) {
  return <AuthProvider>{children}</AuthProvider>
}
