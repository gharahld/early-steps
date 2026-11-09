import { useEffect, useId, useState } from 'react'
import { useInvoices } from '../hooks/useInvoices.js'
import { useSoapNotes } from '../hooks/useSoapNotes.js'
import { Button, Badge, Card, CardHeader, T } from '../components/ui/index.jsx'

const thStyle = {
  padding: '10px 16px', textAlign: 'left', fontSize: '11px',
  fontWeight: '700', letterSpacing: '0.07em', color: T.muted,
  textTransform: 'uppercase', borderBottom: `1px solid ${T.border}`,
}
const tdStyle = { padding: '14px 16px', color: T.muted }
const inputStyle = { width: '100%', padding: '8px 10px', border: `1.5px solid ${T.border}`, borderRadius: '6px', fontSize: '13px', color: T.text, background: '#fff', outline: 'none', boxSizing: 'border-box' }
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase', marginBottom: '5px' }

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '—'
}

function ProfileCard({ profile, onSave }) {
  const ids = { name: useId(), title: useId(), license: useId() }
  const isEmpty = !profile.name
  const [editing, setEditing] = useState(isEmpty)
  const [draft, setDraft] = useState(profile)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setDraft(profile)
    setEditing(!profile.name)
  }, [profile])

  const summary = [profile.name, profile.title, profile.license && `License ${profile.license}`].filter(Boolean).join(' · ')

  const save = () => {
    onSave(draft)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <Card style={{ marginBottom: '16px' }}>
      <CardHeader right={!editing && (
        <Button onClick={() => setEditing(true)} variant="secondary" size="sm">Edit</Button>
      )}>
        Provider Profile
      </CardHeader>
      {editing ? (
        <div style={{ padding: '18px 22px' }}>
          <p style={{ margin: '0 0 14px', fontSize: '12px', color: T.muted }}>
            Saved on this device and filled in automatically on new invoices and SOAP notes.
          </p>
          <div className="portal-patient-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '14px' }}>
            {[['name', 'Name', 'e.g. Aleiah Bruno'], ['title', 'Title', 'e.g. PTA'], ['license', 'License #', 'e.g. 22266']].map(([field, label, ph]) => (
              <div key={field} className="portal-fi">
                <label htmlFor={ids[field]} style={labelStyle}>{label}</label>
                <input id={ids[field]} value={draft[field]} placeholder={ph}
                  onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))} style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button onClick={save} size="sm" disabled={!draft.name.trim()}>Save Profile</Button>
            {!isEmpty && <Button onClick={() => { setDraft(profile); setEditing(false) }} variant="secondary" size="sm">Cancel</Button>}
          </div>
        </div>
      ) : (
        <div role="status" aria-live="polite" style={{ padding: '14px 22px', fontSize: '13px', color: T.text, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {summary}
          {saved && <Badge color="green">✓ Saved</Badge>}
        </div>
      )}
    </Card>
  )
}

function ListState({ loading, error, colSpan, emptyText }) {
  if (loading) return <tr><td colSpan={colSpan} style={{ padding: '40px', textAlign: 'center', color: T.muted }}>Loading…</td></tr>
  if (error) return <tr><td colSpan={colSpan} style={{ padding: '20px 22px', background: T.dangerBg, color: T.danger }}>Could not load saved forms. Please refresh.</td></tr>
  return <tr><td colSpan={colSpan} style={{ padding: '40px', textAlign: 'center', color: T.subtle }}>{emptyText}</td></tr>
}

export function Dashboard({ profile, profileLoaded, onSaveProfile, onNewInvoice, onOpenInvoice, onNewSoapNote, onOpenSoapNote }) {
  const { invoices, loading: invLoading, error: invError } = useInvoices()
  const { notes, loading: soapLoading, error: soapError } = useSoapNotes()

  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const submitted     = invoices.filter(i => i.status === 'submitted').length
  const drafts        = invoices.filter(i => i.status === 'draft').length
  const soapThisMonth = notes.filter(n => n.date?.startsWith(ym)).length

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>

      <div className="portal-dash-header" style={{
        background: T.navy, height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '800', color: '#fff', fontSize: '13px',
          }}>ES</div>
          <div>
            <div style={{ color: '#fff', fontWeight: '700', fontSize: '13px' }}>Broward Early Steps</div>
            <div className="portal-dash-hide-xs" style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '0.06em' }}>PROVIDER PORTAL</div>
          </div>
        </div>
      </div>

      <main className="portal-dash-content" style={{ maxWidth: '1040px', margin: '0 auto', padding: '32px 20px' }}>

        <div className="portal-dash-title-row" style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: T.text, margin: 0 }}>My Forms</h1>
          <p className="portal-dash-subtitle" style={{ fontSize: '13px', color: T.muted, margin: '4px 0 0' }}>
            Monthly service logs and daily SOAP notes — each prints as its own PDF
          </p>
        </div>

        {profileLoaded && <ProfileCard profile={profile} onSave={onSaveProfile} />}

        <div className="portal-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Invoices Submitted',   value: submitted,     color: T.success, bg: T.successBg, icon: '✓' },
            { label: 'Invoice Drafts',       value: drafts,        color: T.warning, bg: T.warningBg, icon: '✏️' },
            { label: 'SOAP Notes This Month', value: soapThisMonth, color: T.brand,   bg: '#eff6ff',   icon: '📝' },
          ].map(({ label, value, color, bg, icon }) => (
            <div key={label} style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: '12px', padding: '20px 22px',
              display: 'flex', alignItems: 'center', gap: '14px',
            }}>
              <div aria-hidden="true" style={{ width: '40px', height: '40px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: '800', color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '12px', color: T.muted, fontWeight: '600', marginTop: '2px' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Monthly service log / invoices ──────────────────────────────── */}
        <Card style={{ marginBottom: '16px' }}>
          <CardHeader right={<Button onClick={onNewInvoice} size="sm">+ New Invoice</Button>}>
            Monthly Service Log / Invoice ({invoices.length})
          </CardHeader>
          <div className="portal-table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Child Name', 'Billing Month', 'Visits', 'Status', 'Created', ''].map(h => <th key={h} scope="col" style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {invLoading || invError || invoices.length === 0 ? (
                  <ListState loading={invLoading} error={invError} colSpan={6}
                    emptyText={<>No invoices yet. Click <strong>+ New Invoice</strong> to start one.</>} />
                ) : invoices.map(inv => (
                  <tr key={inv.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ ...tdStyle, fontWeight: '600', color: T.text }}>{inv.child_name || '—'}</td>
                    <td style={tdStyle}>{inv.billing_month || '—'}</td>
                    <td style={tdStyle}>{inv.service_entries?.[0]?.count ?? 0}</td>
                    <td style={tdStyle}>
                      <Badge color={inv.status === 'submitted' ? 'green' : 'amber'}>
                        {inv.status === 'submitted' ? 'Submitted' : 'Draft'}
                      </Badge>
                    </td>
                    <td style={tdStyle}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <Button onClick={() => onOpenInvoice(inv)} variant="secondary" size="sm">
                        {inv.status === 'draft' ? 'Continue' : 'View'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Daily SOAP notes ────────────────────────────────────────────── */}
        <Card style={{ marginBottom: '16px' }}>
          <CardHeader right={<Button onClick={onNewSoapNote} size="sm">+ New SOAP Note</Button>}>
            Daily SOAP Notes ({notes.length})
          </CardHeader>
          <div className="portal-table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Date', 'Child', 'Location', 'Signature', ''].map(h => <th key={h} scope="col" style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {soapLoading || soapError || notes.length === 0 ? (
                  <ListState loading={soapLoading} error={soapError} colSpan={5}
                    emptyText={<>No SOAP notes yet. Click <strong>+ New SOAP Note</strong> to start one.</>} />
                ) : notes.map(note => (
                  <tr key={note.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ ...tdStyle, fontWeight: '600', color: T.text }}>{formatDate(note.date)}</td>
                    <td style={tdStyle}>{note.child_name || '—'}</td>
                    <td style={tdStyle}>{note.location || '—'}</td>
                    <td style={tdStyle}>
                      <Badge color={note.signature ? 'green' : 'amber'}>{note.signature ? 'Signed' : 'Not signed'}</Badge>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <Button onClick={() => onOpenSoapNote(note)} variant="secondary" size="sm">Open</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{
          padding: '12px 16px', background: '#f8fafc',
          border: `1px solid ${T.border}`, borderRadius: '8px',
          display: 'flex', gap: '10px', alignItems: 'flex-start',
        }}>
          <span aria-hidden="true" style={{ fontSize: '14px' }}>🛡️</span>
          <p style={{ margin: 0, fontSize: '11px', color: T.muted, lineHeight: 1.6 }}>
            <strong style={{ color: T.text }}>Storage:</strong> Invoices and SOAP notes are saved only in this
            browser on this device. Anyone using this browser can see them, and clearing browser data deletes
            them — keep the downloaded PDFs as your record.
          </p>
        </div>
      </main>
    </div>
  )
}
