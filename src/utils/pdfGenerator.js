import jsPDF from 'jspdf'

/*
 * Layout coordinates are pixel positions measured on the V2024 Broward Early Steps
 * Monthly Service Log/Invoice (784×1024 px scan), mapped onto US Letter with one
 * uniform scale so every line, box and label keeps the form's proportions.
 */
const S = 0.2605
const OX = 3.5
const OY = 7.7
const X = px => OX + px * S
const Y = py => OY + py * S

const PT_TO_MM = 25.4 / 72
const BLACK = [0, 0, 0]
const TITLE_GRAY = [118, 118, 118]
const HEADER_FILL = [231, 230, 230]
const HIGHLIGHT = [255, 255, 0]
const LINE_THIN = 0.26
const LINE_THICK = 0.5

const ROWS_PER_PAGE = 8
const ENTRY_COLS = [58, 101, 173, 264, 326, 390, 470, 532, 778]
const ENTRY_TOP = 225
const ENTRY_HEAD_BOTTOM = 270
const ENTRY_BOTTOM = 598
const CDTC_COLS = [28, 218, 294, 358, 517, 568, 666, 778]
const CDTC_ROWS = [735, 762, 789, 818, 847, 876, 905, 936, 965]
const CDTC_TOTALS_BOTTOM = 993
const PAYER_ALL = 'MED/TPIN/CONT/CONTM/CONTI/CONTIM'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const isImageDataUrl = v => typeof v === 'string' && v.startsWith('data:image/')

/** A service row counts as filled once any field is entered (location has a default, so it is ignored). */
export const isEntryFilled = e => [
  e.dateOfService, e.procedureCode, e.renderingProvider, e.arrivalTime,
  e.departureTime, e.travelMinutes, e.caregiverSignature,
].some(v => v != null && String(v).trim() !== '')

function textWidthMm(doc, str, size) {
  return doc.getStringUnitWidth(str) * size * PT_TO_MM
}

function setFont(doc, { font = 'helvetica', style = 'normal', size = 9.4, color = BLACK }) {
  doc.setFont(font, style)
  doc.setFontSize(size)
  doc.setTextColor(...color)
}

function text(doc, str, xPx, yPx, opts = {}) {
  setFont(doc, opts)
  doc.text(String(str), X(xPx), Y(yPx), { align: opts.align || 'left', baseline: 'middle' })
}

/** Draws a value inside a fixed-width slot: shrinks the font, then truncates as a last resort. */
function fitText(doc, value, xPx, yPx, maxPx, opts = {}) {
  if (value == null || value === '') return
  const str = String(value)
  const { size = 9.4, minSize = 6 } = opts
  setFont(doc, opts)
  const maxW = maxPx * S
  let s = size
  while (s > minSize && textWidthMm(doc, str, s) > maxW) s -= 0.25
  let out = str
  if (textWidthMm(doc, out, s) > maxW) {
    while (out.length > 1 && textWidthMm(doc, `${out}…`, s) > maxW) out = out.slice(0, -1)
    out = `${out}…`
  }
  text(doc, out, xPx, yPx, { ...opts, size: s })
}

/** Draws mixed bold/normal text runs on one line. */
function textRuns(doc, runs, xPx, yPx, { align = 'left', font = 'helvetica', size = 9.4 } = {}) {
  const widths = runs.map(([str, style]) => {
    doc.setFont(font, style)
    return textWidthMm(doc, str, size)
  })
  const total = widths.reduce((a, b) => a + b, 0)
  let x = align === 'center' ? X(xPx) - total / 2 : X(xPx)
  runs.forEach(([str, style], i) => {
    setFont(doc, { font, style, size })
    doc.text(str, x, Y(yPx), { baseline: 'middle' })
    x += widths[i]
  })
}

function hline(doc, x1Px, x2Px, yPx, width = LINE_THIN) {
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(width)
  doc.line(X(x1Px), Y(yPx), X(x2Px), Y(yPx))
}

