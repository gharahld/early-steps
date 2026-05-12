# Broward Early Steps — Provider Invoice Portal

A production-ready **Next.js** + React + Supabase web app for Broward Early Steps therapy providers to log monthly service sessions, collect digital signatures, and generate CDTC-formatted PDF invoices.

---

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | React 18, **Next.js 15** (App Router)   |
| Backend  | Supabase (Auth + PostgreSQL + RLS)      |
| PDF      | jsPDF + jsPDF-AutoTable                 |
| Hosting  | Vercel                                  |

---

## Project Structure

```
early-steps/
├── public/
│   └── favicon.svg
├── src/
│   ├── app/
│   │   ├── layout.jsx            # Root layout + metadata + Providers
│   │   ├── page.jsx              # Home (client shell → App)
│   │   ├── error.jsx             # Route segment error UI
│   │   ├── forgot-password/page.jsx
│   │   ├── auth/update-password/page.jsx
│   │   └── globals.css           # Global resets + scrollbar
│   ├── components/
│   │   ├── ui/index.jsx          # Button, Input, Badge, Card, StrengthBar
│   │   └── SignaturePad.jsx      # Canvas-based signature input
│   ├── context/
│   │   └── AuthContext.jsx       # Supabase auth + 30-min session timeout
│   ├── hooks/
│   │   └── useInvoices.js        # Fetch / save invoices via Supabase
│   ├── lib/
│   │   ├── supabase.js           # Supabase client singleton
│   │   ├── authEdge.js           # Optional: login/signup via rate-limited Edge Functions
│   │   ├── rateLimiter.js        # Client-side rate limiting (5 attempts / 15 min)
│   │   └── validators.js         # Email, password strength, input sanitizers
│   ├── views/
│   │   ├── AuthPage.jsx          # Login + signup
│   │   ├── Dashboard.jsx         # Invoice list + stats
│   │   └── InvoiceForm.jsx       # Form + signature + PDF generation
│   ├── utils/
│   │   └── pdfGenerator.js       # jsPDF invoice builder
│   └── App.jsx                   # Client-side view switcher (dashboard / invoice)
├── supabase/
│   ├── schema.sql                # Full DB schema + RLS + auth_rate_events
│   ├── config.toml               # Edge Function JWT settings (see below)
│   └── functions/
│       ├── auth-rate-limited-signin/
│       └── auth-rate-limited-signup/
├── .gitignore
├── next.config.mjs
├── package.json
└── vercel.json
```

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd early-steps
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Database → SQL Editor → New query**
3. Paste the contents of `supabase/schema.sql` and run it
4. Go to **Settings → API** and copy your **Project URL** and **anon public** key

**Disable email confirmation (recommended for local testing):** This is configured in the Supabase project, not in the app code.

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **Providers** → **Email**.
3. Turn **off** **Confirm email** (disable the toggle / uncheck the option—wording varies slightly by dashboard version).
4. Save if the UI prompts you.

After that, **sign up** returns a session immediately and the app can open the dashboard without inbox verification. **Turn Confirm email back on** before production if you want verified addresses.

If you **keep** confirmation enabled: set **Authentication** → **URL Configuration** → **Site URL** to your dev URL (e.g. `http://localhost:3000`). New users see **Check your email** until they click the link.

**Signup fails with a database error:** If you applied an older `schema.sql`, the `handle_new_user` trigger could fail because **RLS on `providers`** checks `auth.uid()`, which is **null** inside the auth trigger—so the provider row never inserts and signup rolls back. Re-run the **`handle_new_user`** definition from the current `supabase/schema.sql` (or migration `supabase/migrations/20260509140000_fix_providers_trigger_rls.sql`) in the SQL Editor.

**Sign up then can’t sign in:** If **Confirm email** is on in Supabase, you must open the link in the email before password sign-in works. The app shows **Account created — check your email** after sign-up; then use **Sign in** with the same email and password. If sign-in still fails, confirm **Site URL** and **Redirect URLs** in Supabase include your app origin (e.g. `http://localhost:3000`). If auth behaves oddly with the newer **publishable** key, try the legacy **JWT anon** key in `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead.

### 3. Configure environment

Create **`.env.local`** in the project root (it is gitignored).

**Why `NEXT_PUBLIC_`?** That prefix is **Next.js** (not Supabase). It marks variables that may be used in the browser bundle. The **values** still come from Supabase → **Settings → API**.

**Required:**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
```

