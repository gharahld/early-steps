-- ─────────────────────────────────────────────────────────────────────────────
-- Broward Early Steps — Supabase Schema
-- Run this in your Supabase SQL editor (Database → SQL Editor → New query),
-- or from the repo: `npm run db:apply:remote` after `supabase link` (see README).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Providers (mirrors auth.users) ───────────────────────────────────────────
create table if not exists public.providers (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  created_at timestamptz not null default now()
);

-- Auto-create a provider row when a user signs up.
-- RLS on providers uses auth.uid(); inside this trigger there is no JWT, so we
-- temporarily disable row security for this INSERT only (SECURITY DEFINER scope).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);
  insert into public.providers (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── Service logs (one per billing period per child) ───────────────────────────
create table if not exists public.service_logs (
  id                   uuid primary key default gen_random_uuid(),
  provider_id          uuid not null references public.providers(id) on delete cascade,

  -- Patient info
  child_name           text,
  dob                  date,
  caregiver            text,
  address              text,
  cell                 text,
  chart_ng             text,
  service_coordinator  text,
  medicaid_number      text,
  frequency            text,
  billing_month        text,   -- stored as 'YYYY-MM'

  -- Provider info
  provider_name        text,
  provider_attestation text,

  -- Workflow
  status               text not null default 'draft'
                         check (status in ('draft', 'submitted')),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Keep updated_at current automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_service_logs_updated_at on public.service_logs;
create trigger set_service_logs_updated_at
  before update on public.service_logs
  for each row execute procedure public.set_updated_at();


-- ── Service entries (rows inside the log) ────────────────────────────────────
create table if not exists public.service_entries (
  id                   uuid primary key default gen_random_uuid(),
  log_id               uuid not null references public.service_logs(id) on delete cascade,

  date_of_service      date,
  procedure_code       text,
  fpg                  text check (fpg in ('F', 'P', 'GT')),
  rendering_provider   text,
  location_code        text,
  arrival_time         text,   -- stored as 'HH:MM'
  departure_time       text,
  travel_minutes       integer check (travel_minutes >= 0),
  caregiver_signature  text,
  sort_order           integer not null default 0
);

create index if not exists service_entries_log_id_idx
  on public.service_entries(log_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- Even if someone gets a valid JWT, they can ONLY see and modify their own data.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.providers     enable row level security;
alter table public.service_logs  enable row level security;
alter table public.service_entries enable row level security;

-- Providers: each user sees only their own row
drop policy if exists "providers: own row only" on public.providers;
create policy "providers: own row only"
  on public.providers for all
  using (auth.uid() = id);

-- Service logs: provider owns their logs
drop policy if exists "service_logs: provider owns" on public.service_logs;
create policy "service_logs: provider owns"
  on public.service_logs for all
  using (auth.uid() = provider_id);

-- Service entries: accessible only through logs the provider owns
drop policy if exists "service_entries: via log ownership" on public.service_entries;
create policy "service_entries: via log ownership"
  on public.service_entries for all
  using (
    log_id in (
      select id from public.service_logs where provider_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- Server-side auth rate limiting (Edge Functions + service role only)
-- Tracks failed login/signup attempts per email; not readable by anon/authenticated.
-- ─────────────────────────────────────────────────────────────────────────────

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
