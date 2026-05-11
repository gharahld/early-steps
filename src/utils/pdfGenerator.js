import jsPDF from 'jspdf'
import 'jspdf-autotable'

const LOCATION_LABELS = {
  '1': '1–Home', A: 'A–Office', '5': '5–Daycare', P: 'P–Public', '9': '9–Dev.Pre',
}

/**
 * Generate and auto-download the Early Steps invoice PDF.
 *
 * @param {{ header: object, entries: object[], signatureDataUrl: string }} params
 */
export function generateInvoicePDF({ header, entries, signatureDataUrl }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = 215.9
  const m = 14

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text('BROWARD EARLY STEPS', m, 10)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text('THERAPY PROVIDER — MONTHLY SERVICE LOG / INVOICE', m, 16)
  if (header.billingMonth) {
    doc.setFontSize(8)
    doc.text(`Billing: ${header.billingMonth}`, W - m, 10, { align: 'right' })
  }

  // ── Patient info grid ────────────────────────────────────────────────────────
  let y = 30
  doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
  doc.text('PATIENT & BILLING INFORMATION', m, y); y += 5
  doc.setDrawColor(226, 232, 240); doc.line(m, y, W - m, y); y += 4

  const col = (W - m * 2) / 3
  const fields = [
    ['Child Name',          header.childName],
    ['Date of Birth',       header.dob],
    ['Caregiver',           header.caregiver],
    ['Address',             header.address],
    ['Cell Phone',          header.cell],
    ['Chart NG #',          header.chartNg],
    ['Service Coordinator', header.serviceCoordinator],
    ['Medicaid #',          header.medicaidNumber],
    ['Frequency',           header.frequency],
    ['Provider',            header.provider],
    ['Billing Month',       header.billingMonth],
    ['', ''],
  ]

  fields.forEach(([label, val], i) => {
    const cx = m + (i % 3) * col
    const cy = y + Math.floor(i / 3) * 10
    doc.setTextColor(100, 116, 139); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
    doc.text(label.toUpperCase(), cx, cy)
    doc.setTextColor(30, 41, 59); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal')
    doc.text(val || '—', cx, cy + 4)
  })
  y += Math.ceil(fields.length / 3) * 10 + 4

  // ── Attestation ──────────────────────────────────────────────────────────────
  doc.setFillColor(255, 251, 235); doc.setDrawColor(253, 211, 77)
  doc.roundedRect(m, y, W - m * 2, 10, 2, 2, 'FD')
  doc.setTextColor(120, 53, 15); doc.setFontSize(8); doc.setFont('helvetica', 'italic')
  const attestName = header.providerAttestation || '___________________________'
  doc.text(
    `I, ${attestName}, attest that I have provided the services listed below.`,
    m + 3, y + 6.5,
  )
  y += 16

  // ── Service entries table ────────────────────────────────────────────────────
  doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
  doc.text('SERVICE ENTRIES', m, y); y += 3

  const filledEntries = entries.filter(e => e.dateOfService || e.procedureCode)
  const tableRows = filledEntries.length
    ? filledEntries.map((e, i) => [
        i + 1,
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
    : [['—', '—', '—', '—', '—', '—', '—', '—', '—', '']]

  doc.autoTable({
    startY: y,
    margin: { left: m, right: m },
    head: [['#', 'Date', 'Procedure', 'F/P/GT', 'Rendering Provider', 'Location', 'Arrival', 'Departure', 'Travel', 'Caregiver Sig.']],
    body: tableRows,
    styles:         { fontSize: 7, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles:     { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 6 }, 1: { cellWidth: 20 }, 2: { cellWidth: 16 },
      3: { cellWidth: 11 }, 4: { cellWidth: 28 }, 5: { cellWidth: 20 },
      6: { cellWidth: 14 }, 7: { cellWidth: 14 }, 8: { cellWidth: 12 }, 9: { cellWidth: 28 },
    },
  })
  y = doc.lastAutoTable.finalY + 8

  // ── Legend ───────────────────────────────────────────────────────────────────
  doc.setFillColor(241, 245, 249); doc.setDrawColor(226, 232, 240)
  doc.roundedRect(m, y, W - m * 2, 14, 2, 2, 'FD')
  doc.setTextColor(71, 85, 105); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold')
  doc.text('PROCEDURE:', m + 2, y + 4.5); doc.setFont('helvetica', 'normal')
  doc.text('PHY/OCCT/SPL=Session · PSTH/OCTH/SPCH=Eval · COIFF=FSP · GT=Telehealth', m + 24, y + 4.5)
  doc.setFont('helvetica', 'bold')
  doc.text('LOCATION:', m + 2, y + 10); doc.setFont('helvetica', 'normal')
  doc.text('1=Home · A=Office · 5=Daycare · P=Public · 9=Dev. Preschool', m + 24, y + 10)
  y += 20

  // ── Provider sign-off ────────────────────────────────────────────────────────
  doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
  doc.text('PROVIDER SIGN-OFF', m, y); y += 5
  doc.setDrawColor(226, 232, 240); doc.line(m, y, W - m, y); y += 6

  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('PRINT PROVIDER NAME', m, y)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59); doc.setFontSize(9)
  doc.text(header.provider || '—', m, y + 6)
  doc.setDrawColor(203, 213, 225); doc.line(m, y + 8, m + 80, y + 8)

  const sx = m + 95
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('SIGNATURE OF PROVIDER', sx, y)
  if (signatureDataUrl) doc.addImage(signatureDataUrl, 'PNG', sx, y + 1, 80, 18)
  doc.setDrawColor(203, 213, 225); doc.line(sx, y + 20, sx + 80, y + 20)
  y += 28

  // ── CDTC Fiscal Processing ───────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252); doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.5)
  doc.roundedRect(m, y, W - m * 2, 6, 1, 1, 'FD')
  doc.setTextColor(71, 85, 105); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
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
      ['', '', 'TOTALS', '', '', '', ''],
    ],
    styles:     { fontSize: 7, cellPadding: 2.5, textColor: [71, 85, 105] },
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 6.5, fontStyle: 'bold' },
  })

  // ── Footer ───────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(148, 163, 184)
    doc.text(
      `Broward Early Steps · Therapy Provider Invoice · Page ${i} of ${pageCount}`,
      W / 2, 275, { align: 'center' },
    )
  }

  // Safe filename — strip characters that could cause path issues
  const safeName = (header.childName || 'Unknown').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeDate = (header.billingMonth || 'NoDate').replace(/[^a-zA-Z0-9_-]/g, '_')
  doc.save(`ES_Invoice_${safeName}_${safeDate}.pdf`)
}
