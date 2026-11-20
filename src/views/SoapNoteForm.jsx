import { useEffect, useId, useState } from 'react'
import { useSoapNotes } from '../hooks/useSoapNotes.js'
import { useSavedPdfs } from '../hooks/useSavedPdfs.js'
import { SignaturePad } from '../components/SignaturePad.jsx'
import { buildSoapNotePdfDocument, openSoapNotePdfForPrint, soapNoteFilename } from '../utils/soapNotePdf.js'
import { Button, Badge, T } from '../components/ui/index.jsx'

const LOCATION_SUGGESTIONS = ['Home', 'Office', 'Daycare', 'Public Place', 'Telehealth']

const EMPTY_NOTE = { childName: '', dob: '' }

let pageKeySeq = 0
/** One SOAP page = one session. `key` is only for React and is not saved. */
const emptyPage = (fields = {}) => ({
  key: `p${++pageKeySeq}`,
  date: '', timeIn: '', timeOut: '', location: '',
  subjective: '', objective: '', assessment: '', plan: '',
  signature: null, caregiverSignature: null,
  ...fields,
})

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
  return { childName: row.child_name ?? '', dob: row.dob ?? '' }
}

/** Notes saved before multi-page support have a single page in their top-level fields. */
function pagesFromStored(row) {
  if (Array.isArray(row.pages) && row.pages.length) return row.pages.map(p => emptyPage(p))
  return [emptyPage({
    date:       row.date ?? '',
    timeIn:     row.time_in ?? '',
    timeOut:    row.time_out ?? '',
    location:   row.location ?? '',
    subjective: row.subjective ?? '',
    objective:  row.objective ?? '',
    assessment: row.assessment ?? '',
    plan:       row.plan ?? '',
    signature:  row.signature || null,
  })]
}

