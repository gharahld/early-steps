import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useInvoices } from '../hooks/useInvoices.js'
import { SignaturePad } from '../components/SignaturePad.jsx'
import { buildInvoicePdfDocument, invoicePdfFilename, isEntryFilled, openInvoicePdfForPrint } from '../utils/pdfGenerator.js'
import { Button, Badge, T } from '../components/ui/index.jsx'

const PROCEDURE_CODES = ['', 'PHY', 'OCCT', 'SPL', 'PSTH', 'OCTH', 'SPCH', 'COIFF', 'CONS']
const LOCATION_CODES  = [
  { code: '1',  label: '1 – Home' },
  { code: 'A',  label: 'A – Office' },
  { code: '5',  label: '5 – Daycare' },
  { code: 'P',  label: 'P – Public Place' },
  { code: 'GT', label: 'GT – Telehealth' },
]
/** Rows that fit on one printed V2024 page; more rows continue on another page. */
const ROWS_PER_PRINTED_PAGE = 8

const EMPTY_ENTRY = () => ({
  id: crypto.randomUUID(),
  dateOfService: '', procedureCode: '', renderingProvider: '', locationCode: '1',
  arrivalTime: '', departureTime: '', travelMinutes: '', caregiverSignature: '',
})

const isImage = v => typeof v === 'string' && v.startsWith('data:image/')

