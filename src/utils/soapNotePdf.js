import { addImageContain, applyPrintSettings, newLetterDocument, openPdfInNewTab } from './pdfGenerator.js'

/*
 * Layout coordinates are pixel positions measured on the Grounded Ventures Daily SOAP
 * Note scan. The form uses 0.5" margins (~135 px per inch); the scan crops 37 px above
 * the page's top margin, which Y() adds back.
 */
const S = 0.1879
const X = px => px * S
// TOP pushes the whole form down to make room for the Name / D.O.B row above the titles.
const TOP = 90
const Y = py => (py + 37 + TOP) * S

const PT_TO_MM = 25.4 / 72
const BLACK = [0, 0, 0]
const TITLE_GRAY = [128, 128, 128]
const BORDER = 0.35

const LEFT = 65
const SPLIT = 238
const RIGHT = 1079
// Last row (998–1123) is the Caregiver Signature row added below the therapist signature.
const ROWS = [172, 298, 427, 587, 714, 873, 998, 1123]
const LABEL_X = 80
const VALUE_X = 250
const LABEL_SIZE = 10.7
const BODY_SIZE = 10
const MIN_BODY_SIZE = 7
// Name / D.O.B header row, drawn above the titles (as on the paper form).
const HEAD_TOP = -62
const HEAD_BOTTOM = -12
const HEAD_COLS = [LEFT, 403, 741, RIGHT]

function setFont(doc, style = 'normal', size = LABEL_SIZE, color = BLACK) {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
  doc.setTextColor(...color)
}

function text(doc, str, xPx, yPx, { style = 'normal', size = LABEL_SIZE, color = BLACK, align = 'left' } = {}) {
  setFont(doc, style, size, color)
  doc.text(String(str), X(xPx), Y(yPx), { align, baseline: 'middle' })
}

