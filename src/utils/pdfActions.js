/** Browser actions for an already-built PDF blob: print (new tab), download, and device share. */

/** Opens the PDF in a new tab to print from the browser's viewer; downloads instead if popups are blocked. */
export function openBlobInNewTab(blob, filename) {
  const url = URL.createObjectURL(blob)
  const opened = window.open(url, '_blank')
  if (!opened) {
    URL.revokeObjectURL(url)
    downloadBlob(blob, filename)
    return
  }
  opened.opener = null
  setTimeout(() => URL.revokeObjectURL(url), 120_000)
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Opens the device share sheet (Mail, Messages, AirDrop, …) with the PDF attached.
 * Must be called directly from a click handler. Falls back to downloading where file
 * sharing is unsupported (most desktop browsers).
 *
 * @returns {Promise<'shared' | 'cancelled' | 'downloaded'>}
 */
export async function sharePdf(blob, filename, title) {
  const file = new File([blob], filename, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }
  downloadBlob(blob, filename)
  return 'downloaded'
}
