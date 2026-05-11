import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const MAX_FAILURES = 5
const WINDOW_MINUTES = 15

function sanitizeName(v: string): string {
  return String(v).trim().replace(/[<>"'&]/g, '').slice(0, 100)
}

function safeSignupMessage(raw: string): string {
  const msg = raw.toLowerCase()
  const looksLikePasswordPolicy =
    msg.includes('password') &&
    /length|short|at least|characters|weak|strong|requirements/.test(msg)
  if (looksLikePasswordPolicy) return raw
  return 'Unable to complete registration. Please try again.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json().catch(() => null) as {
      email?: string
      password?: string
      name?: string
    } | null
    const email = typeof body?.email === 'string' ? body.email : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const name = typeof body?.name === 'string' ? sanitizeName(body.name) : ''

    if (!email || !password || !name || name.length < 2) {
      return new Response(JSON.stringify({ error: 'Invalid request.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalized = email.trim().toLowerCase().slice(0, 254)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error('Missing Supabase env in Edge Function')
      return new Response(JSON.stringify({ error: 'Server misconfigured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const since = new Date(
      Date.now() - WINDOW_MINUTES * 60 * 1000,
    ).toISOString()

    const { count, error: countErr } = await admin
      .from('auth_rate_events')
      .select('*', { count: 'exact', head: true })
      .eq('email', normalized)
      .eq('event_type', 'signup_failure')
      .gte('created_at', since)

    if (countErr) {
      console.error(countErr)
      return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if ((count ?? 0) >= MAX_FAILURES) {
      return new Response(
        JSON.stringify({
          error: 'Too many attempts. Please try again later.',
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(WINDOW_MINUTES * 60),
          },
        },
      )
    }

    const anon = createClient(supabaseUrl, anonKey)
    const { data, error } = await anon.auth.signUp({
      email: normalized,
      password,
      options: { data: { full_name: name } },
    })

    if (error) {
      await admin.from('auth_rate_events').insert({
        email: normalized,
        event_type: 'signup_failure',
      })
      const message = safeSignupMessage(error.message ?? '')
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await admin
      .from('auth_rate_events')
      .delete()
      .eq('email', normalized)
      .eq('event_type', 'signup_failure')

    const session = data.session
    const user = data.user

    return new Response(
      JSON.stringify({
        session: session
          ? {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_in: session.expires_in,
              expires_at: session.expires_at,
              token_type: session.token_type,
              user: session.user,
            }
          : null,
        user,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
