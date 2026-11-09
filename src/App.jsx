import { useState } from 'react'
import { useProviderProfile } from './hooks/useProviderProfile.js'
import { Dashboard }    from './views/Dashboard.jsx'
import { InvoiceForm }  from './views/InvoiceForm.jsx'
import { SoapNoteForm } from './views/SoapNoteForm.jsx'

export default function App() {
  const { profile, loaded, saveProfile } = useProviderProfile()
  const [view,     setView]     = useState('dashboard') // 'dashboard' | 'invoice' | 'soap'
  const [selected, setSelected] = useState(null)        // invoice or SOAP note being edited

  const open = (nextView, item = null) => { setSelected(item); setView(nextView) }
  const back = () => open('dashboard')

  if (view === 'invoice') {
    return <InvoiceForm key={selected?.id ?? 'new'} initialData={selected} profile={profile} onBack={back} />
  }

  if (view === 'soap') {
    return <SoapNoteForm key={selected?.id ?? 'new'} initialData={selected} profile={profile} onBack={back} />
  }

  return (
    <Dashboard
      profile={profile}
      profileLoaded={loaded}
      onSaveProfile={saveProfile}
      onNewInvoice={() => open('invoice')}
      onOpenInvoice={inv => open('invoice', inv)}
      onNewSoapNote={() => open('soap')}
      onOpenSoapNote={note => open('soap', note)}
    />
  )
}
