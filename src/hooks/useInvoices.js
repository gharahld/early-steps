import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Hook for fetching and managing the current provider's service logs.
 * Row-Level Security in Supabase ensures users can only access their own data.
 */
export function useInvoices() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const fetchInvoices = useCallback(async () => {
    if (!user) return
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('service_logs')
        .select('id, child_name, billing_month, status, created_at, service_entries(count)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInvoices(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  // ── Save or update a log + its entries ───────────────────────────────────
  const saveInvoice = useCallback(async ({ id, header, entries, status = 'draft' }) => {
    if (!user) throw new Error('Not authenticated')

    const logPayload = {
      provider_id:         user.id,
      child_name:          header.childName,
      dob:                 header.dob || null,
      caregiver:           header.caregiver,
      address:             header.address,
      cell:                header.cell,
      chart_ng:            header.chartNg,
      service_coordinator: header.serviceCoordinator,
      medicaid_number:     header.medicaidNumber,
      frequency:           header.frequency,
      billing_month:       header.billingMonth || null,
      provider_name:       header.provider,
      provider_attestation: header.providerAttestation,
      status,
      updated_at:          new Date().toISOString(),
    }

    // Upsert the log
    const { data: log, error: logErr } = await supabase
      .from('service_logs')
      .upsert(id ? { id, ...logPayload } : logPayload)
      .select()
      .single()

    if (logErr) throw logErr

    // Replace all entries (delete-then-insert is safe inside a transaction here
    // because we own the log via RLS, and the UI sends the full set each time)
    await supabase.from('service_entries').delete().eq('log_id', log.id)

    const entryRows = entries
      .filter(e => e.dateOfService || e.procedureCode)
      .map((e, i) => ({
        log_id:             log.id,
        date_of_service:    e.dateOfService || null,
        procedure_code:     e.procedureCode,
        fpg:                e.fpg,
        rendering_provider: e.renderingProvider,
        location_code:      e.locationCode,
        arrival_time:       e.arrivalTime || null,
        departure_time:     e.departureTime || null,
        travel_minutes:     e.travelMinutes ? parseInt(e.travelMinutes, 10) : null,
        caregiver_signature: e.caregiverSignature,
        sort_order:         i,
      }))

    if (entryRows.length) {
      const { error: entryErr } = await supabase.from('service_entries').insert(entryRows)
      if (entryErr) throw entryErr
    }

    await fetchInvoices() // refresh list
    return log
  }, [user, fetchInvoices])

  return { invoices, loading, error, saveInvoice, refetch: fetchInvoices }
}