function FI({ label, value, onChange, type = 'text', placeholder, span = 1 }) {
  const id = useId()
  return (
    <div className="portal-fi" style={{ gridColumn: `span ${span}` }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase', marginBottom: '5px' }}>{label}</label>
      <input id={id} type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', border: `1.5px solid ${T.border}`, borderRadius: '6px', fontSize: '13px', color: T.text, background: '#fff', outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )
}

const defaultHeader = (seed = {}, profile = {}) => ({
  childName:           seed.child_name ?? '',
  dob:                 seed.dob ? String(seed.dob).slice(0, 10) : '',
  caregiver:           seed.caregiver ?? '',
  address:             seed.address ?? '',
  cell:                seed.cell ?? '',
  esds:                seed.esds ?? '',
  serviceCoordinator:  seed.service_coordinator ?? '',
  cons:                seed.cons ?? '',
  medicaidNumber:      seed.medicaid_number ?? '',
  frequency:           seed.frequency ?? '',
  billingMonth:        seed.billing_month ?? '',
  provider:            seed.provider_name ?? profile.name ?? '',
  providerTitle:       seed.provider_title ?? profile.title ?? '',
  providerAttestation: seed.provider_attestation ?? profile.name ?? '',
})

function mapStoredEntriesToForm(rows) {
  const sorted = [...(rows || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return sorted.map(se => ({
    id: se.id,
    dateOfService:      se.date_of_service ? String(se.date_of_service).slice(0, 10) : '',
    procedureCode:      se.procedure_code ?? '',
    renderingProvider:  se.rendering_provider ?? '',
    locationCode:       se.location_code ?? '1',
    arrivalTime:        se.arrival_time ?? '',
    departureTime:      se.departure_time ?? '',
    travelMinutes:      se.travel_minutes != null ? String(se.travel_minutes) : '',
    caregiverSignature: se.caregiver_signature ?? '',
  }))
}

export function InvoiceForm({ initialData, profile, onBack }) {
  const { saveInvoice, fetchInvoiceById } = useInvoices()

  const [submitStatus,  setSubmitStatus]  = useState('idle') // idle | saving | generating | done | saved | error
  const [saveError,     setSaveError]     = useState('')
  const [detailLoading, setDetailLoading] = useState(() => !!initialData?.id)
  const [detailError,   setDetailError]   = useState('')
  const [invoiceId,     setInvoiceId]     = useState(initialData?.id ?? null)
  const [storedStatus,  setStoredStatus]  = useState(initialData?.status ?? 'draft')
  const [providerSignature, setProviderSignature] = useState(null)
  const [signingRowId,  setSigningRowId]  = useState(null)
  const signPanelHeading = useRef(null)

  const [header, setHeader] = useState(() => defaultHeader({}, profile))
  const [entries, setEntries] = useState([EMPTY_ENTRY(), EMPTY_ENTRY(), EMPTY_ENTRY()])

  useEffect(() => {
    if (!initialData?.id) return undefined
    let cancelled = false
    setDetailLoading(true)
    setDetailError('')
    fetchInvoiceById(initialData.id)
      .then(row => {
        if (cancelled) return
        if (!row) { setDetailError('This invoice could not be found on this device.'); return }
        setHeader(defaultHeader(row))
        const mapped = mapStoredEntriesToForm(row.service_entries)
        setEntries(mapped.length ? mapped : [EMPTY_ENTRY(), EMPTY_ENTRY(), EMPTY_ENTRY()])
        setProviderSignature(row.provider_signature || null)
        setStoredStatus(row.status || 'draft')
      })
      .catch(err => {
        if (!cancelled) setDetailError(err.message || 'Could not load this invoice.')
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => { cancelled = true }
  }, [initialData?.id, fetchInvoiceById])

  useEffect(() => {
    if (signingRowId) signPanelHeading.current?.focus()
  }, [signingRowId])

  const setH = useCallback((f, v) => setHeader(h => ({ ...h, [f]: v })), [])
  const setE = useCallback((id, f, v) => setEntries(p => p.map(e => e.id === id ? { ...e, [f]: v } : e)), [])
  const addEntry    = () => setEntries(p => [...p, EMPTY_ENTRY()])
  const removeEntry = id => {
    setEntries(p => p.filter(e => e.id !== id))
    if (signingRowId === id) setSigningRowId(null)
  }
  const closeSignPanel = () => {
    const id = signingRowId
    setSigningRowId(null)
    requestAnimationFrame(() => document.getElementById(`caregiver-sign-${id}`)?.focus())
  }

  const busy        = ['saving', 'generating'].includes(submitStatus)
  const filledCount = entries.filter(isEntryFilled).length
  const pdfParams   = () => ({ header, entries, signatureDataUrl: providerSignature })
  const signingIndex = entries.findIndex(e => e.id === signingRowId)

  /** Saves, then optionally downloads or prints. Blank fields simply print blank. */
  const handleSave = async (status, output = null) => {
    setSaveError('')
    setSubmitStatus('saving')
    try {
      const saved = await saveInvoice({ id: invoiceId, header, entries, providerSignature, status })
      setInvoiceId(saved.id)
      setStoredStatus(status)
      if (output === 'download') {
        setSubmitStatus('generating')
        buildInvoicePdfDocument(pdfParams()).save(invoicePdfFilename(header))
        setSubmitStatus('done')
      } else if (output === 'print') {
        openInvoicePdfForPrint(pdfParams())
        setSubmitStatus('saved')
      } else {
        setSubmitStatus('saved')
      }
      setTimeout(() => setSubmitStatus('idle'), 3000)
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.')
      setSubmitStatus('error')
    }
  }

  const card     = { background: T.card, borderRadius: '12px', border: `1px solid ${T.border}`, marginBottom: '18px', overflow: 'hidden' }
  const cardHead = { padding: '13px 22px', background: '#f8fafc', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
  const secLabel = { fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: '#475569', textTransform: 'uppercase' }
  const cellStyle = { padding: '4px 6px' }
  const smallLabel = { display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase', marginBottom: '5px' }
  const title = initialData ? `Invoice — ${initialData.child_name || 'Untitled'}` : 'New Invoice'

  const topBar = (actions) => (
    <div className="portal-invoice-topbar" style={{ background: T.navy, height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>← Back</button>
        <div style={{ width: '1px', height: '20px', background: '#1e293b', flexShrink: 0 }} />
        <span className="portal-invoice-topbar-title" style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{title}</span>
      </div>
      {actions}
    </div>
  )

  if (initialData?.id && (detailLoading || detailError)) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg }}>
        {topBar(null)}
        {detailError ? (
          <div className="portal-invoice-content" role="alert" style={{ maxWidth: '560px', margin: '28px auto', padding: '20px 22px', background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, borderRadius: '8px', fontSize: '14px', color: T.danger }}>
            <p style={{ margin: '0 0 14px', lineHeight: 1.5 }}>{detailError}</p>
            <Button onClick={onBack} variant="secondary" size="sm">Back to list</Button>
          </div>
        ) : (
          <div className="portal-invoice-content" style={{ padding: '48px 24px', textAlign: 'center', color: T.muted, fontSize: '14px' }}>Loading invoice…</div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      {topBar(
        <div className="portal-invoice-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span role="status" aria-live="polite" style={{ display: 'contents' }}>
            {submitStatus === 'done'  && <Badge color="green">✓ PDF Downloaded</Badge>}
            {submitStatus === 'saved' && <Badge color="green">✓ Saved</Badge>}
            {submitStatus === 'error' && <Badge color="red">Save failed</Badge>}
          </span>
          <Button onClick={() => handleSave(storedStatus)} variant="secondary" size="sm" disabled={busy}>
            {storedStatus === 'submitted' ? 'Save' : 'Save Draft'}
          </Button>
          <Button onClick={() => handleSave(storedStatus, 'download')} size="sm" disabled={busy}>
            {submitStatus === 'generating' ? 'Generating…' : submitStatus === 'saving' ? 'Saving…' : '⬇ Download PDF'}
          </Button>
          <Button onClick={() => handleSave(storedStatus, 'print')} variant="secondary" size="sm" disabled={busy}>
            Print PDF
          </Button>
        </div>,
      )}

      <div className="portal-invoice-content" style={{ maxWidth: '1060px', margin: '0 auto', padding: '24px 18px' }}>

        {saveError && (
          <div role="alert" style={{ marginBottom: '16px', padding: '12px 16px', background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, borderRadius: '8px', fontSize: '13px', color: T.danger }}>
            {saveError}
          </div>
        )}

        {/* ── Child & billing ───────────────────────────────────────────────── */}
        <div style={card}>
          <div style={cardHead}><span style={secLabel}>Child &amp; Billing Information</span></div>
          <div className="portal-patient-grid" style={{ padding: '22px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
            <FI label="Child’s Name"        value={header.childName}          onChange={v => setH('childName', v)}          placeholder="Full name" />
            <FI label="DOB"                 value={header.dob}                onChange={v => setH('dob', v)}                type="date" />
            <FI label="Caregiver"           value={header.caregiver}          onChange={v => setH('caregiver', v)}          placeholder="Caregiver name" />
            <FI label="Address"             value={header.address}            onChange={v => setH('address', v)}            placeholder="Street address" />
            <FI label="Cell #"              value={header.cell}               onChange={v => setH('cell', v)}               placeholder="(555) 000-0000" />
            <FI label="ESDS #"              value={header.esds}               onChange={v => setH('esds', v)}               placeholder="ESDS number" />
            <FI label="Service Coordinator" value={header.serviceCoordinator} onChange={v => setH('serviceCoordinator', v)} placeholder="Coordinator name" />
            <FI label="Cons"                value={header.cons}               onChange={v => setH('cons', v)} />
            <FI label="Medicaid #"          value={header.medicaidNumber}     onChange={v => setH('medicaidNumber', v)}     placeholder="Medicaid number" />
            <FI label="Frequency"           value={header.frequency}          onChange={v => setH('frequency', v)}          placeholder="e.g. 60mpw" />
            <FI label="Billing Month / Year" value={header.billingMonth}      onChange={v => setH('billingMonth', v)}       type="month" />
            <FI label="Provider"            value={header.provider}           onChange={v => setH('provider', v)}           placeholder="Provider name" />
            <FI label="Provider Title"      value={header.providerTitle}      onChange={v => setH('providerTitle', v)}      placeholder="e.g. PTA" />
          </div>
          <div className="portal-attest-strip" style={{ padding: '12px 22px', background: T.warningBg, borderTop: `1px solid ${T.warningBorder}`, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#92400e' }}>
              I, <strong>{header.providerAttestation || '_______________'}</strong>, attest that I have provided the services below.
            </span>
            <input className="portal-attest-input" aria-label="Provider name for attestation" value={header.providerAttestation} onChange={e => setH('providerAttestation', e.target.value)}
              placeholder="Print provider name"
              style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: '6px', border: `1.5px solid ${T.warningBorder}`, fontSize: '12px', width: '210px', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* ── Service entries ───────────────────────────────────────────────── */}
        <div style={card}>
          <div className="portal-entries-card-head" style={cardHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={secLabel}>Service Entries</span>
              <Badge color="blue">{filledCount} logged</Badge>
            </div>
            <Button onClick={addEntry} variant="secondary" size="sm">+ Add Row</Button>
          </div>
          <div style={{ padding: '8px 22px', background: '#f8fafc', borderBottom: `1px solid ${T.border}`, fontSize: '11px', color: T.muted, lineHeight: 1.6 }}>
            <strong>Procedure:</strong> Session = PHY, OCCT, SPL · Evaluation = PSTH, OCTH, SPCH · Meeting = COIFF · Consultation = CONS &nbsp;|&nbsp;
            <strong>Location:</strong> 1 Home · A Office · 5 Daycare · P Public Place · GT Telehealth
            {filledCount > ROWS_PER_PRINTED_PAGE && <> &nbsp;|&nbsp; Visits after the {ROWS_PER_PRINTED_PAGE}th print on an additional page.</>}
          </div>
          <div className="portal-entries-scroll" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead><tr style={{ background: '#f8fafc' }}>
                {['#', 'Date of Service', 'Procedure', 'Rendering Provider', 'Location', 'Arrival', 'Departure', 'Travel min', 'Caregiver Signature', ''].map((h, i) => (
                  <th key={i} scope="col" style={{ padding: '9px 8px', textAlign: 'left', fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', color: T.muted, textTransform: 'uppercase', borderBottom: `2px solid ${T.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {entries.map((e, idx) => {
                  const rowLabel = `row ${idx + 1}`
                  const inp = (val, field, label, type = 'text', pw) => (
                    <input type={type} value={val} placeholder={pw} aria-label={`${label}, ${rowLabel}`} onChange={ev => setE(e.id, field, ev.target.value)}
                      style={{ width: '100%', padding: '7px 8px', border: `1.5px solid ${T.border}`, borderRadius: '6px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  )
                  const sel = (val, field, label, opts) => (
                    <select value={val} aria-label={`${label}, ${rowLabel}`} onChange={ev => setE(e.id, field, ev.target.value)}
                      style={{ width: '100%', padding: '7px 8px', border: `1.5px solid ${T.border}`, borderRadius: '6px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                      {opts.map(o => typeof o === 'string' ? <option key={o} value={o}>{o || '—'}</option> : <option key={o.code} value={o.code}>{o.label}</option>)}
                    </select>
                  )
                  const sig = e.caregiverSignature
                  return (
                    <tr key={e.id} style={{ borderBottom: `1px solid #f1f5f9`, background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ ...cellStyle, color: T.subtle, fontWeight: '700', textAlign: 'center', fontSize: '11px' }}>{idx + 1}</td>
                      <td style={{ ...cellStyle, minWidth: '126px' }}>{inp(e.dateOfService, 'dateOfService', 'Date of service', 'date')}</td>
                      <td style={{ ...cellStyle, minWidth: '96px' }}>{sel(e.procedureCode, 'procedureCode', 'Procedure', PROCEDURE_CODES)}</td>
                      <td style={{ ...cellStyle, minWidth: '140px' }}>{inp(e.renderingProvider, 'renderingProvider', 'Rendering provider', 'text', 'Provider')}</td>
                      <td style={{ ...cellStyle, minWidth: '130px' }}>{sel(e.locationCode, 'locationCode', 'Location', LOCATION_CODES)}</td>
                      <td style={{ ...cellStyle, minWidth: '84px' }}>{inp(e.arrivalTime, 'arrivalTime', 'Arrival time', 'time')}</td>
                      <td style={{ ...cellStyle, minWidth: '84px' }}>{inp(e.departureTime, 'departureTime', 'Departure time', 'time')}</td>
                      <td style={{ ...cellStyle, minWidth: '68px' }}>{inp(e.travelMinutes, 'travelMinutes', 'Travel minutes', 'number', '0')}</td>
                      <td style={{ ...cellStyle, minWidth: '150px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- in-browser data URL; next/image cannot optimize it */}
                          {isImage(sig) && <img src={sig} alt={`Caregiver signature, ${rowLabel}`} style={{ height: '28px', maxWidth: '90px', objectFit: 'contain' }} />}
                          {sig && !isImage(sig) && <span style={{ fontSize: '12px' }}>{sig}</span>}
                          <button id={`caregiver-sign-${e.id}`} type="button" onClick={() => setSigningRowId(e.id)}
                            aria-label={`${sig ? 'Re-sign' : 'Sign'} caregiver signature, ${rowLabel}`}
                            style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', background: '#fff', color: T.brand, border: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>
                            {sig ? 'Re-sign' : 'Sign'}
                          </button>
                        </div>
                      </td>
                      <td style={cellStyle}>
                        <button type="button" onClick={() => removeEntry(e.id)} aria-label={`Remove ${rowLabel}`}
                          style={{ width: '26px', height: '26px', borderRadius: '6px', background: T.dangerBg, color: T.danger, border: `1px solid ${T.dangerBorder}`, cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {signingIndex >= 0 && (
            <section aria-labelledby="caregiver-sign-heading" style={{ padding: '18px 22px', borderTop: `1px solid ${T.border}`, background: '#f8fafc' }}>
              <h2 id="caregiver-sign-heading" ref={signPanelHeading} tabIndex={-1} style={{ fontSize: '13px', fontWeight: '700', color: T.text, margin: '0 0 10px', outline: 'none' }}>
                Caregiver signature — row {signingIndex + 1}{entries[signingIndex].dateOfService ? ` (${entries[signingIndex].dateOfService})` : ''}
              </h2>
              <div style={{ maxWidth: '520px' }}>
                <SignaturePad
                  key={signingRowId}
                  value={isImage(entries[signingIndex].caregiverSignature) ? entries[signingIndex].caregiverSignature : null}
                  onSigned={url => setE(signingRowId, 'caregiverSignature', url)}
                  onClear={() => setE(signingRowId, 'caregiverSignature', '')}
                  height={120}
                  ariaLabelledby="caregiver-sign-heading"
                />
              </div>
              <Button onClick={closeSignPanel} size="sm" style={{ marginTop: '12px' }}>Done</Button>
            </section>
          )}
        </div>

        {/* ── Provider sign-off ─────────────────────────────────────────────── */}
        <div id="provider-sign-off" style={{ ...card, scrollMarginTop: '72px' }}>
          <div style={cardHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={secLabel}>Provider Sign-Off</span>
              {providerSignature
                ? <Badge color="green">✓ Signed</Badge>
                : <Badge color="gray">Not signed</Badge>}
            </div>
          </div>
          <div style={{ padding: '22px' }}>
            <p style={{ fontSize: '13px', color: T.muted, margin: '0 0 20px', lineHeight: 1.55, maxWidth: '52rem' }}>
              Optional — your signature is saved with this invoice and printed on the attestation line.
              Leave it blank to sign the printed copy by hand. Any field you leave empty prints blank.
            </p>
            <span id="invoice-provider-signature-label" style={smallLabel}>Signature of Provider</span>
            <SignaturePad value={providerSignature} onSigned={setProviderSignature} onClear={() => setProviderSignature(null)} height={152} ariaLabelledby="invoice-provider-signature-label" />
          </div>
        </div>

        {/* ── Bottom actions ────────────────────────────────────────────────── */}
        <div className="portal-invoice-footer" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', padding: '16px 0 32px' }}>
          <Button
            onClick={() => handleSave('submitted', 'download')}
            disabled={busy}
            style={{
              padding: '14px 36px', fontSize: '15px',
              background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
              boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
            }}
          >
            {busy ? '⏳ Processing…' : '⬇ Submit & Download Invoice PDF'}
          </Button>
          <Button onClick={() => handleSave(storedStatus, 'print')} variant="secondary" disabled={busy} style={{ padding: '14px 28px', fontSize: '15px' }}>
            Print Invoice
          </Button>
        </div>
      </div>
    </div>
  )
}
