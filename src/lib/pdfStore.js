/**
 * Saved PDF files, kept in this browser's IndexedDB (PDF blobs are too large for
 * localStorage). One record per form: saving the same form again replaces its PDF.
 */

const DB_NAME = 'es-portal'
const STORE = 'saved-pdfs'
const VERSION = 1

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(new Error('Saved PDFs are unavailable in this browser.'))
  })
}

async function run(mode, operation) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = operation(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(req.result) }
    tx.onerror = tx.onabort = () => {
      db.close()
      reject(new Error(tx.error?.name === 'QuotaExceededError'
        ? 'Could not save the PDF: this browser\u2019s storage is full. Delete some saved PDFs and try again.'
        : 'Could not access saved PDFs.'))
    }
  })
}

/**
 * @param {{ kind: 'invoice' | 'soap', formId: string, title: string, subtitle: string, filename: string, blob: Blob }} pdf
 */
export function savePdf({ kind, formId, ...rest }) {
  return run('readwrite', store => store.put({
    id: `${kind}:${formId}`, kind, formId, ...rest, saved_at: new Date().toISOString(),
  }))
}

export async function listSavedPdfs() {
  const rows = (await run('readonly', store => store.getAll())) ?? []
  return rows.sort((a, b) => b.saved_at.localeCompare(a.saved_at))
}

export function deleteSavedPdf(id) {
  return run('readwrite', store => store.delete(id))
}