**Public key — use one of these** (Supabase shows one or both in the API settings):

```
# Legacy JWT “anon” / “public” key (starts with eyJ…)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Or newer publishable key (starts with sb_publishable_…)
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Optional (same file):

```
# NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS=true
```

**Git:** do not commit `.env.local` or any `.env*` file. Keep secrets in Vercel/hosting env or local files only.

If you previously used Vite, rename **`VITE_*`** → **`NEXT_PUBLIC_*`**.

### 4. Test Supabase from the CLI

After `.env.local` is filled in:

```bash
npm run check:supabase
```

This verifies the **URL + public key** and that the **`providers`** table exists (from `schema.sql`). It does not print secrets.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. (Recommended for production) Server-side auth rate limits

The UI still applies a **client-side** lockout for responsiveness. To enforce **the same limits on the server** (so clearing storage or switching browsers does not reset the window):

1. Ensure `supabase/schema.sql` has been applied **after** the block that creates `auth_rate_events` (re-run that section if your DB predates it).
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then link and deploy:
   ```bash
   supabase link --project-ref your-project-ref
   supabase functions deploy auth-rate-limited-signin
   supabase functions deploy auth-rate-limited-signup
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically on hosted functions.
3. Set in `.env.local` (and in Vercel for production):
   ```
   NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS=true
   ```
4. Rebuild (`npm run build`). If this flag is **unset** or **false**, the app uses **direct** `signIn` / `signUp` (client-only throttling).

---

## Security Features

### Authentication
- **Generic error messages** — never reveals whether an email exists
- **Password strength meter** — enforces minimum complexity on signup
- **Show/hide password toggle** — reduces caps-lock mistakes
- **Correct `autoComplete` attributes** — `current-password` vs `new-password`

### Rate Limiting
- **5 failed attempts per email per 15-minute window** before lockout (same window for client UX and optional Edge enforcement)
- **Live countdown** shown to the user (client-side UX)
- **Separate buckets** for login vs signup attempts
- **Optional server-side enforcement** — deploy `auth-rate-limited-signin` / `auth-rate-limited-signup` and set `NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS=true` (see Quick Start §6). For multi-region or very high volume, consider adding Redis-backed counters later.

### Password reset
- **Forgot password** — `/forgot-password` sends `resetPasswordForEmail` with `redirectTo` …`/auth/update-password` (same generic messaging whether the email exists).
- **New password** — `/auth/update-password` accepts the Supabase recovery session and calls `updateUser({ password })`, then signs out and returns the user to `/`.

### Session Management
- **30-minute inactivity timeout** — logs out on idle
- **Activity detection** — resets on mouse, keyboard, touch events
- **Supabase JWT auto-refresh** — tokens renewed before expiry
- **Explicit logout confirmation** — prevents accidental sign-out

### Input Handling
- All emails trimmed, lowercased, and capped at 254 chars before DB writes
- All name/text fields strip `<>"'&` to prevent stored XSS
- `maxLength` enforced on all password fields (128) and emails (254)
- React JSX auto-escapes all rendered values — no `dangerouslySetInnerHTML`

### Database (Supabase RLS)
- Row-Level Security enabled on all tables
- `service_logs` policy: `provider_id = auth.uid()` — own rows only
- `service_entries` policy: accessible only through logs you own
- Even a valid JWT cannot read another provider's data

### Content Security Policy
- Next.js does not ship a strict CSP meta tag by default (hydration and inline chunks need careful nonce-based CSP). Add a **nonce-based** or platform-level CSP when you harden further; `vercel.json` still sets other security headers.

---

## Deployment (Vercel)

Vercel runs **`next build`** for this repo. **`vercel.json`** sets `framework: nextjs`, **`npm ci`** for installs, and security + cache headers for `/_next/static/*`. **`.nvmrc`** requests Node **20** (confirm under **Project → Settings → General → Node.js Version** if builds pick the wrong runtime).

### Option A — Dashboard (recommended first time)

