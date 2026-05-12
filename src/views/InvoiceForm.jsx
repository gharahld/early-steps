import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useInvoices } from '../hooks/useInvoices.js'
import { SignaturePad } from '../components/SignaturePad.jsx'
import { buildInvoicePdfDocument, invoicePdfFilename, openInvoicePdfForPrint } from '../utils/pdfGenerator.js'
import { Button, Badge, CardHeader, T } from '../components/ui/index.jsx'

const PROCEDURE_CODES = ['', 'PHY', 'OCCT', 'SPL', 'PSTH', 'OCTH', 'SPCH', 'COIFF', 'CONOF', 'CONPF', 'CONSF', 'TELEC']
const LOCATION_CODES  = [
  { code: '1', label: '1 – Home' },
  { code: 'A', label: 'A – Office' },
  { code: '5', label: '5 – Daycare' },
  { code: 'P', label: 'P – Public Place' },
  { code: '9', label: '9 – Dev. Preschool' },
]
const EMPTY_ENTRY = () => ({
  id: crypto.randomUUID(),
  dateOfService: '', procedureCode: '', fpg: 'F',
  renderingProvider: '', locationCode: '1',
  arrivalTime: '', departureTime: '', travelMinutes: '', caregiverSignature: '',
})

// Tiny inline field wrappers used only inside this form
function FI({ label, value, onChange, type = 'text', placeholder, span = 1 }) {
  return (
    <div className="portal-fi" style={{ gridColumn: `span ${span}` }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase', marginBottom: '5px' }}>{label}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', border: `1.5px solid ${T.border}`, borderRadius: '6px', fontSize: '13px', color: T.text, background: '#fff', outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )
}

const defaultHeader = (user, seed = {}) => ({
  childName:           seed.child_name ?? '',
  dob:                 seed.dob != null && seed.dob !== '' ? String(seed.dob).slice(0, 10) : '',
  caregiver:           seed.caregiver ?? '',
  address:             seed.address ?? '',
  cell:                seed.cell ?? '',
  chartNg:             seed.chart_ng ?? '',
  serviceCoordinator:  seed.service_coordinator ?? '',
  medicaidNumber:      seed.medicaid_number ?? '',
  frequency:           seed.frequency ?? '',
  billingMonth:        seed.billing_month ?? '',
  provider:            seed.provider_name ?? user?.user_metadata?.full_name ?? '',
  providerAttestation: seed.provider_attestation ?? user?.user_metadata?.full_name ?? '',
})

function mapDbEntriesToForm(rows) {
  const sorted = [...(rows || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return sorted.map(se => ({
    id: se.id,
    dateOfService:       se.date_of_service ? String(se.date_of_service).slice(0, 10) : '',
    procedureCode:       se.procedure_code ?? '',
    fpg:                 se.fpg || 'F',
    renderingProvider:   se.rendering_provider ?? '',
    locationCode:        se.location_code ?? '1',
    arrivalTime:         se.arrival_time ?? '',
    departureTime:        se.departure_time ?? '',
    travelMinutes:       se.travel_minutes != null ? String(se.travel_minutes) : '',
    caregiverSignature:  se.caregiver_signature ?? '',
  }))
}

export function InvoiceForm({ initialData, onBack }) {
  const { user } = useAuth()
  const { saveInvoice, fetchInvoiceById } = useInvoices()

  const [submitStatus,   setSubmitStatus]   = useState('idle') // idle | saving | generating | done | error
  const [saveError,      setSaveError]      = useState('')
  const [detailLoading,  setDetailLoading]  = useState(() => !!initialData?.id)
  const [detailError,    setDetailError]    = useState('')
  const [signatureData,  setSignatureData]  = useState(null)

  const [header, setHeader] = useState(() => defaultHeader(null, initialData || {}))

  const [entries, setEntries] = useState([EMPTY_ENTRY(), EMPTY_ENTRY(), EMPTY_ENTRY()])

  useEffect(() => {
    let cancelled = false
    if (!initialData?.id) {
      setDetailLoading(false)
      setDetailError('')
      setHeader(defaultHeader(user, {}))
      setEntries([EMPTY_ENTRY(), EMPTY_ENTRY(), EMPTY_ENTRY()])
      setSignatureData(null)
      return () => { cancelled = true }
    }

    setDetailLoading(true)
    setDetailError('')
    fetchInvoiceById(initialData.id)
      .then(row => {
        if (cancelled || !row) return
        setHeader(defaultHeader(user, {
          child_name: row.child_name,
          dob: row.dob,
          caregiver: row.caregiver,
          address: row.address,
          cell: row.cell,
          chart_ng: row.chart_ng,
          service_coordinator: row.service_coordinator,
          medicaid_number: row.medicaid_number,
          frequency: row.frequency,
          billing_month: row.billing_month,
          provider_name: row.provider_name,
          provider_attestation: row.provider_attestation,
        }))
        const mapped = mapDbEntriesToForm(row.service_entries)
        setEntries(mapped.length ? mapped : [EMPTY_ENTRY(), EMPTY_ENTRY(), EMPTY_ENTRY()])
        setSignatureData(null)
      })
      .catch(err => {
        if (!cancelled) setDetailError(err.message || 'Could not load this invoice.')
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => { cancelled = true }
  }, [initialData?.id, fetchInvoiceById, user])

  const setH = useCallback((f, v) => setHeader(h => ({ ...h, [f]: v })), [])
  const setE = useCallback((id, f, v) => setEntries(p => p.map(e => e.id === id ? { ...e, [f]: v } : e)), [])
  const addEntry    = () => setEntries(p => [...p, EMPTY_ENTRY()])
  const removeEntry = id => setEntries(p => p.filter(e => e.id !== id))

  const canSubmit    = signatureData && header.provider
  const filledCount  = entries.filter(e => e.dateOfService || e.procedureCode).length

  const handleOpenPrintPdf = () => {
    if (!canSubmit || !signatureData) return
    openInvoicePdfForPrint({ header, entries, signatureDataUrl: signatureData })
  }

  const handleSave = async (status) => {
    setSaveError('')
    setSubmitStatus('saving')
    try {
      await saveInvoice({ id: initialData?.id, header, entries, status })
      if (status === 'submitted') {
        setSubmitStatus('generating')
        const doc = buildInvoicePdfDocument({ header, entries, signatureDataUrl: signatureData })
        doc.save(invoicePdfFilename(header))
        setSubmitStatus('done')
        setTimeout(() => setSubmitStatus('idle'), 3000)
      } else {
        setSubmitStatus('idle')
      }
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.')
      setSubmitStatus('error')
    }
  }

  const card     = { background: T.card, borderRadius: '12px', border: `1px solid ${T.border}`, marginBottom: '18px', overflow: 'hidden' }
  const cardHead = { padding: '13px 22px', background: '#f8fafc', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
  const secLabel = { fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: '#475569', textTransform: 'uppercase' }
  const cellStyle = { padding: '4px 6px' }

  const topBar = (
    <div className="portal-invoice-topbar" style={{ background: T.navy, height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>← Back</button>
        <div style={{ width: '1px', height: '20px', background: '#1e293b', flexShrink: 0 }} />
        <span className="portal-invoice-topbar-title" style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>
          {initialData ? `Invoice — ${initialData.child_name}` : 'New Invoice'}
        </span>
      </div>
    </div>
  )

  if (initialData?.id && detailLoading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        {topBar}
        <div className="portal-invoice-content" style={{ padding: '48px 24px', textAlign: 'center', color: T.muted, fontSize: '14px' }}>Loading invoice…</div>
      </div>
    )
  }

  if (initialData?.id && detailError) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        {topBar}
        <div className="portal-invoice-content" style={{ maxWidth: '560px', margin: '28px auto', padding: '20px 22px', background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, borderRadius: '8px', fontSize: '14px', color: T.danger }}>
          <p style={{ margin: '0 0 14px', lineHeight: 1.5 }}>{detailError}</p>
          <Button onClick={onBack} variant="secondary" size="sm">Back to list</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <div className="portal-invoice-topbar" style={{ background: T.navy, height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>← Back</button>
          <div style={{ width: '1px', height: '20px', background: '#1e293b', flexShrink: 0 }} />
          <span className="portal-invoice-topbar-title" style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>
            {initialData ? `Invoice — ${initialData.child_name}` : 'New Invoice'}
          </span>
        </div>
        <div className="portal-invoice-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {submitStatus === 'done' && <Badge color="green">✓ PDF Downloaded</Badge>}
          {submitStatus === 'error' && <Badge color="red">Save failed</Badge>}
          <Button onClick={() => handleSave('draft')} variant="secondary" size="sm"
            disabled={['saving','generating'].includes(submitStatus)}>
            Save Draft
          </Button>
          <Button onClick={() => handleSave('submitted')}
            disabled={!canSubmit || ['saving','generating'].includes(submitStatus)}>
            {submitStatus === 'generating' ? 'Generating…' : submitStatus === 'saving' ? 'Saving…' : '⬇ Submit & Download PDF'}
          </Button>
          <Button type="button" onClick={handleOpenPrintPdf} variant="secondary" size="sm"
            disabled={!canSubmit || ['saving','generating'].includes(submitStatus)}
            title="Opens the same PDF as download in a new tab for printing">
            Print PDF
          </Button>
        </div>
      </div>

      <div className="portal-invoice-content" style={{ maxWidth: '1060px', margin: '0 auto', padding: '24px 18px' }}>

        {saveError && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, borderRadius: '8px', fontSize: '13px', color: T.danger }}>
            {saveError}
          </div>
        )}

        {/* ── Patient Info ──────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={cardHead}><span style={secLabel}>Patient & Billing Information</span></div>
          <div className="portal-patient-grid" style={{ padding: '22px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
            <FI label="Child Name"          value={header.childName}          onChange={v => setH('childName', v)}          placeholder="Full name" />
            <FI label="Date of Birth"       value={header.dob}                onChange={v => setH('dob', v)}                type="date" />
            <FI label="Caregiver"           value={header.caregiver}          onChange={v => setH('caregiver', v)}          placeholder="Caregiver name" />
            <FI label="Address"             value={header.address}            onChange={v => setH('address', v)}            placeholder="Street address" span={2} />
            <FI label="Cell Phone"          value={header.cell}               onChange={v => setH('cell', v)}               placeholder="(555) 000-0000" />
            <FI label="Chart NG #"          value={header.chartNg}            onChange={v => setH('chartNg', v)}            placeholder="NG number" />
            <FI label="Service Coordinator" value={header.serviceCoordinator} onChange={v => setH('serviceCoordinator', v)} placeholder="Coordinator name" />
            <FI label="Medicaid #"          value={header.medicaidNumber}     onChange={v => setH('medicaidNumber', v)}     placeholder="Medicaid number" />
            <FI label="Frequency"           value={header.frequency}          onChange={v => setH('frequency', v)}          placeholder="e.g. 2x/month" />
            <FI label="Billing Month"       value={header.billingMonth}       onChange={v => setH('billingMonth', v)}       type="month" />
            <FI label="Provider"            value={header.provider}           onChange={v => setH('provider', v)}           placeholder="Provider name" />
          </div>
          <div className="portal-attest-strip" style={{ padding: '12px 22px', background: T.warningBg, borderTop: `1px solid ${T.warningBorder}`, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#92400e' }}>
              I, <strong>{header.providerAttestation || '_______________'}</strong>, attest that I have provided the services below.
            </span>
            <input className="portal-attest-input" value={header.providerAttestation} onChange={e => setH('providerAttestation', e.target.value)}
              placeholder="Provider attestation name"
              style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: '6px', border: `1.5px solid ${T.warningBorder}`, fontSize: '12px', width: '210px', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* ── Service Entries ───────────────────────────────────────────────── */}
        <div style={card}>
          <div className="portal-entries-card-head" style={cardHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={secLabel}>Service Entries</span>
              <Badge color="blue">{filledCount} logged</Badge>
            </div>
            <Button onClick={addEntry} variant="secondary" size="sm">+ Add Row</Button>
          </div>
          <div style={{ padding: '8px 22px', background: '#f8fafc', borderBottom: `1px solid ${T.border}`, fontSize: '11px', color: T.muted }}>
            <strong>Proc:</strong> PHY/OCCT/SPL=Session · PSTH/OCTH/SPCH=Eval · COIFF=FSP · GT=Telehealth &nbsp;|&nbsp;
            <strong>Loc:</strong> 1=Home · A=Office · 5=Daycare · P=Public · 9=Dev.Preschool
          </div>
          <div className="portal-entries-scroll" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead><tr style={{ background: '#f8fafc' }}>
                {['#','Date','Procedure','F/P/GT','Rendering Provider','Location','Arrival','Departure','Travel min','Caregiver Sig.',''].map((h, i) => (
                  <th key={i} style={{ padding: '9px 8px', textAlign: 'left', fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', color: T.muted, textTransform: 'uppercase', borderBottom: `2px solid ${T.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {entries.map((e, idx) => {
                  const inp = (val, field, type = 'text', pw) => (
                    <input type={type} value={val} placeholder={pw} onChange={ev => setE(e.id, field, ev.target.value)}
                      style={{ width: '100%', padding: '7px 8px', border: `1.5px solid ${T.border}`, borderRadius: '6px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  )
                  const sel = (val, field, opts) => (
                    <select value={val} onChange={ev => setE(e.id, field, ev.target.value)}
                      style={{ width: '100%', padding: '7px 8px', border: `1.5px solid ${T.border}`, borderRadius: '6px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                      {opts.map(o => typeof o === 'string' ? <option key={o} value={o}>{o || '—'}</option> : <option key={o.code} value={o.code}>{o.label}</option>)}
                    </select>
                  )
                  return (
                    <tr key={e.id} style={{ borderBottom: `1px solid #f1f5f9`, background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ ...cellStyle, color: T.subtle, fontWeight: '700', textAlign: 'center', fontSize: '11px' }}>{idx + 1}</td>
                      <td style={{ ...cellStyle, minWidth: '126px' }}>{inp(e.dateOfService, 'dateOfService', 'date')}</td>
                      <td style={{ ...cellStyle, minWidth: '106px' }}>{sel(e.procedureCode, 'procedureCode', PROCEDURE_CODES)}</td>
                      <td style={{ ...cellStyle, minWidth: '70px' }}>{sel(e.fpg, 'fpg', ['F','P','GT'])}</td>
                      <td style={{ ...cellStyle, minWidth: '140px' }}>{inp(e.renderingProvider, 'renderingProvider', 'text', 'Provider')}</td>
                      <td style={{ ...cellStyle, minWidth: '130px' }}>{sel(e.locationCode, 'locationCode', LOCATION_CODES)}</td>
                      <td style={{ ...cellStyle, minWidth: '84px' }}>{inp(e.arrivalTime, 'arrivalTime', 'time')}</td>
                      <td style={{ ...cellStyle, minWidth: '84px' }}>{inp(e.departureTime, 'departureTime', 'time')}</td>
                      <td style={{ ...cellStyle, minWidth: '68px' }}>{inp(e.travelMinutes, 'travelMinutes', 'number', '0')}</td>
                      <td style={{ ...cellStyle, minWidth: '126px' }}>{inp(e.caregiverSignature, 'caregiverSignature', 'text', 'Signature')}</td>
                      <td style={cellStyle}>
                        <button onClick={() => removeEntry(e.id)} style={{ width: '26px', height: '26px', borderRadius: '6px', background: T.dangerBg, color: T.danger, border: `1px solid ${T.dangerBorder}`, cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Provider Sign-Off (same scroll page as the rest of the form) ───── */}
        <div id="provider-sign-off" style={{ ...card, scrollMarginTop: '72px' }}>
          <div style={cardHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={secLabel}>Provider Sign-Off</span>
              {signatureData
                ? <Badge color="green">✓ Signed</Badge>
                : <Badge color="red">⚠ Signature required to submit</Badge>}
            </div>
          </div>
          <div style={{ padding: '22px' }}>
            <p style={{ fontSize: '13px', color: T.muted, margin: '0 0 20px', lineHeight: 1.55, maxWidth: '52rem' }}>
              This section is part of the same service log as the patient details and service rows above.
              Sign below — your signature is stored with the invoice and included on the PDF you download.
            </p>
            <div style={{ marginBottom: '22px' }}>
              <label htmlFor="invoice-provider-print-name" style={{ display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase', marginBottom: '5px' }}>Print Provider Name</label>
              <input id="invoice-provider-print-name" name="provider_print_name" value={header.provider} onChange={e => setH('provider', e.target.value)} placeholder="Full legal name"
                autoComplete="name"
                style={{ width: '100%', maxWidth: '640px', padding: '8px 10px', border: `1.5px solid ${T.border}`, borderRadius: '6px', fontSize: '13px', color: T.text, background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <span id="invoice-provider-signature-label" style={{ display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase', marginBottom: '8px' }}>Signature of Provider</span>
              <SignaturePad onSigned={setSignatureData} onClear={() => setSignatureData(null)} height={152} ariaLabelledby="invoice-provider-signature-label" />
            </div>
          </div>
          {!signatureData && (
            <div style={{ margin: '0 22px 18px', padding: '10px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', fontSize: '12px', color: '#9a3412' }}>
              Draw your signature in the box above to enable <strong>Submit &amp; Download PDF</strong>. This is one continuous form — scroll up anytime to edit patient or service entries.
            </div>
          )}
        </div>

        {/* ── CDTC Fiscal ───────────────────────────────────────────────────── */}
        <div style={{ ...card, border: '1px dashed #cbd5e1' }}>
          <CardHeader right={<Badge color="amber">Admin Only</Badge>}>
            CDTC Fiscal Processing
          </CardHeader>
          <div className="portal-cdtc-wrap" style={{ padding: '16px 22px 20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead><tr>
                {['Payer','Procedure','Provider','Date Range','Units','Amount','Denial Code'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', color: T.subtle, textTransform: 'uppercase', borderBottom: `1px solid #f1f5f9` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {['MED/TPIN/CONT','MED/TPIN/CONT','MED/TPIN/CONT','CONT – TELEC','CONT – NESF'].map((p, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid #f8fafc` }}>
                    <td style={{ padding: '7px 10px', color: T.subtle, fontSize: '11px' }}>{p}</td>
                    {[0,1,2,3,4,5].map(j => <td key={j} style={{ padding: '7px 10px' }}><div style={{ height: '24px', background: '#f8fafc', borderRadius: '4px', border: `1px solid #f1f5f9` }} /></td>)}
                  </tr>
                ))}
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan={4} style={{ padding: '9px 10px', textAlign: 'right', fontWeight: '700', fontSize: '11px', color: '#475569' }}>TOTALS</td>
                  <td style={{ padding: '9px 10px' }}><div style={{ height: '24px', background: '#e2e8f0', borderRadius: '4px', border: `1px solid ${T.border}` }} /></td>
                  <td style={{ padding: '9px 10px' }}><div style={{ height: '24px', background: '#e2e8f0', borderRadius: '4px', border: `1px solid ${T.border}` }} /></td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
        <div className="portal-invoice-footer" style={{ textAlign: 'center', padding: '16px 0 32px' }}>
          <Button
            onClick={() => handleSave('submitted')}
            disabled={!canSubmit || ['saving','generating'].includes(submitStatus)}
            style={{
              padding: '14px 36px', fontSize: '15px',
              background: canSubmit ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : '#e2e8f0',
              color: canSubmit ? '#fff' : T.subtle,
              boxShadow: canSubmit ? '0 4px 20px rgba(59,130,246,0.4)' : 'none',
            }}
          >
            {['saving','generating'].includes(submitStatus) ? '⏳ Processing…' : '⬇ Submit & Download Invoice PDF'}
          </Button>
          {!signatureData && <p style={{ marginTop: '8px', fontSize: '12px', color: T.subtle }}>Add your signature in <a href="#provider-sign-off" style={{ color: T.brand, fontWeight: '600' }}>Provider Sign-Off</a> below to enable submission.</p>}
        </div>
      </div>
    </div>
  )
}