function vline(doc, xPx, y1Px, y2Px, width = LINE_THIN) {
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(width)
  doc.line(X(xPx), Y(y1Px), X(xPx), Y(y2Px))
}

function highlight(doc, x1Px, x2Px, yPx, heightPx = 14) {
  doc.setFillColor(...HIGHLIGHT)
  doc.rect(X(x1Px), Y(yPx - heightPx / 2), (x2Px - x1Px) * S, heightPx * S, 'F')
}

/**
 * Places an image inside a box (mm), preserving aspect ratio and centering it.
 * Returns false when the image cannot be decoded.
 */
export function addImageContain(doc, dataUrl, xMm, yMm, wMm, hMm) {
  if (!isImageDataUrl(dataUrl)) return false
  try {
    const props = doc.getImageProperties(dataUrl)
    const r = Math.min(wMm / props.width, hMm / props.height)
    const w = props.width * r
    const h = props.height * r
    doc.addImage(dataUrl, props.fileType || 'PNG', xMm + (wMm - w) / 2, yMm + (hMm - h) / 2, w, h)
    return true
  } catch {
    return false
  }
}

function imageInPxBox(doc, dataUrl, x1Px, y1Px, x2Px, y2Px) {
  return addImageContain(doc, dataUrl, X(x1Px), Y(y1Px), (x2Px - x1Px) * S, (y2Px - y1Px) * S)
}

function formatShortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${Number(m[2])}/${Number(m[3])}` : (iso || '')
}

function formatFullDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${m[2]}/${m[3]}/${m[1]}` : (iso || '')
}

/** '14:05' → { h: '2', m: '05', ap: 'PM' } */
function splitTime(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(value || '')
  if (!m) return null
  const h24 = Number(m[1])
  return { h: String(h24 % 12 || 12), m: m[2], ap: h24 >= 12 ? 'PM' : 'AM' }
}

function billingMonthParts(billingMonth) {
  const m = /^(\d{4})-(\d{2})/.exec(billingMonth || '')
  if (!m) return { month: billingMonth || '', year: '' }
  return { month: MONTH_NAMES[Number(m[2]) - 1] || '', year: m[1] }
}

function drawTimeCell(doc, value, colonPx, yPx) {
  const t = splitTime(value)
  if (!t) return
  text(doc, t.h, colonPx - 3, yPx, { size: 8, align: 'right' })
  text(doc, t.m, colonPx + 3, yPx, { size: 8 })
  text(doc, t.ap, colonPx + 20, yPx, { size: 5.5 })
}

function drawHeaderSection(doc, header) {
  text(doc, 'Therapy Provider - Broward Early Steps Monthly Service Log/Invoice', 397, 30,
    { style: 'bold', size: 13.3, align: 'center', color: TITLE_GRAY })

  const label = (str, x, y) => text(doc, str, x, y, { style: 'bold', size: 9.4 })
  label('Child\u2019s Name:', 28, 50)
  label('DOB:', 430, 50)
  label('Caregiver:', 561, 50)
  label('Address:', 28, 79)
  label('Cell#:', 430, 79)
  label('ESDS#:', 561, 79)
  label('Service Coordinator:', 28, 107)
  label('Cons:', 430, 107)
  label('Medicaid #:', 561, 107)
  label('Frequency:', 28, 136)
  label('Billing Month:', 209, 136)
  label('Year:', 430, 136)
  label('Provider:', 561, 136)

  hline(doc, 168, 423, 113)
  hline(doc, 494, 548, 113)
  hline(doc, 645, 768, 113)

  const { month, year } = billingMonthParts(header.billingMonth)
  const providerLine = [header.provider, header.providerTitle].filter(Boolean).join(', ')
  const value = (v, x, y, maxPx) => fitText(doc, v, x, y, maxPx)

  value(header.childName, 168, 50, 255)
  value(formatFullDate(header.dob), 468, 50, 88)
  value(header.caregiver, 632, 50, 146)
  value(header.address, 168, 79, 255)
  value(header.cell, 468, 79, 88)
  value(header.esds, 632, 79, 146)
  value(header.serviceCoordinator, 170, 106, 251)
  value(header.cons, 496, 106, 52)
  value(header.medicaidNumber, 647, 106, 121)
  value(header.frequency, 168, 136, 38)
  value(month, 305, 136, 120)
  value(year, 468, 136, 88)
  value(providerLine, 645, 136, 133)

  text(doc, 'Current IFSP Service page must be attached', 342, 166,
    { style: 'bolditalic', size: 8.9, align: 'center' })
}

