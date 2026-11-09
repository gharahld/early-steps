/**
 * Storage in this browser's localStorage. Data stays on this device only and is lost
 * if browser data is cleared. Invoice rows keep the field names the former Supabase
 * tables used (service_logs / service_entries).
 */

const KEYS = {
  invoices:  'es-portal:invoices:v1',
  soapNotes: 'es-portal:soap-notes:v1',
  profile:   'es-portal:profile:v1',
}

const EMPTY_PROFILE = { name: '', title: '', license: '' }

function read(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null')
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new Error('Could not save: this browser\u2019s storage is full or unavailable.')
  }
}

function upsertRow(key, id, fields) {
  const rows = read(key, [])
  const now = new Date().toISOString()
  const existing = id ? rows.find(r => r.id === id) : null
  const row = {
    ...existing,
    ...fields,
    id: existing?.id ?? id ?? crypto.randomUUID(),
    created_at: existing?.created_at ?? now,
    updated_at: now,
  }
  write(key, existing ? rows.map(r => (r.id === row.id ? row : r)) : [...rows, row])
  return row
}

const newestFirst = (a, b) => String(b.created_at).localeCompare(String(a.created_at))

// ── Invoices ──────────────────────────────────────────────────────────────────

/** Dashboard rows, newest first, with an entry count like Supabase's `service_entries(count)`. */
export function listInvoices() {
  return read(KEYS.invoices, [])
    .map(({ service_entries: entries = [], ...log }) => ({ ...log, service_entries: [{ count: entries.length }] }))
    .sort(newestFirst)
}

export function getInvoice(id) {
  return read(KEYS.invoices, []).find(log => log.id === id) ?? null
}

function deleteRow(key, id) {
  write(key, read(key, []).filter(r => r.id !== id))
}

export function deleteInvoice(id) {
  deleteRow(KEYS.invoices, id)
}

/** Insert or update a log and replace all of its entries. */
export function upsertInvoice(id, logFields, entryRows) {
  const logId = id || crypto.randomUUID()
  return upsertRow(KEYS.invoices, logId, {
    ...logFields,
    service_entries: entryRows.map(row => ({ id: crypto.randomUUID(), log_id: logId, ...row })),
  })
}

// ── SOAP notes ────────────────────────────────────────────────────────────────

/** Newest session date first; undated notes last. */
export function listSoapNotes() {
  return read(KEYS.soapNotes, []).sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')) || newestFirst(a, b))
}

export function getSoapNote(id) {
  return read(KEYS.soapNotes, []).find(note => note.id === id) ?? null
}

export function upsertSoapNote(id, fields) {
  return upsertRow(KEYS.soapNotes, id, fields)
}

export function deleteSoapNote(id) {
  deleteRow(KEYS.soapNotes, id)
}

// ── Provider profile ──────────────────────────────────────────────────────────

export function getProfile() {
  return { ...EMPTY_PROFILE, ...read(KEYS.profile, {}) }
}

export function saveProfile(profile) {
  const clean = {
    name:    String(profile.name ?? '').trim(),
    title:   String(profile.title ?? '').trim(),
    license: String(profile.license ?? '').trim(),
  }
  write(KEYS.profile, clean)
  return clean
}
