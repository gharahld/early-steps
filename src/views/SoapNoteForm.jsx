import { useEffect, useId, useState } from 'react'
import { useSoapNotes } from '../hooks/useSoapNotes.js'
import { SignaturePad } from '../components/SignaturePad.jsx'
import { buildSoapNotePdfDocument, openSoapNotePdfForPrint, soapNoteFilename } from '../utils/soapNotePdf.js'
import { Button, Badge, T } from '../components/ui/index.jsx'

const LOCATION_SUGGESTIONS = ['Home', 'Office', 'Daycare', 'Public Place', 'Telehealth']

const EMPTY_NOTE = {
  childName: '', date: '', timeIn: '', timeOut: '', location: '',
  subjective: '', objective: '', assessment: '', plan: '',
}

const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase', marginBottom: '5px' }
const controlStyle = { width: '100%', padding: '8px 10px', border: `1.5px solid ${T.border}`, borderRadius: '6px', fontSize: '13px', color: T.text, background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

function Field({ label, hint, children }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      {children(id)}
      {hint && <p style={{ margin: '4px 0 0', fontSize: '11px', color: T.subtle }}>{hint}</p>}
    </div>
  )
}

function noteFromStored(row) {
  return {
    childName:  row.child_name ?? '',
    date:       row.date ?? '',
    timeIn:     row.time_in ?? '',
    timeOut:    row.time_out ?? '',
    location:   row.location ?? '',
    subjective: row.subjective ?? '',
    objective:  row.objective ?? '',
    assessment: row.assessment ?? '',
    plan:       row.plan ?? '',
  }
}

