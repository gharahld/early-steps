import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useInvoices } from '../hooks/useInvoices.js'
import { Button, Badge, Card, CardHeader, T } from '../components/ui/index.jsx'

export function Dashboard({ onNewInvoice, onOpenInvoice }) {
  const { user, logout, isPreviewMode } = useAuth()
  const { invoices, loading, error } = useInvoices()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const submitted  = invoices.filter(i => i.status === 'submitted').length
  const drafts     = invoices.filter(i => i.status === 'draft').length
  const thisMonth  = (() => {
    const now = new Date()
    const ym  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return invoices.filter(i => i.billing_month?.startsWith(ym)).length
  })()

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Provider'
  const initials    = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {isPreviewMode && (
        <div role="status" style={{
          background: T.warningBg, borderBottom: `1px solid ${T.warningBorder}`,
          padding: '10px 28px', fontSize: '13px', color: T.warning, lineHeight: 1.45,
        }}>
          <strong>Preview mode</strong> — mock user, no database. Set{' '}
          <code style={{ fontSize: '12px' }}>NEXT_PUBLIC_PREVIEW_DASHBOARD=false</code> or remove it from{' '}
          <code style={{ fontSize: '12px' }}>.env.local</code>, restart dev, then sign in for real data.
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: T.navy, height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '800', color: '#fff', fontSize: '13px',
          }}>ES</div>
          <div>
            <div style={{ color: '#fff', fontWeight: '700', fontSize: '13px' }}>Broward Early Steps</div>
            <div style={{ color: '#475569', fontSize: '10px', letterSpacing: '0.06em' }}>PROVIDER PORTAL</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: '700', fontSize: '11px',
            }}>{initials}</div>
            <div>
              <div style={{ color: '#fff', fontSize: '12px', fontWeight: '600' }}>{displayName}</div>
              <div style={{ color: '#64748b', fontSize: '10px' }}>{user?.email}</div>
            </div>
          </div>

          {confirmLogout ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>Sign out?</span>
              <Button onClick={logout}                       variant="danger"     size="sm">Yes</Button>
              <Button onClick={() => setConfirmLogout(false)} variant="secondary" size="sm">Cancel</Button>
            </div>
          ) : (
            <Button onClick={() => setConfirmLogout(true)} variant="ghost" size="sm"
              style={{ color: '#64748b' }}>
              Sign Out
            </Button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '32px 20px' }}>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: T.text, margin: 0 }}>My Invoices</h1>
            <p style={{ fontSize: '13px', color: T.muted, margin: '4px 0 0' }}>
              Manage and submit your monthly service logs
            </p>
          </div>
          <Button onClick={onNewInvoice}>+ New Invoice</Button>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Submitted',  value: submitted, color: T.success,  bg: T.successBg,  icon: '✓' },
            { label: 'Drafts',     value: drafts,    color: T.warning,  bg: T.warningBg,  icon: '✏️' },
            { label: 'This Month', value: thisMonth, color: T.brand,    bg: '#eff6ff',    icon: '📅' },
          ].map(({ label, value, color, bg, icon }) => (
            <div key={label} style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: '12px', padding: '20px 22px',
              display: 'flex', alignItems: 'center', gap: '14px',
            }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: '800', color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '12px', color: T.muted, fontWeight: '600', marginTop: '2px' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Invoice table ───────────────────────────────────────────────── */}
        <Card style={{ marginBottom: '16px' }}>
          <CardHeader right={<span style={{ fontSize: '12px', color: T.muted }}>{invoices.length} total</span>}>
            All Invoices
          </CardHeader>

          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: T.muted, fontSize: '13px' }}>
              Loading invoices…
            </div>
          )}

          {error && (
            <div style={{ padding: '20px 22px', background: T.dangerBg, color: T.danger, fontSize: '13px' }}>
              Failed to load invoices. Please refresh.
            </div>
          )}

          {!loading && !error && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Child Name', 'Billing Month', 'Sessions', 'Status', 'Created', ''].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left', fontSize: '11px',
                      fontWeight: '700', letterSpacing: '0.07em', color: T.muted,
                      textTransform: 'uppercase', borderBottom: `1px solid ${T.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: T.subtle }}>
                      No invoices yet. Click <strong>+ New Invoice</strong> to get started.
                    </td>
                  </tr>
                ) : invoices.map((inv, i) => (
                  <tr key={inv.id}
                    style={{ borderBottom: i < invoices.length - 1 ? `1px solid #f8fafc` : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: T.text }}>
                      {inv.child_name || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', color: T.muted }}>
                      {inv.billing_month || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', color: T.muted }}>
                      {inv.service_entries?.[0]?.count ?? 0} entries
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Badge color={inv.status === 'submitted' ? 'green' : 'amber'}>
                        {inv.status === 'submitted' ? 'Submitted' : 'Draft'}
                      </Badge>
                    </td>
                    <td style={{ padding: '14px 16px', color: T.muted }}>
                      {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <Button onClick={() => onOpenInvoice(inv)} variant="secondary" size="sm">
                        {inv.status === 'draft' ? 'Continue' : 'View'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* ── Security notice ─────────────────────────────────────────────── */}
        <div style={{
          padding: '12px 16px', background: '#f8fafc',
          border: `1px solid ${T.border}`, borderRadius: '8px',
          display: 'flex', gap: '10px', alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '14px' }}>🛡️</span>
          <p style={{ margin: 0, fontSize: '11px', color: T.muted, lineHeight: 1.6 }}>
            <strong style={{ color: T.text }}>Security:</strong> Your session expires after 30 minutes of
            inactivity. All data is transmitted over HTTPS and protected by Supabase Row-Level Security —
            you can only access your own records. Login is rate-limited to 5 attempts per 15-minute window.
          </p>
        </div>
      </div>
    </div>
  )
}