function drawProviderAttestation(doc, header, signatureDataUrl) {
  text(doc, 'I,', 118, 188, { size: 8.9 })
  hline(doc, 130, 414, 194)
  fitText(doc, header.providerAttestation || header.provider, 140, 187, 270, { size: 8.9 })
  text(doc, ',', 415, 188, { size: 8.9 })
  highlight(doc, 421, 665, 188)
  text(doc, 'attest that I have provided the services below.', 421, 188, { size: 8.9 })

  hline(doc, 288, 508, 207)
  imageInPxBox(doc, signatureDataUrl, 292, 180, 504, 206)

  text(doc, 'Print Provider Name', 118, 219, { style: 'italic', size: 8.9 })
  text(doc, 'Signature', 598, 219, { style: 'italic', size: 8.9 })
}

function drawEntriesTable(doc, rows) {
  const [left, right] = [ENTRY_COLS[0], ENTRY_COLS[ENTRY_COLS.length - 1]]
  doc.setFillColor(...HEADER_FILL)
  doc.rect(X(left), Y(ENTRY_TOP), (right - left) * S, (ENTRY_HEAD_BOTTOM - ENTRY_TOP) * S, 'F')

  const rowH = (ENTRY_BOTTOM - ENTRY_HEAD_BOTTOM) / ROWS_PER_PAGE
  for (let i = 0; i <= ROWS_PER_PAGE; i++) hline(doc, left, right, ENTRY_HEAD_BOTTOM + i * rowH)
  ENTRY_COLS.forEach(x => vline(doc, x, ENTRY_TOP, ENTRY_BOTTOM))
  doc.setLineWidth(LINE_THICK)
  doc.rect(X(left), Y(ENTRY_TOP), (right - left) * S, (ENTRY_BOTTOM - ENTRY_TOP) * S, 'S')

  const center = i => (ENTRY_COLS[i] + ENTRY_COLS[i + 1]) / 2
  const head2 = (i, top, bottom, bottomOpts = { style: 'bold', size: 8 }) => {
    text(doc, top, center(i), 240, { style: 'bold', size: 8, align: 'center' })
    text(doc, bottom, center(i), 255, { ...bottomOpts, align: 'center' })
  }
  head2(0, 'Date of', 'Service', { style: 'bold', size: 7.5 })
  head2(1, 'Procedure', '(see below)', { size: 6.5 })
  head2(2, 'Rendering', 'Provider')
  head2(3, 'Location', '(see below)', { size: 6.5 })
  head2(4, 'Arrival', 'Time')
  head2(5, 'Departure', 'Time')
  head2(6, 'Travel  in', 'Minutes')
  text(doc, 'Caregiver Signature', center(7), 248, { style: 'bold', size: 8, align: 'center' })

  for (let i = 0; i < ROWS_PER_PAGE; i++) {
    const top = ENTRY_HEAD_BOTTOM + i * rowH
    const mid = top + rowH / 2
    text(doc, ':', 358, mid, { size: 8, align: 'center' })
    text(doc, ':', 430, mid, { size: 8, align: 'center' })

    const e = rows[i]
    if (!e) continue
    fitText(doc, formatShortDate(e.dateOfService), center(0), mid, 38, { size: 8, align: 'center' })
    fitText(doc, e.procedureCode, center(1), mid, 66, { size: 8, align: 'center' })
    fitText(doc, e.renderingProvider, center(2), mid, 85, { size: 8, align: 'center' })
    fitText(doc, e.locationCode, center(3), mid, 56, { size: 8, align: 'center' })
    drawTimeCell(doc, e.arrivalTime, 358, mid)
    drawTimeCell(doc, e.departureTime, 430, mid)
    fitText(doc, e.travelMinutes, center(6), mid, 56, { size: 8, align: 'center' })

    const sig = e.caregiverSignature
    if (!imageInPxBox(doc, sig, ENTRY_COLS[7] + 6, top + 4, ENTRY_COLS[8] - 6, top + rowH - 4)) {
      fitText(doc, sig, center(7), mid, 234, { size: 8, align: 'center' })
    }
  }
}

