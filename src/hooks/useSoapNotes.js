import { useCallback, useEffect, useState } from 'react'
import { deleteSoapNote, getSoapNote, listSoapNotes, upsertSoapNote } from '../lib/localStore.js'

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

  /** Saves the note. Page 1 is also kept in the top-level fields so the list and older code still work. */
  const saveNote = useCallback(async ({ id, note, pages, therapist }) => {
    const clean = pages.map(({ key, ...p }) => p) // eslint-disable-line no-unused-vars
    const first = clean[0] ?? {}
    const saved = upsertSoapNote(id, {
      child_name:  note.childName,
      dob:         note.dob || null,
      date:        first.date || null,
      time_in:     first.timeIn || null,
      time_out:    first.timeOut || null,
      location:    first.location ?? '',
      subjective:  first.subjective ?? '',
      objective:   first.objective ?? '',
      assessment:  first.assessment ?? '',
      plan:        first.plan ?? '',
      therapist_name:    therapist.name,
      therapist_title:   therapist.title,
      therapist_license: therapist.license,
      signature:   first.signature || null,
      pages:       clean,
    })
    await fetchNotes()
    return saved
  }, [fetchNotes])

  const fetchNoteById = useCallback(async (noteId) => (noteId ? getSoapNote(noteId) : null), [])

  const deleteNote = useCallback(async (noteId) => {
    deleteSoapNote(noteId)
    await fetchNotes()
  }, [fetchNotes])

  return { notes, loading, error, saveNote, deleteNote, fetchNoteById }
}
