/**
 * Public Supabase key for browser / Edge function calls.
 * Supports legacy JWT anon key or newer publishable key (Supabase dashboard).
 */
export function getSupabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  )
}