function drawCodeLegend(doc) {
  textRuns(doc, [
    ['Procedure Codes: ', 'bold'],
    ['Session = PHY, OCCT, SPL    Evaluation = PSTH, OCTH, SPCH   Meeting = COIFF   Consultation = CONS', 'normal'],
  ], 24, 630, { font: 'times', size: 10.7 })

  textRuns(doc, [
    ['Location Codes: ', 'bold'], ['1', 'bold'], ['(Home), A(Office), ', 'normal'],
    ['5', 'bold'], ['(Daycare), ', 'normal'], ['P', 'bold'], ['(Public Place)    or    ', 'normal'],
    ['GT', 'bold'], ['(TELEHEALTH)', 'normal'],
  ], 397, 647, { font: 'times', size: 11.3, align: 'center' })
}

function drawBillerAttestation(doc) {
  text(doc, 'I,', 40, 682, { size: 8.9 })
  hline(doc, 50, 186, 688)
  text(doc, ',', 187, 682, { size: 8.9 })
  highlight(doc, 191, 657, 682)
  text(doc, 'attest that the provider above has not been paid in full by any other payor for DOS listed', 191, 682, { size: 8.9 })
  text(doc, '.', 658, 682, { size: 8.9 })
  hline(doc, 664, 754, 688)
  text(doc, 'Print Biller Name', 98, 698, { style: 'italic', size: 8.9 })
  text(doc, 'Signature', 668, 698, { style: 'italic', size: 8.9 })
  hline(doc, 28, 772, 708, 0.6)
}

function drawCdtcTable(doc) {
  text(doc, 'FOR CDTC FISCAL PROCESSING ONLY', 422, 721, { style: 'bold', size: 8.3, align: 'center' })

  const [left, right] = [CDTC_COLS[0], CDTC_COLS[CDTC_COLS.length - 1]]
  const [top, bottom] = [CDTC_ROWS[0], CDTC_ROWS[CDTC_ROWS.length - 1]]
  CDTC_ROWS.forEach(y => hline(doc, left, right, y))
  CDTC_COLS.forEach(x => vline(doc, x, top, bottom))
  doc.setLineWidth(LINE_THICK)
  doc.rect(X(left), Y(top), (right - left) * S, (bottom - top) * S, 'S')

  const center = i => (CDTC_COLS[i] + CDTC_COLS[i + 1]) / 2
  const mid = r => (CDTC_ROWS[r] + CDTC_ROWS[r + 1]) / 2
  ;['Payer', 'Procedure', 'Provider', 'Date Range', 'Units', 'Amount', 'Denial Code'].forEach((h, i) => {
    text(doc, h, center(i), mid(0), { style: 'bold', size: 9, align: 'center' })
  })

  for (let r = 1; r <= 3; r++) text(doc, PAYER_ALL, 30, mid(r), { size: 6.5 })
  text(doc, 'CONT', 33, mid(4), { size: 8 })
  text(doc, 'CONS/COIFF', 220, mid(4), { size: 7.5 })
  text(doc, 'CONT', 33, mid(5), { size: 8 })
  text(doc, 'NESF/EPIC', center(1), mid(5), { size: 7.5, align: 'center' })
  text(doc, PAYER_ALL, 30, mid(6), { style: 'bold', size: 6.5 })
  text(doc, 'D or S', center(6), mid(6), { font: 'times', style: 'bold', size: 11, align: 'center' })
  text(doc, 'CONT', 33, mid(7), { style: 'bold', size: 8 })
  text(doc, 'NESF/EPIC', center(1), mid(7), { style: 'bold', size: 8, align: 'center' })
  text(doc, 'D or S', center(6), mid(7), { font: 'times', style: 'bold', size: 11, align: 'center' })

  doc.setLineWidth(LINE_THIN)
  doc.rect(X(CDTC_COLS[4]), Y(bottom), (CDTC_COLS[6] - CDTC_COLS[4]) * S, (CDTC_TOTALS_BOTTOM - bottom) * S, 'S')
  vline(doc, CDTC_COLS[5], bottom, CDTC_TOTALS_BOTTOM)
  text(doc, 'Totals', 509, 979, { style: 'bold', size: 9, align: 'right' })
  text(doc, 'V2024', 33, 976, { font: 'times', size: 8 })
}

