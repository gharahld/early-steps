import jsPDF from 'jspdf'
import 'jspdf-autotable'

const LOCATION_LABELS = {
  '1': '1–Home', A: 'A–Office', '5': '5–Daycare', P: 'P–Public', '9': '9–Dev.Pre',
}

/** Grayscale palette — print-style B&W (no color fills). */
const BLACK = [0, 0, 0]
const GRAY_TEXT = [35, 35, 35]
const GRAY_BORDER = [120, 120, 120]
const GRAY_HEADER_BG = [245, 245, 245]
const ROW_ALT_BG = [252, 252, 252]

const LEGEND_PROCEDURE =
  'Procedure  Codes: Session = PHY, OCCT, SPL; Evaluation = PSTH, OCTH, SPCH; FSP Meeting = COIFF; Consult = CONOF(OT Consult), CONPF(PT Consult), CONSF(SPL Consult)'
const LEGEND_LOCATION =
  'Location Codes: 1 = Home   A = Office   5 = Daycare   P = Public Place   9 = Developmental Preschool   TELEC- Telephone Conference   GT- Telehealth'

/** @param {{ childName?: string, billingMonth?: string }} header */
export function invoicePdfFilename(header) {
  const safeName = (header.childName || 'Unknown').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeDate = (header.billingMonth || 'NoDate').replace(/[^a-zA-Z0-9_-]/g, '_')
  return `ES_Invoice_${safeName}_${safeDate}.pdf`
}

/**
 * Apply document metadata + viewer hints so on-screen, download, and physical print
 * use the same 1:1 page geometry when viewers honor PrintScaling=None.
 *
 * @param {import('jspdf').jsPDF} doc
 * @param {{ childName?: string }} header
 */
function finalizeInvoicePdfDocument(doc, header) {
  const title = `Early Steps Invoice — ${header.childName || 'Unknown'}`
  doc.setProperties({
    title,
    subject: 'Broward Early Steps — monthly service log / invoice',
    keywords: 'Early Steps, invoice, service log',
    creator: 'Early Steps Provider Portal',
  })

  if (typeof doc.viewerPreferences === 'function') {
    doc.viewerPreferences({
      DisplayDocTitle: true,
      PrintScaling: 'None',
      PrintClip: 'CropBox',
    })
  }
}

/**
 * Build the invoice PDF (single code path for download and print).
 *
 * @param {{ header: object, entries: object[], signatureDataUrl: string }} params
 * @returns {import('jspdf').jsPDF}
 */