export function SoapNoteForm({ initialData, profile, onSaveProfile, onBack }) {
  const { saveNote, fetchNoteById } = useSoapNotes()
  const { savePdf } = useSavedPdfs({ load: false })
  const [note, setNote]           = useState(EMPTY_NOTE)
  const [therapist, setTherapist] = useState(profile)
  const [pages, setPages]         = useState(() => [emptyPage()])
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
        // Notes saved before a Provider Profile existed have no therapist — fill from the profile.
        const stored = { name: row.therapist_name ?? '', title: row.therapist_title ?? '', license: row.therapist_license ?? '' }
        setTherapist(stored.name || stored.title || stored.license ? stored : profile)
        setPages(pagesFromStored(row))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [initialData?.id, fetchNoteById]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field, value) => setNote(n => ({ ...n, [field]: value }))
  const setPage = (i, field, value) => setPages(ps => ps.map((p, j) => (j === i ? { ...p, [field]: value } : p)))
  const addPage = () => setPages(ps => [...ps, emptyPage()])
  const removePage = (i) => {
    const p = pages[i]
    const hasContent = ['date', 'timeIn', 'timeOut', 'location', 'subjective', 'objective', 'assessment', 'plan', 'signature', 'caregiverSignature'].some(f => p[f])
    if (hasContent && !window.confirm(`Remove SOAP page ${i + 1}? What you typed on it will be lost.`)) return
    setPages(ps => ps.filter((_, j) => j !== i))
  }
  const pdfParams = () => ({ note, pages, therapist })
  const setT = (field, value) => setTherapist(t => ({ ...t, [field]: value }))
  /** Saves the note; returns its id, or null on failure. */
  const save = async () => {
    setError('')
    try {
      const saved = await saveNote({ id: noteId, note, pages, therapist })
      setNoteId(saved.id)
      // First time the therapist is typed here: remember it so every new note fills it in.
      const profileEmpty = !profile.name && !profile.title && !profile.license
      if (profileEmpty && (therapist.name || therapist.title || therapist.license)) onSaveProfile?.(therapist)
      return saved.id
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.')
      setStatus('error')
      return null
    }
  }

  const flash = (s) => { setStatus(s); setTimeout(() => setStatus('idle'), 3000) }

  const handleSave = async () => { if (await save()) flash('saved') }

  const handleSavePdf = async () => {
    const id = await save()
    if (!id) return
    try {
      await savePdf({
        kind: 'soap', formId: id,
        title: note.childName || 'Unnamed child', period: pages[0]?.date || '',
        filename: soapNoteFilename(note, pages), blob: buildSoapNotePdfDocument(pdfParams()).output('blob'),
      })
      flash('pdf-saved')
    } catch (err) {
      setError(err.message || 'Could not save the PDF.')
      setStatus('error')
    }
  }

  const handleDownload = async () => {
    if (!(await save())) return
    buildSoapNotePdfDocument(pdfParams()).save(soapNoteFilename(note, pages))
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

  const textArea = (i, field, label, rows = 4) => (
    <Field label={label}>
      {id => <textarea id={id} rows={rows} value={pages[i][field]} onChange={e => setPage(i, field, e.target.value)} style={{ ...controlStyle, resize: 'vertical', lineHeight: 1.5 }} />}
    </Field>
  )

  const signatureBlock = (i, field, label) => {
    const labelId = `soap-${field}-${pages[i].key}`
    const value = pages[i][field]
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '5px' }}>
          <span id={labelId} style={{ ...labelStyle, marginBottom: 0 }}>{label}</span>
          {value ? <Badge color="green">✓ Signed</Badge> : <Badge color="gray">Not signed</Badge>}
        </div>
        <SignaturePad value={value} onSigned={v => setPage(i, field, v)} onClear={() => setPage(i, field, null)} height={120} ariaLabelledby={labelId} />
      </div>
    )
  }

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
            {status === 'pdf-saved'  && <Badge color="green">✓ Added to Saved PDFs</Badge>}
            {status === 'error'      && <Badge color="red">Save failed</Badge>}
          </span>
          <Button onClick={handleSave} variant="secondary" size="sm" disabled={loading}>Save</Button>
          <Button onClick={handleSavePdf} size="sm" disabled={loading}>Save as PDF</Button>
          <Button onClick={handleDownload} variant="secondary" size="sm" disabled={loading}>⬇ Download PDF</Button>
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
              <div style={cardHead}><span style={secLabel}>Child &amp; Therapist</span></div>
              <div className="portal-patient-grid" style={{ padding: '22px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
                <div className="portal-fi" style={{ gridColumn: 'span 2' }}>
                  <Field label="Child">
                    {id => <input id={id} value={note.childName} onChange={e => set('childName', e.target.value)} placeholder="Child’s name" style={controlStyle} />}
                  </Field>
                </div>
                <Field label="D.O.B">
                  {id => <input id={id} type="date" value={note.dob} onChange={e => set('dob', e.target.value)} style={controlStyle} />}
                </Field>
              </div>
              <div style={{ padding: '16px 22px 20px', borderTop: `1px solid ${T.border}` }}>
                <div className="portal-patient-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px' }}>
                  <Field label="Therapist">
                    {id => <input id={id} value={therapist.name} onChange={e => setT('name', e.target.value)} placeholder="e.g. Aleiah Bruno" style={controlStyle} />}
                  </Field>
                  <Field label="Title">
                    {id => <input id={id} value={therapist.title} onChange={e => setT('title', e.target.value)} placeholder="e.g. PTA" style={controlStyle} />}
                  </Field>
                  <Field label="License #">
                    {id => <input id={id} value={therapist.license} onChange={e => setT('license', e.target.value)} placeholder="e.g. 22266" style={controlStyle} />}
                  </Field>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: T.subtle }}>
                  Filled in automatically from your Provider Profile on the home screen. Name, D.O.B and therapist print on every SOAP page.
                </p>
              </div>
            </div>

            <datalist id="soap-location-options">
              {LOCATION_SUGGESTIONS.map(l => <option key={l} value={l} />)}
            </datalist>

            {pages.map((page, i) => (
              <div key={page.key} style={card}>
                <div style={cardHead}>
                  <span style={secLabel}>SOAP Page {i + 1}{pages.length > 1 ? ` of ${pages.length}` : ''}</span>
                  {pages.length > 1 && <Button onClick={() => removePage(i)} variant="danger" size="sm">Remove page</Button>}
                </div>
                <div style={{ padding: '22px', display: 'grid', gap: '16px' }}>
                  <div className="portal-patient-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
                    <Field label="Date">
                      {id => <input id={id} type="date" value={page.date} onChange={e => setPage(i, 'date', e.target.value)} style={controlStyle} />}
                    </Field>
                    <Field label="Time In">
                      {id => <input id={id} type="time" value={page.timeIn} onChange={e => setPage(i, 'timeIn', e.target.value)} style={controlStyle} />}
                    </Field>
                    <Field label="Time Out">
                      {id => <input id={id} type="time" value={page.timeOut} onChange={e => setPage(i, 'timeOut', e.target.value)} style={controlStyle} />}
                    </Field>
                  </div>
                  {textArea(i, 'subjective', 'Subjective')}
                  <Field label="Location">
                    {id => <input id={id} list="soap-location-options" value={page.location} onChange={e => setPage(i, 'location', e.target.value)} placeholder="e.g. Home" style={controlStyle} />}
                  </Field>
                  {textArea(i, 'objective', 'Objective')}
                  {textArea(i, 'assessment', 'Assessment')}
                  {textArea(i, 'plan', 'Plan')}
                  <p style={{ margin: 0, fontSize: '13px', color: T.muted, lineHeight: 1.55 }}>
                    Signatures are optional — leave them blank to sign the printed copy by hand. Any field you leave empty prints blank.
                  </p>
                  {signatureBlock(i, 'signature', 'Therapist Signature')}
                  {signatureBlock(i, 'caregiverSignature', 'Caregiver Signature')}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <Button onClick={addPage} variant="secondary" style={{ padding: '12px 24px', fontSize: '14px' }}>+ Add another SOAP page</Button>
            </div>

            <div className="portal-invoice-footer" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', padding: '16px 0 32px' }}>
              <Button onClick={handleSavePdf} style={{ padding: '14px 32px', fontSize: '15px' }}>Save as PDF</Button>
              <Button onClick={handleDownload} variant="secondary" style={{ padding: '14px 32px', fontSize: '15px' }}>⬇ Download SOAP Note PDF</Button>
              <Button onClick={handlePrint} variant="secondary" style={{ padding: '14px 28px', fontSize: '15px' }}>Print SOAP Note</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
