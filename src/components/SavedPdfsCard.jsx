import { useState } from 'react'
import { useSavedPdfs } from '../hooks/useSavedPdfs.js'
import { downloadBlob, openBlobInNewTab, sharePdf } from '../utils/pdfActions.js'
import { Badge, Button, Card, CardHeader, T } from './ui/index.jsx'

const KIND_LABELS = { invoice: 'Invoice', soap: 'SOAP Note' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const thStyle = {
  padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', letterSpacing: '0.07em',
  color: T.muted, textTransform: 'uppercase', borderBottom: `1px solid ${T.border}`,
}
const tdStyle = { padding: '12px 16px', color: T.muted }

function formatPeriod(period) {
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(period || '')
  if (day) return `${day[2]}/${day[3]}/${day[1]}`
  const month = /^(\d{4})-(\d{2})$/.exec(period || '')
  if (month) return `${MONTHS[Number(month[2]) - 1]} ${month[1]}`
  return '—'
}

/** Saved PDF files with Print, Share (device share sheet), Download and Delete. */
export function SavedPdfsCard() {
  const { pdfs, loading, error, deletePdf } = useSavedPdfs()
  const [notice, setNotice] = useState('')

  const share = async (pdf) => {
    const result = await sharePdf(pdf.blob, pdf.filename, pdf.filename)
    setNotice(result === 'downloaded'
      ? 'Sharing isn\u2019t available in this browser, so the PDF was downloaded instead — attach it to an email from your Downloads.'
      : '')
  }

  const remove = async (pdf) => {
    if (!window.confirm(`Delete the saved PDF "${pdf.filename}"? The form itself stays saved.`)) return
    try {
      await deletePdf(pdf.id)
      setNotice('')
    } catch (err) {
      setNotice(err.message)
    }
  }

  return (
    <Card style={{ marginBottom: '16px' }}>
      <CardHeader right={<span style={{ fontSize: '12px', color: T.muted }}>{pdfs.length} saved</span>}>
        Saved PDFs
      </CardHeader>
      <p role="status" aria-live="polite" style={{ margin: 0, padding: notice ? '10px 22px' : 0, fontSize: '12px', color: T.warning, background: notice ? T.warningBg : 'transparent' }}>
        {notice}
      </p>
      <div className="portal-table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Form', 'Child', 'Month / Date', 'Saved', ''].map(h => <th key={h} scope="col" style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: T.muted }}>Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={5} style={{ padding: '20px 22px', background: T.dangerBg, color: T.danger }}>{error}</td></tr>
            ) : pdfs.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: T.subtle }}>
                No saved PDFs yet. Open an invoice or SOAP note and click <strong>Save as PDF</strong>.
              </td></tr>
            ) : pdfs.map(pdf => (
              <tr key={pdf.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={tdStyle}><Badge color={pdf.kind === 'invoice' ? 'blue' : 'gray'}>{KIND_LABELS[pdf.kind] ?? pdf.kind}</Badge></td>
                <td style={{ ...tdStyle, fontWeight: '600', color: T.text }}>{pdf.title}</td>
                <td style={tdStyle}>{formatPeriod(pdf.period)}</td>
                <td style={tdStyle}>{new Date(pdf.saved_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Button onClick={() => openBlobInNewTab(pdf.blob, pdf.filename)} variant="secondary" size="sm">Print</Button>
                    <Button onClick={() => share(pdf)} size="sm">Share / Email</Button>
                    <Button onClick={() => downloadBlob(pdf.blob, pdf.filename)} variant="secondary" size="sm">Download</Button>
                    <Button onClick={() => remove(pdf)} variant="danger" size="sm">Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
