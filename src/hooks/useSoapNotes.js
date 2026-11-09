import { useCallback, useEffect, useState } from 'react'
import { getSoapNote, listSoapNotes, upsertSoapNote } from '../lib/localStore.js'

/** Hook for listing and saving Daily SOAP Notes stored in this browser. */
export function useSoapNotes() {
  const [notes,   setNotes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetchNotes = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setNotes(listSoapNotes())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const saveNote = useCallback(async ({ id, note, therapist, signature }) => {
    const saved = upsertSoapNote(id, {
      child_name:  note.childName,
      date:        note.date || null,
      time_in:     note.timeIn || null,
      time_out:    note.timeOut || null,
      location:    note.location,
      subjective:  note.subjective,
      objective:   note.objective,
      assessment:  note.assessment,
      plan:        note.plan,
      therapist_name:    therapist.name,
      therapist_title:   therapist.title,
      therapist_license: therapist.license,
      signature:   signature || null,
    })
    await fetchNotes()
    return saved
  }, [fetchNotes])

  const fetchNoteById = useCallback(async (noteId) => (noteId ? getSoapNote(noteId) : null), [])

  return { notes, loading, error, saveNote, fetchNoteById }
}
