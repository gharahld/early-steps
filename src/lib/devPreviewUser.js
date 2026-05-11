/**
 * Mock user for local UI / performance preview only.
 * Enabled when NODE_ENV=development && NEXT_PUBLIC_PREVIEW_DASHBOARD=true.
 * Production builds never use this (DEV is false).
 */
export const PREVIEW_USER = Object.freeze({
  id: '00000000-0000-4000-8000-000000000001',
  email: 'preview@localhost.dev',
  user_metadata: { full_name: 'Preview Provider', __preview: true },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
})
