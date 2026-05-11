import { useState } from 'react'

// ── Design tokens ─────────────────────────────────────────────────────────────
export const T = {
  bg:            '#f1f5f9',
  card:          '#ffffff',
  border:        '#e2e8f0',
  text:          '#0f172a',
  muted:         '#64748b',
  subtle:        '#94a3b8',
  brand:         '#3b82f6',
  brandDark:     '#1d4ed8',
  navy:          '#0f172a',
  success:       '#15803d',
  successBg:     '#f0fdf4',
  successBorder: '#bbf7d0',
  danger:        '#be123c',
  dangerBg:      '#fff1f2',
  dangerBorder:  '#fecdd3',
  warning:       '#b45309',
  warningBg:     '#fffbeb',
  warningBorder: '#fde68a',
}

// ── Button ────────────────────────────────────────────────────────────────────
const VARIANTS = {
  primary:   { bg: T.brand,    hbg: T.brandDark, color: '#fff',   border: 'none' },
  secondary: { bg: '#fff',     hbg: '#f8fafc',   color: T.text,   border: `1px solid ${T.border}` },
  ghost:     { bg: 'transparent', hbg: '#f1f5f9', color: T.muted, border: 'none' },
  danger:    { bg: T.dangerBg, hbg: '#ffe4e6',   color: T.danger, border: `1px solid ${T.dangerBorder}` },
}
const SIZES = {
  sm: { padding: '6px 14px',  fontSize: '12px' },
  md: { padding: '10px 20px', fontSize: '14px' },
  lg: { padding: '13px 28px', fontSize: '15px' },
}

export function Button({
  children, onClick, disabled,
  variant = 'primary', size = 'md', full = false, style = {},
}) {
  const [hov, setHov] = useState(false)
  const v = VARIANTS[variant]
  const sz = SIZES[size]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...sz,
        borderRadius: '8px',
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? '#e2e8f0' : hov ? v.hbg : v.bg,
        color: disabled ? T.subtle : v.color,
        border: v.border,
        transition: 'all 0.15s',
        width: full ? '100%' : 'auto',
        opacity: disabled ? 0.7 : 1,
        lineHeight: 1.4,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({
  label, value, onChange, type = 'text', placeholder,
  error, hint, required, autoComplete, maxLength, style = {},
}) {
  const [focused, setFocused] = useState(false)
  const [showPw,  setShowPw]  = useState(false)
  const isPw      = type === 'password'
  const inputType = isPw ? (showPw ? 'text' : 'password') : type

  return (
    <div style={{ marginBottom: '16px' }}>
      {label && (
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: T.text, marginBottom: '6px' }}>
          {label}
          {required && <span style={{ color: T.danger, marginLeft: '3px' }} aria-hidden="true">*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          type={inputType}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength ?? (isPw ? 128 : 254)}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={!!error}
          aria-describedby={error ? `${label}-err` : undefined}
          style={{
            width: '100%',
            padding: isPw ? '10px 48px 10px 12px' : '10px 12px',
            border: `1.5px solid ${error ? T.danger : focused ? T.brand : T.border}`,
            borderRadius: '8px',
            fontSize: '14px',
            color: T.text,
            background: '#fff',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
            ...style,
          }}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShowPw(s => !s)}
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: T.muted,
              fontSize: '12px', fontWeight: '600', padding: '2px 4px',
            }}
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error && (
        <p id={`${label}-err`} role="alert"
          style={{ marginTop: '5px', fontSize: '12px', color: T.danger }}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p style={{ marginTop: '5px', fontSize: '12px', color: T.muted }}>{hint}</p>
      )}
    </div>
  )
}

// ── Password strength bar ─────────────────────────────────────────────────────
import { STRENGTH_LABELS, STRENGTH_COLORS } from '../../lib/validators.js'

export function StrengthBar({ score }) {
  return (
    <div style={{ marginTop: '-8px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            flex: 1, height: '3px', borderRadius: '4px',
            background: i <= score ? STRENGTH_COLORS[score] : '#e2e8f0',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      {score > 0 && (
        <p style={{ fontSize: '11px', color: STRENGTH_COLORS[score], fontWeight: '600' }}>
          {STRENGTH_LABELS[score]}
        </p>
      )}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE_PALETTE = {
  blue:   ['#eff6ff', '#1d4ed8', '#bfdbfe'],
  green:  [T.successBg,  T.success,  T.successBorder],
  amber:  [T.warningBg,  T.warning,  T.warningBorder],
  red:    [T.dangerBg,   T.danger,   T.dangerBorder],
  gray:   ['#f8fafc',    T.muted,    T.border],
}

export function Badge({ children, color = 'blue' }) {
  const [bg, text, border] = BADGE_PALETTE[color]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: '20px',
      fontSize: '11px', fontWeight: '700',
      background: bg, color: text, border: `1px solid ${border}`,
    }}>
      {children}
    </span>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: T.card, borderRadius: '12px',
      border: `1px solid ${T.border}`, overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  )
}

export function CardHeader({ children, right }) {
  return (
    <div style={{
      padding: '13px 22px', background: '#f8fafc',
      borderBottom: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: '#475569', textTransform: 'uppercase' }}>
        {children}
      </span>
      {right}
    </div>
  )
}
