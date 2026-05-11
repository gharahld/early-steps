// ── Sanitizers ────────────────────────────────────────────────────────────────

/** Normalize an email: trim whitespace, lowercase, enforce max length. */
export const sanitizeEmail = (v) =>
  String(v).trim().toLowerCase().slice(0, 254)

/**
 * Strip characters that could be used for XSS in rendered text.
 * React's JSX auto-escapes output, but we sanitize at input so stored
 * values are clean before reaching the DB or the PDF generator.
 */
export const sanitizeName = (v) =>
  String(v).trim().replace(/[<>"'&]/g, '').slice(0, 100)

export const sanitizeText = (v) =>
  String(v).trim().replace(/[<>"'&]/g, '').slice(0, 500)


// ── Validators ────────────────────────────────────────────────────────────────

/** RFC 5322-ish email check. */
export const isValidEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)

/**
 * Password strength score 0-5.
 * 0 = empty/very weak  5 = very strong
 */
export const passwordStrength = (pw) => {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

export const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
export const STRENGTH_COLORS = ['#e2e8f0', '#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#059669']


// ── Auth-specific validation ──────────────────────────────────────────────────

/**
 * Validate login form fields.
 * Returns a plain object of field → error string (empty = valid).
 */
export const validateLogin = ({ email, password }) => {
  const errors = {}
  const cleanEmail = sanitizeEmail(email)

  if (!cleanEmail)               errors.email    = 'Email is required.'
  else if (!isValidEmail(cleanEmail)) errors.email = 'Enter a valid email address.'

  if (!password) errors.password = 'Password is required.'

  return errors
}

/**
 * Validate signup form fields.
 */
export const validateSignup = ({ email, password, name }) => {
  const errors = validateLogin({ email, password })
  const cleanName = sanitizeName(name)

  if (!cleanName || cleanName.length < 2)
    errors.name = 'Enter your full name (at least 2 characters).'

  if (password && password.length < 8)
    errors.password = 'Password must be at least 8 characters.'
  // Strength meter still guides UX; Supabase enforces server policy if configured.

  return errors
}

/** Password + confirmation for reset / update-password flows. */
export const validatePasswordReset = ({ password, confirmPassword }) => {
  const errors = {}
  if (!password) errors.password = 'Password is required.'
  else if (password.length < 8)
    errors.password = 'Password must be at least 8 characters.'
  else if (password.length > 128)
    errors.password = 'Password must be at most 128 characters.'

  if (confirmPassword === undefined || confirmPassword === '') {
    if (password) errors.confirmPassword = 'Confirm your password.'
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

/**
 * Generic, non-revealing auth error.
 * Never expose whether the email exists in the system.
 */
export const GENERIC_AUTH_ERROR = 'Invalid email or password.'

/**
 * Generic signup error — do not surface Supabase messages that confirm an email is already registered.
 */
export const GENERIC_SIGNUP_ERROR =
  'Unable to complete registration. Please try again.'

/**
 * Safe message for Supabase signUp failures: generic by default; only pass through
 * obvious server password-policy text (does not enumerate accounts).
 */
export const safeSignupErrorMessage = (error) => {
  if (!error?.message) return GENERIC_SIGNUP_ERROR
  const msg = error.message.toLowerCase()
  const looksLikePasswordPolicy =
    msg.includes('password') &&
    /length|short|at least|characters|weak|strong|requirements/.test(msg)
  if (looksLikePasswordPolicy) return error.message
  return GENERIC_SIGNUP_ERROR
}
