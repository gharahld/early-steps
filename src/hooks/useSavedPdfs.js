import { useCallback, useEffect, useState } from 'react'
import { deleteSavedPdf, listSavedPdfs, savePdf } from '../lib/pdfStore.js'

/** Saved PDF files (with their blobs loaded, so print/share can run directly in a click). */
export function useSavedPdfs({ load = true } = {}) {
  const [pdfs,    setPdfs]    = useState([])
  const [loading, setLoading] = useState(load)
  const [error,   setError]   = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setPdfs(await listSavedPdfs())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (load) refresh() }, [load, refresh])

  const save = useCallback(async (pdf) => {
    await savePdf(pdf)
    if (load) await refresh()
  }, [load, refresh])

  const remove = useCallback(async (id) => {
    await deleteSavedPdf(id)
    await refresh()
  }, [refresh])

  return { pdfs, loading, error, savePdf: save, deletePdf: remove }
}