function underlinedTitle(doc, str, yPx) {
  setFont(doc, 'bold', 11.8, TITLE_GRAY)
  const cx = 215.9 / 2
  const w = doc.getStringUnitWidth(str) * 11.8 * PT_TO_MM
  doc.text(str, cx, Y(yPx), { align: 'center', baseline: 'middle' })
  doc.setDrawColor(...TITLE_GRAY)
  doc.setLineWidth(0.25)
  doc.line(cx - w / 2, Y(yPx) + 2, cx + w / 2, Y(yPx) + 2)
}

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${m[2]}/${m[3]}/${m[1]}` : (iso || '')
}

function formatTime(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(value || '')
  if (!m) return value || ''
  const h24 = Number(m[1])
  return `${h24 % 12 || 12}:${m[2]} ${h24 >= 12 ? 'PM' : 'AM'}`
}

/**
 * Writes wrapped text inside a box, shrinking the font to fit. Returns lines that still
 * do not fit at the minimum size so they can go on a continuation page.
 */
function textBlock(doc, value, xPx, topPx, rightPx, bottomPx) {
  if (!value) return []
  const maxW = (rightPx - xPx) * S
  const maxH = (bottomPx - topPx) * S
  let size = BODY_SIZE
  let lines
  for (;;) {
    setFont(doc, 'normal', size)
    lines = doc.splitTextToSize(String(value), maxW)
    if (lines.length * size * PT_TO_MM * 1.2 <= maxH || size <= MIN_BODY_SIZE) break
    size -= 0.5
  }
  const lineH = size * PT_TO_MM * 1.2
  const fits = Math.max(0, Math.floor(maxH / lineH))
  doc.text(lines.slice(0, fits), X(xPx), Y(topPx), { baseline: 'top', lineHeightFactor: 1.2 })
  return lines.slice(fits)
}

function drawHeader(doc, note) {
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(BORDER)
  doc.rect(X(LEFT), Y(HEAD_TOP), (RIGHT - LEFT) * S, (HEAD_BOTTOM - HEAD_TOP) * S, 'S')
  HEAD_COLS.slice(1, -1).forEach(x => doc.line(X(x), Y(HEAD_TOP), X(x), Y(HEAD_BOTTOM)))
  const mid = (HEAD_TOP + HEAD_BOTTOM) / 2
  const cell = (label, value, x, right) => {
    setFont(doc, 'normal', LABEL_SIZE)
    const maxW = (right - x - 24) * S
    let str = `${label} ${value || ''}`
    while (str.length > label.length + 1 && doc.getTextWidth(str) > maxW) str = str.slice(0, -1)
    text(doc, str, x + 12, mid)
  }
  cell('Name:', note.childName, HEAD_COLS[0], HEAD_COLS[1])
  cell('D.O.B:', formatDate(note.dob), HEAD_COLS[1], HEAD_COLS[2])
}

function drawForm(doc) {
  underlinedTitle(doc, 'Grounded Ventures, LLC', 40)
  underlinedTitle(doc, 'DAILY SOAP NOTE', 70)

  doc.setDrawColor(...BLACK)
  doc.setLineWidth(BORDER)
  doc.rect(X(LEFT), Y(ROWS[0]), (RIGHT - LEFT) * S, (ROWS[ROWS.length - 1] - ROWS[0]) * S, 'S')
  doc.line(X(SPLIT), Y(ROWS[0]), X(SPLIT), Y(ROWS[ROWS.length - 1]))
  ROWS.slice(1, -1).forEach(y => doc.line(X(LEFT), Y(y), X(RIGHT), Y(y)))

  text(doc, 'DATE:', LABEL_X, 191, { style: 'bold' })
  text(doc, 'TIME IN/OUT', VALUE_X, 191)
  text(doc, 'SUBJECTIVE', LABEL_X, 319)
  text(doc, 'OBJECTIVE', LABEL_X, 446)
  text(doc, 'LOCATION:', 257, 446, { style: 'bold' })
  text(doc, 'ASSESSMENT', LABEL_X, 606)
  text(doc, 'PLAN', LABEL_X, 733)
  text(doc, 'Therapist', LABEL_X, 892)
  text(doc, 'Signature:', LABEL_X, 917)
  text(doc, 'Caregiver', LABEL_X, 1017)
  text(doc, 'Signature:', LABEL_X, 1042)
}

function drawContinuation(doc, overflow) {
  doc.addPage()
  underlinedTitle(doc, 'Grounded Ventures, LLC', 40)
  underlinedTitle(doc, 'DAILY SOAP NOTE (continued)', 70)
  let y = Y(140)
  for (const [label, lines] of overflow) {
    if (y > 260) { doc.addPage(); y = 20 }
    setFont(doc, 'bold', LABEL_SIZE)
    doc.text(`${label} (continued)`, X(LEFT), y)
    y += 6
    setFont(doc, 'normal', MIN_BODY_SIZE)
    for (const line of lines) {
      if (y > 268) { doc.addPage(); y = 20 }
      doc.text(line, X(LEFT), y)
      y += MIN_BODY_SIZE * PT_TO_MM * 1.2
    }
    y += 4
  }
}

/** @param {{ childName?: string }} note  @param {Array<{ date?: string }>} [pages] */
export function soapNoteFilename(note, pages = []) {
  const safeName = (note.childName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeDate = (pages[0]?.date || 'NoDate').replace(/[^a-zA-Z0-9_-]/g, '_')
  return `SOAP_Note_${safeName}_${safeDate}.pdf`
}

/**
 * Draws one SOAP page (one session) starting on the current PDF page. Text that does not
 * fit goes on continuation pages right after it.
 */
function drawSoapPage(doc, { note, page, therapist }) {
  drawHeader(doc, note)
  drawForm(doc)

  text(doc, formatDate(page.date), LABEL_X, 232, { size: BODY_SIZE })
  const times = [formatTime(page.timeIn), formatTime(page.timeOut)].filter(Boolean).join(' / ')
  if (times) {
    setFont(doc, 'normal', LABEL_SIZE)
    const labelW = doc.getStringUnitWidth('TIME IN/OUT') * LABEL_SIZE * PT_TO_MM
    text(doc, times, VALUE_X + labelW / S + 18, 191, { size: BODY_SIZE })
  }
  const therapistId = [therapist.name, therapist.title, therapist.license].filter(Boolean).join(' ')
  text(doc, `Therapist / License #:   / ${therapistId}`, VALUE_X, 253)

  if (page.location) {
    setFont(doc, 'bold', LABEL_SIZE)
    const labelW = doc.getStringUnitWidth('LOCATION:') * LABEL_SIZE * PT_TO_MM
    text(doc, page.location, 257 + labelW / S + 12, 446, { size: BODY_SIZE })
  }

  const overflow = [
    ['SUBJECTIVE', textBlock(doc, page.subjective, VALUE_X, ROWS[1] + 14, RIGHT - 15, ROWS[2] - 8)],
    ['OBJECTIVE', textBlock(doc, page.objective, VALUE_X, 470, RIGHT - 15, ROWS[3] - 8)],
    ['ASSESSMENT', textBlock(doc, page.assessment, VALUE_X, ROWS[3] + 14, RIGHT - 15, ROWS[4] - 8)],
    ['PLAN', textBlock(doc, page.plan, VALUE_X, ROWS[4] + 14, RIGHT - 15, ROWS[5] - 8)],
  ].filter(([, lines]) => lines.length)

  const sigW = (RIGHT - VALUE_X - 300) * S
  addImageContain(doc, page.signature, X(VALUE_X), Y(ROWS[5] + 12), sigW, (ROWS[6] - ROWS[5] - 24) * S)
  addImageContain(doc, page.caregiverSignature, X(VALUE_X), Y(ROWS[6] + 12), sigW, (ROWS[7] - ROWS[6] - 24) * S)

  if (overflow.length) drawContinuation(doc, overflow)
}

/**
 * Build the Daily SOAP Note PDF: one sheet per SOAP page, all sharing the child's
 * Name / D.O.B and the therapist.
 *
 * @param {{
 *   note: { childName?: string, dob?: string },
 *   pages: Array<{ date?: string, timeIn?: string, timeOut?: string, location?: string,
 *           subjective?: string, objective?: string, assessment?: string, plan?: string,
 *           signature?: string, caregiverSignature?: string }>,
 *   therapist: { name?: string, title?: string, license?: string },
 * }} params
 * @returns {import('jspdf').jsPDF}
 */
export function buildSoapNotePdfDocument({ note, pages, therapist }) {
  const doc = newLetterDocument()
  const list = pages?.length ? pages : [{}]
  list.forEach((page, i) => {
    if (i > 0) doc.addPage()
    drawSoapPage(doc, { note, page, therapist })
  })
  applyPrintSettings(doc, `Daily SOAP Note — ${formatDate(list[0].date) || 'Undated'}`)
  return doc
}

/** @param {Parameters<typeof buildSoapNotePdfDocument>[0] & { note: { childName?: string } }} params */
export function generateSoapNotePDF(params) {
  buildSoapNotePdfDocument(params).save(soapNoteFilename(params.note, params.pages))
}

/** @param {Parameters<typeof buildSoapNotePdfDocument>[0]} params */
export function openSoapNotePdfForPrint(params) {
  openPdfInNewTab(buildSoapNotePdfDocument(params), soapNoteFilename(params.note, params.pages))
}