export function SoapNoteForm({ initialData, profile, onBack }) {
  const { saveNote, fetchNoteById } = useSoapNotes()
  const [note, setNote]           = useState(EMPTY_NOTE)
  const [therapist, setTherapist] = useState(profile)
  const [signature, setSignature] = useState(null)
  const [noteId, setNoteId]       = useState(initialData?.id ?? null)
  const [loading, setLoading]     = useState(() => !!initialData?.id)
  const [status, setStatus]       = useState('idle') // idle | saved | downloaded | error
  const [error, setError]         = useState('')

  useEffect(() => {
    if (!initialData?.id) return undefined
    let cancelled = false
    fetchNoteById(initialData.id)
      .then(row => {
        if (cancelled) return
        if (!row) { setError('This SOAP note could not be found on this device.'); return }
        setNote(noteFromStored(row))
        setTherapist({ name: row.therapist_name ?? '', title: row.therapist_title ?? '', license: row.therapist_license ?? '' })
        setSignature(row.signature || null)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [initialData?.id, fetchNoteById])

  const set = (field, value) => setNote(n => ({ ...n, [field]: value }))
  const pdfParams = () => ({ note, therapist, signatureDataUrl: signature })
  const therapistLine = [therapist.name, therapist.title, therapist.license].filter(Boolean).join(' ')
  const save = async () => {
    setError('')
    try {
      const saved = await saveNote({ id: noteId, note, therapist, signature })
      setNoteId(saved.id)
      return true
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.')
      setStatus('error')
      return false
    }
  }

  const flash = (s) => { setStatus(s); setTimeout(() => setStatus('idle'), 3000) }

  const handleSave = async () => { if (await save()) flash('saved') }

  const handleDownload = async () => {
    if (!(await save())) return
    buildSoapNotePdfDocument(pdfParams()).save(soapNoteFilename(note))
    flash('downloaded')
  }

  const handlePrint = async () => {
    if (!(await save())) return
    openSoapNotePdfForPrint(pdfParams())
  }

  const card     = { background: T.card, borderRadius: '12px', border: `1px solid ${T.border}`, marginBottom: '18px', overflow: 'hidden' }
  const cardHead = { padding: '13px 22px', background: '#f8fafc', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }
  const secLabel = { fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: '#475569', textTransform: 'uppercase' }
  const title = initialData ? `SOAP Note — ${initialData.child_name || initialData.date || 'Untitled'}` : 'New SOAP Note'

  const textArea = (field, label, rows = 4) => (
    <Field label={label}>
      {id => <textarea id={id} rows={rows} value={note[field]} onChange={e => set(field, e.target.value)} style={{ ...controlStyle, resize: 'vertical', lineHeight: 1.5 }} />}
    </Field>
  )

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <div className="portal-invoice-topbar" style={{ background: T.navy, height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>← Back</button>
          <div style={{ width: '1px', height: '20px', background: '#1e293b', flexShrink: 0 }} />
          <span className="portal-invoice-topbar-title" style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{title}</span>
        </div>
        <div className="portal-invoice-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span role="status" aria-live="polite" style={{ display: 'contents' }}>
            {status === 'saved'      && <Badge color="green">✓ Saved</Badge>}
            {status === 'downloaded' && <Badge color="green">✓ PDF Downloaded</Badge>}
            {status === 'error'      && <Badge color="red">Save failed</Badge>}
          </span>
          <Button onClick={handleSave} variant="secondary" size="sm" disabled={loading}>Save</Button>
          <Button onClick={handleDownload} size="sm" disabled={loading}>⬇ Download PDF</Button>
          <Button onClick={handlePrint} variant="secondary" size="sm" disabled={loading}>Print PDF</Button>
        </div>
      </div>

      <div className="portal-invoice-content" style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 18px' }}>
        {error && (
          <div role="alert" style={{ marginBottom: '16px', padding: '12px 16px', background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, borderRadius: '8px', fontSize: '13px', color: T.danger }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ padding: '48px 0', textAlign: 'center', color: T.muted, fontSize: '14px' }}>Loading SOAP note…</p>
        ) : (
          <>
            <div style={card}>
              <div style={cardHead}><span style={secLabel}>Session</span></div>
              <div className="portal-patient-grid" style={{ padding: '22px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
                <div className="portal-fi" style={{ gridColumn: 'span 3' }}>
                  <Field label="Child" hint="For finding this note later — not printed on the SOAP note.">
                    {id => <input id={id} value={note.childName} onChange={e => set('childName', e.target.value)} placeholder="Child’s name" style={controlStyle} />}
                  </Field>
                </div>
                <Field label="Date">
                  {id => <input id={id} type="date" value={note.date} onChange={e => set('date', e.target.value)} style={controlStyle} />}
                </Field>
                <Field label="Time In">
                  {id => <input id={id} type="time" value={note.timeIn} onChange={e => set('timeIn', e.target.value)} style={controlStyle} />}
                </Field>
                <Field label="Time Out">
                  {id => <input id={id} type="time" value={note.timeOut} onChange={e => set('timeOut', e.target.value)} style={controlStyle} />}
                </Field>
              </div>
              <div style={{ padding: '12px 22px', borderTop: `1px solid ${T.border}`, fontSize: '12px', color: T.muted }}>
                <strong style={{ color: T.text }}>Therapist / License #:</strong> {therapistLine || 'Not set — add your name, title and license in Provider Profile on the home screen.'}
              </div>
            </div>

            <div style={card}>
              <div style={cardHead}><span style={secLabel}>SOAP</span></div>
              <div style={{ padding: '22px', display: 'grid', gap: '16px' }}>
                {textArea('subjective', 'Subjective')}
                <Field label="Location">
                  {id => (
                    <>
                      <input id={id} list="soap-location-options" value={note.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Home" style={controlStyle} />
                      <datalist id="soap-location-options">
                        {LOCATION_SUGGESTIONS.map(l => <option key={l} value={l} />)}
                      </datalist>
                    </>
                  )}
                </Field>
                {textArea('objective', 'Objective')}
                {textArea('assessment', 'Assessment')}
                {textArea('plan', 'Plan')}
              </div>
            </div>

            <div style={card}>
              <div style={cardHead}>
                <span style={secLabel}>Therapist Signature</span>
                {signature ? <Badge color="green">✓ Signed</Badge> : <Badge color="gray">Not signed</Badge>}
              </div>
              <div style={{ padding: '22px' }}>
                <p style={{ margin: '0 0 14px', fontSize: '13px', color: T.muted, lineHeight: 1.55 }}>
                  Optional — leave it blank to sign the printed copy by hand. Any field you leave empty prints blank.
                </p>
                <span id="soap-signature-label" style={labelStyle}>Therapist Signature</span>
                <SignaturePad value={signature} onSigned={setSignature} onClear={() => setSignature(null)} height={140} ariaLabelledby="soap-signature-label" />
              </div>
            </div>

            <div className="portal-invoice-footer" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', padding: '16px 0 32px' }}>
              <Button onClick={handleDownload} style={{ padding: '14px 32px', fontSize: '15px' }}>⬇ Download SOAP Note PDF</Button>
              <Button onClick={handlePrint} variant="secondary" style={{ padding: '14px 28px', fontSize: '15px' }}>Print SOAP Note</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