export function buildInvoicePdfDocument({ header, entries, signatureDataUrl }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [215.9, 279.4],
    compress: true,
    precision: 2,
  })
  const W = 215.9
  const m = 14

  const tableLine = { lineWidth: 0.15, lineColor: BLACK }
  const tableStyles = {
    fontSize: 7,
    cellPadding: 2,
    textColor: BLACK,
    ...tableLine,
  }
  const tableHeadStyles = {
    fillColor: GRAY_HEADER_BG,
    textColor      : BLACK,
    fontStyle      : 'bold',
    fontSize       : 6.5,
    ...tableLine,
  }

  let y = 12

  doc.setTextColor(...BLACK)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('THERAPY PROVIDER- BROWARD EARLY STEPS MONTHLY SERVICE LOG/INVOICE', W / 2, y, { align: 'center' })
  y += 6
  if (header.billingMonth) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Billing Month/Year: ${header.billingMonth}`, W - m, y, { align: 'right' })
    y += 2
  }
  y += 4

  doc.setDrawColor(...GRAY_BORDER)
  doc.setLineWidth(0.3)
  doc.line(m, y, W - m, y)
  y += 6

  const col = (W - m * 2) / 3
  const fields = [
    ['Child Name', header.childName],
    ['DOB', header.dob],
    ['Caregiver', header.caregiver],
    ['Address', header.address],
    ['Cell', header.cell],
    ['CHART NG#', header.chartNg],
    ['Service Coordinator', header.serviceCoordinator],
    ['Medicaid #', header.medicaidNumber],
    ['Frequency', header.frequency],
    ['Billing Month/Year', header.billingMonth],
    ['Provider', header.provider],
    ['', ''],
  ]

  fields.forEach(([label, val], i) => {
    const cx = m + (i % 3) * col
    const cy = y + Math.floor(i / 3) * 10
    doc.setTextColor(...GRAY_BORDER)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text(label ? `${label}:` : '', cx, cy)
    doc.setTextColor(...GRAY_TEXT)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.text(val || '—', cx, cy + 4)
  })
  y += Math.ceil(fields.length / 3) * 10 + 4

  doc.setDrawColor(...BLACK)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(m, y, W - m * 2, 10, 1, 1, 'FD')
  doc.setTextColor(...BLACK)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  const attestName = header.providerAttestation || '___________________________'
  doc.text(`I, ${attestName}, attest that I have provided the services below.`, m + 3, y + 6.5)
  y += 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('SERVICE ENTRIES', m, y)
  y += 3

  const filledEntries = entries.filter(e => e.dateOfService || e.procedureCode)
  const tableRows = filledEntries.length
    ? filledEntries.map((e) => [
        e.dateOfService || '—',
        e.procedureCode || '—',
        e.fpg || 'F',
        e.renderingProvider || '—',
        LOCATION_LABELS[e.locationCode] ?? e.locationCode ?? '—',
        e.arrivalTime || '—',
        e.departureTime || '—',
        e.travelMinutes || '0',
        e.caregiverSignature || '',
      ])
    : [['—', '—', '—', '—', '—', '—', '—', '—', '']]

  doc.autoTable({
    startY: y,
    margin: { left: m, right: m },
    head: [[
      'Date of\nService',
      'Procedure\n(see below)',
      'F,P,GT',
      'Rendering\nProvider',
      'Location\n(see below)',
      'Arrival\nTime',
      'Departure\nTime',
      'Travel in\nMinutes',
      'Caregiver\nSignature',
    ]],
    body: tableRows,
    styles         : { ...tableStyles, valign: 'middle' },
    headStyles     : { ...tableHeadStyles, valign: 'middle' },
    alternateRowStyles: { fillColor: ROW_ALT_BG },
    columnStyles: {
      0: { cellWidth: 20 }, 1: { cellWidth: 17 }, 2: { cellWidth: 12 },
      3: { cellWidth: 28 }, 4: { cellWidth: 22 }, 5: { cellWidth: 15 },
      6: { cellWidth: 15 }, 7: { cellWidth: 13 }, 8: { cellWidth: 28 },
    },
  })
  y = doc.lastAutoTable.finalY + 5

  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  const legendW = W - m * 2 - 4
  const leg1 = doc.splitTextToSize(LEGEND_PROCEDURE, legendW)
  const leg2 = doc.splitTextToSize(LEGEND_LOCATION, legendW)
  const legendInnerH = 3 + leg1.length * 2.8 + 1.5 + leg2.length * 2.8 + 2
  doc.setDrawColor(...GRAY_BORDER)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(m, y, W - m * 2, legendInnerH, 1, 1, 'FD')
  doc.setTextColor(...BLACK)
  let ly = y + 3.5
  doc.text(leg1, m + 2, ly)
  ly += leg1.length * 2.8 + 1.5
  doc.text(leg2, m + 2, ly)
  y += legendInnerH + 3

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PROVIDER SIGN-OFF', m, y)
  y += 5
  doc.setDrawColor(...GRAY_BORDER)
  doc.line(m, y, W - m, y)
  y += 6

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GRAY_BORDER)
  doc.text('PRINT PROVIDER NAME', m, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BLACK)
  doc.text(header.provider || '—', m, y + 5)
  doc.setDrawColor(...BLACK)
  doc.line(m, y + 7, m + 85, y + 7)

  const sx = m + 95
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GRAY_BORDER)
  doc.text('SIGNATURE OF PROVIDER', sx, y)
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', sx, y + 1, 80, 18)
    } catch {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7)
      doc.setTextColor(...GRAY_BORDER)
      doc.text('(signature image)', sx, y + 10)
    }
  }
  doc.setDrawColor(...BLACK)
  doc.line(sx, y + 20, sx + 80, y + 20)
  y += 28

  doc.setDrawColor(...BLACK)
  doc.setFillColor(255, 255, 255)
  doc.rect(m, y, W - m * 2, 6, 'FD')
  doc.setTextColor(...BLACK)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('FOR CDTC FISCAL PROCESSING ONLY', W / 2, y + 4, { align: 'center' })
  y += 10

  doc.autoTable({
    startY: y,
    margin: { left: m, right: m },
    head: [['Payer', 'Procedure', 'Provider', 'Date Range', 'Units', 'Amount', 'Denial Code']],
    body: [
      ['MED/TPIN/CONT/CONTM/CONTI', '', '', '', '', '', ''],
      ['MED/TPIN/CONT/CONTM/CONTI', '', '', '', '', '', ''],
      ['MED/TPIN/CONT/CONTM/CONTI', '', '', '', '', '', ''],
      ['CONT', 'TELEC', '', '', '', '', ''],
      ['CONT', 'NESF', '', '', '', '', ''],
      ['MED/TPIN/CONT/CONTM/CONTI', '', '', '', '', '', 'D or S'],
      ['CONT', 'NESF', '', '', '', '', 'D or S'],
      ['', '', 'Totals', '', '', '', ''],
    ],
    styles    : tableStyles,
    headStyles: tableHeadStyles,
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...GRAY_BORDER)
    doc.text(
      `Broward Early Steps — Monthly Service Log / Invoice — Page ${i} of ${pageCount}`,
      W / 2,
      275,
      { align: 'center' },
    )
  }

  finalizeInvoicePdfDocument(doc, header)
  return doc
}

/**
 * Download the invoice PDF (same bytes as {@link openInvoicePdfForPrint}).
 *
 * @param {{ header: object, entries: object[], signatureDataUrl: string }} params
 */
export function generateInvoicePDF(params) {
  const doc = buildInvoicePdfDocument(params)
  doc.save(invoicePdfFilename(params.header))
}

/**
 * Open the same PDF in a new tab so the user can print from the browser PDF viewer.
 * Uses the identical document as {@link generateInvoicePDF}.
 *
 * @param {{ header: object, entries: object[], signatureDataUrl: string }} params
 */
export function openInvoicePdfForPrint(params) {
  const doc = buildInvoicePdfDocument(params)
  const name = invoicePdfFilename(params.header)
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    URL.revokeObjectURL(url)
    doc.save(name)
    return
  }
  const revoke = () => URL.revokeObjectURL(url)
  setTimeout(revoke, 120_000)
  opened.addEventListener('beforeunload', revoke, { once: true })
}