/** @param {{ childName?: string, billingMonth?: string }} header */
export function invoicePdfFilename(header) {
  const safeName = (header.childName || 'Unknown').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeDate = (header.billingMonth || 'NoDate').replace(/[^a-zA-Z0-9_-]/g, '_')
  return `ES_Invoice_${safeName}_${safeDate}.pdf`
}

/**
 * Metadata + viewer hints so download and print use the same 1:1 page geometry
 * in viewers that honor PrintScaling=None.
 */
export function applyPrintSettings(doc, title) {
  doc.setProperties({ title, creator: 'Early Steps Provider Portal' })
  if (typeof doc.viewerPreferences === 'function') {
    doc.viewerPreferences({ DisplayDocTitle: true, PrintScaling: 'None', PrintClip: 'CropBox' })
  }
}

export function newLetterDocument() {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: [215.9, 279.4], compress: true, precision: 2 })
}

/**
 * Build the V2024 invoice PDF. Eight service rows per page; extra rows continue on
 * additional identical pages.
 *
 * @param {{ header: object, entries: object[], signatureDataUrl?: string }} params
 * @returns {import('jspdf').jsPDF}
 */
export function buildInvoicePdfDocument({ header, entries, signatureDataUrl }) {
  const doc = newLetterDocument()
  const filled = entries.filter(isEntryFilled)
  const pageCount = Math.max(1, Math.ceil(filled.length / ROWS_PER_PAGE))

  for (let p = 0; p < pageCount; p++) {
    if (p > 0) doc.addPage()
    drawHeaderSection(doc, header)
    drawProviderAttestation(doc, header, signatureDataUrl)
    drawEntriesTable(doc, filled.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE))
    drawCodeLegend(doc)
    drawBillerAttestation(doc)
    drawCdtcTable(doc)
  }

  applyPrintSettings(doc, `Early Steps Invoice — ${header.childName || 'Unknown'}`)
  return doc
}

/** Opens a built PDF in a new tab for printing; falls back to download if popups are blocked. */
export function openPdfInNewTab(doc, filename) {
  const url = URL.createObjectURL(doc.output('blob'))
  const opened = window.open(url, '_blank')
  if (!opened) {
    URL.revokeObjectURL(url)
    doc.save(filename)
    return
  }
  opened.opener = null
  setTimeout(() => URL.revokeObjectURL(url), 120_000)
}

/** @param {{ header: object, entries: object[], signatureDataUrl?: string }} params */
export function generateInvoicePDF(params) {
  buildInvoicePdfDocument(params).save(invoicePdfFilename(params.header))
}

/** @param {{ header: object, entries: object[], signatureDataUrl?: string }} params */
export function openInvoicePdfForPrint(params) {
  openPdfInNewTab(buildInvoicePdfDocument(params), invoicePdfFilename(params.header))
}
