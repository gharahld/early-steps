import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { AuthPage }   from './views/AuthPage.jsx'
import { Dashboard }  from './views/Dashboard.jsx'
import { InvoiceForm } from './views/InvoiceForm.jsx'

function Router() {
  const { user, loading } = useAuth()
  const [view,     setView]     = useState('dashboard') // 'dashboard' | 'invoice'
  const [selected, setSelected] = useState(null)        // invoice being edited

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontFamily: 'sans-serif', color: '#64748b' }}>
        Loading…
      </div>
    )
  }

  if (!user) return <AuthPage />

  if (view === 'invoice') {
    return (
      <InvoiceForm
        initialData={selected}
        onBack={() => { setView('dashboard'); setSelected(null) }}
      />
    )
  }

  return (
    <Dashboard
      onNewInvoice={() => { setSelected(null); setView('invoice') }}
      onOpenInvoice={inv => { setSelected(inv); setView('invoice') }}
    />
  )
}

export default function App() {
  return <Router />
}