1. Sign in at [vercel.com](https://vercel.com) and open **[Add New… → Project](https://vercel.com/new)**.
2. **Import** the GitHub repo **`gharahld/early-steps`** (install the Vercel GitHub app for the org if prompted).
3. Leave **Framework Preset** as **Next.js**, **Root Directory** as **`.`**, build/output commands as defaults (Vercel will run `npm run build`).
4. Expand **Environment Variables** and add (same names as **§3 Configure environment**):
   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL  
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` **or** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — whichever Supabase shows under API (never the service role)  
   - Optional: `NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS` = `true` if Edge auth is deployed  
   Apply to **Production** and **Preview** (and **Development** if you use Vercel’s dev integration) so preview deployments can call Supabase.
5. Click **Deploy**. After the first deploy, open **Domains** and note your production URL (and `*.vercel.app` preview URLs).

### Option B — Vercel CLI

Requires a valid login (`vercel whoami` should succeed).

```bash
vercel login          # once, if token is missing or invalid
cd early-steps
vercel link           # connect this folder to a Vercel project (create new or link existing)
npm run vercel:preview   # preview deployment
npm run vercel:prod    # production deployment
```

Local build check (same as CI / Vercel build):

```bash
npm ci && npm run build
```

**Supabase — URLs (required for auth + password reset):**

1. **Site URL** — your primary production origin (e.g. `https://portal.example.org`).
2. **Redirect URLs** — add every origin that may complete auth or recovery in the browser, for example:
   - `http://localhost:3000/**` (or `http://localhost:3000` and paths as your Supabase version allows)
   - `https://your-production-domain.com/**`
   - Each Vercel preview host you use, e.g. `https://your-app-git-branch-team.vercel.app/**`

Password reset emails use **`/auth/update-password`** as the return path. Ensure URLs like:

- `http://localhost:3000/auth/update-password`
- `https://<your-production-host>/auth/update-password`
- `https://<preview-host>/auth/update-password`

are allowed (wildcard patterns depend on your Supabase project settings; when in doubt, add explicit URLs).

### Production troubleshooting: “Signed up / signed in but no dashboard”

The shell on `/` shows **Dashboard** only when Supabase auth has set a **`user`** in React state. There is no separate `/dashboard` URL.

1. **Still on the login form after “Sign in”** — Session never stuck in the app. Typical causes:
   - **Vercel env** — `NEXT_PUBLIC_SUPABASE_URL` and one of `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` must match the **same** Supabase project you used when creating the user. Redeploy after changing env vars (values are inlined at build time).
   - **`NEXT_PUBLIC_AUTH_VIA_EDGE_FUNCTIONS=true`** — Deploy **`auth-rate-limited-signin`** (and signup if used) and ensure **`public.auth_rate_events`** exists (from `supabase/schema.sql`). If the function returns 404/500, sign-in fails or never completes. Easiest narrow test: set this flag to **`false`** on Vercel and redeploy so the browser uses direct `signInWithPassword` (keep Edge off until functions + tables are verified).
   - **Email confirmation** — If **Confirm email** is on, the user must click the link before password sign-in returns a session (see §2 above).

2. **Stuck on full-screen “Loading…”** — Initial session is taking too long or failing before `user` is set. Hard-refresh once; if it persists, check the browser **Console** and **Network** tab for blocked requests to your Supabase host.

3. **Dashboard appears but “Failed to load invoices”** — The user **is** signed in; fix database/RLS: run **`supabase/schema.sql`** on the project and confirm `npm run check:supabase` passes.

**Search engines:** `metadata.robots` and `public/robots.txt` discourage indexing this internal portal.

**Repo CI:** A workflow template lives at **`ops/github-actions-ci.yml`**. Copy it to **`.github/workflows/ci.yml`** to enable Actions on push/PR to `main`/`master` (lint + build with placeholder `NEXT_PUBLIC_*` vars). If GitHub rejects pushing workflow files over HTTPS, use a credential with the **`workflow`** OAuth scope (e.g. `gh auth refresh -s workflow`) or add the file via the GitHub web UI once.

**Node:** Use **Node 20+** locally and on Vercel (`package.json` `engines`).

---

## PDF Output

Clicking **Submit & Download PDF** produces a letter-size PDF with:

- Dark header with provider and billing month
- Patient & billing info grid
- Attestation banner
- Service entries table (auto-table with alternating rows)
- Procedure / location legend
- Provider name + drawn signature image
- CDTC Fiscal Processing section (blank for admin)
- Page numbers in footer

Filename format: `ES_Invoice_[ChildName]_[BillingMonth].pdf`

---

## TODO / Future Enhancements

- [ ] Optional Redis / shared store for rate limits across many Edge regions
- [ ] Admin view with CDTC fiscal fields editable
- [ ] Email notifications on invoice submission
- [ ] Audit log table for compliance
- [ ] Mobile-responsive service entry table
