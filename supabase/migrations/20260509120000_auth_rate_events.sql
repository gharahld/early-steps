-- Server-side auth rate limiting (Edge Functions). Safe to run if already in schema.sql.

create table if not exists public.auth_rate_events (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  event_type  text not null
    check (event_type in ('login_failure', 'signup_failure')),
  created_at  timestamptz not null default now()
);

create index if not exists auth_rate_events_email_type_created_idx
  on public.auth_rate_events (email, event_type, created_at desc);

alter table public.auth_rate_events enable row level security;

revoke all on table public.auth_rate_events from anon, authenticated;
grant select, insert, update, delete on table public.auth_rate_events to service_role;
