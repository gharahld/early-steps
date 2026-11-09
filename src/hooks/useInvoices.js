import { useCallback, useEffect, useState } from 'react'
import { getInvoice, listInvoices, upsertInvoice } from '../lib/localStore.js'
import { isEntryFilled } from '../utils/pdfGenerator.js'

/** Hook for listing and saving service logs stored in this browser. */
export function useInvoices() {
  const [invoices, setInvoices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const fetchInvoices = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setInvoices(listInvoices())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const saveInvoice = useCallback(async ({ id, header, entries, providerSignature, status = 'draft' }) => {
    const logFields = {
      child_name:          header.childName,
      dob:                 header.dob || null,
      caregiver:           header.caregiver,
      address:             header.address,
      cell:                header.cell,
      esds:                header.esds,
      service_coordinator: header.serviceCoordinator,
      cons:                header.cons,
      medicaid_number:     header.medicaidNumber,
      frequency:           header.frequency,
      billing_month:       header.billingMonth || null,
      provider_name:       header.provider,
      provider_title:      header.providerTitle,
      provider_attestation: header.providerAttestation,
      provider_signature:  providerSignature || null,
      status,
    }

    const entryRows = entries
      .filter(isEntryFilled)
      .map((e, i) => ({
        date_of_service:    e.dateOfService || null,
        procedure_code:     e.procedureCode,
        rendering_provider: e.renderingProvider,
        location_code:      e.locationCode,
        arrival_time:       e.arrivalTime || null,
        departure_time:     e.departureTime || null,
        travel_minutes:     e.travelMinutes ? parseInt(e.travelMinutes, 10) : null,
        caregiver_signature: e.caregiverSignature || null,
        sort_order:         i,
      }))

    const log = upsertInvoice(id, logFields, entryRows)
    await fetchInvoices()
    return log
  }, [fetchInvoices])

  const fetchInvoiceById = useCallback(async (logId) => (logId ? getInvoice(logId) : null), [])

  return { invoices, loading, error, saveInvoice, refetch: fetchInvoices, fetchInvoiceById }
}
