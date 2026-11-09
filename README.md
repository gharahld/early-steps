# Broward Early Steps — Provider Forms Portal

A **Next.js** + React web app for Broward Early Steps therapy providers to fill out, sign, download, and print two forms, each as its own PDF:

- **Monthly Service Log / Invoice** — matches the V2024 Broward Early Steps form (8 visits per page; extra visits continue on another identical page).
- **Daily SOAP Note** — matches the Grounded Ventures, LLC daily SOAP note.

Everything runs in the browser: forms, drawn signatures, and the provider profile are saved in the browser's local storage on that device, and PDFs are generated client-side. There is no login and no backend.

---

## Tech Stack

| Layer    | Technology                                        |
|----------|---------------------------------------------------|
| Frontend | React 18, **Next.js 15** (App Router, static export) |
| Storage  | Browser `localStorage` (this device only)         |
| PDF      | jsPDF                                             |
| Hosting  | **Cloudflare Workers static assets**              |

---

## Project Structure

```
early-steps/
├── public/
│   ├── _headers                  # Security headers, CSP, caching (Cloudflare)
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── app/
│   │   ├── layout.jsx            # Root layout + metadata + viewport
│   │   ├── page.jsx              # Home (client shell → App)
│   │   ├── error.jsx             # Error UI
│   │   └── globals.css           # Global styles + mobile layout rules
│   ├── components/
│   │   ├── ui/index.jsx          # Button, Badge, Card, design tokens
│   │   └── SignaturePad.jsx      # Draw-to-sign canvas (shows saved signatures)
│   ├── hooks/
│   │   ├── useInvoices.js        # List / save invoices
│   │   ├── useSoapNotes.js       # List / save SOAP notes
│   │   └── useProviderProfile.js # Provider name, title, license
│   ├── lib/
│   │   ├── localStore.js         # localStorage persistence
│   │   └── validators.js         # Input sanitizers
│   ├── utils/
│   │   ├── pdfGenerator.js       # V2024 invoice PDF + shared PDF helpers
│   │   └── soapNotePdf.js        # Daily SOAP note PDF
│   ├── views/
│   │   ├── Dashboard.jsx         # Profile, invoice list, SOAP note list
│   │   ├── InvoiceForm.jsx       # Invoice form + signatures
│   │   └── SoapNoteForm.jsx      # SOAP note form + signature
│   └── App.jsx                   # Client-side view switcher
├── supabase/                     # Not used by the app (kept from the former Supabase backend)
├── next.config.mjs               # output: 'export' → ./out
├── wrangler.jsonc                # Cloudflare config (serves ./out)
└── package.json
```

---

## Quick Start

```bash
git clone https://github.com/gharahld/early-steps.git
cd early-steps
npm install
npm run dev          # http://localhost:3000
```

No environment variables are required.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run lint` | ESLint |
| `npm run build` | Static export to `out/` |
| `npm run verify` | Lint + build |
| `npm run preview` | Build, then serve `out/` with Wrangler at http://localhost:8787 (same headers as production) |
| `npm run deploy` | Build, then deploy to Cloudflare with Wrangler (first time: `npx wrangler login`) |

---

## Using the App

1. **Provider Profile** (home screen): enter name, title, and license # once; they fill in automatically on new forms.
2. **+ New Invoice** or **+ New SOAP Note**: fill in what you need — nothing is required.
3. Signatures (provider, caregiver per visit, therapist) are optional and drawn on the device. Unsigned lines print blank so they can be signed by hand.
4. **Download PDF** / **Print PDF** save the form and output it; **Submit & Download** marks an invoice as submitted.

The biller attestation and the **CDTC Fiscal Processing** table print blank for office use.

---

## Data & Privacy

- Data is stored **only in the browser on the device** where it was entered. It does not sync between devices.
- Clearing browser data deletes saved forms — keep the downloaded PDFs as the record.
- Anyone using the same browser can open saved forms; use a device and browser account dedicated to the provider.
- Signatures are stored as PNG data URLs and rendered only as images (never as HTML).

---

## Deployment (Cloudflare)

`next build` produces a static site in `out/`, served by [Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/). There is no Worker script, binding, or secret.

- `wrangler.jsonc` — Worker name `early-steps-portal`, assets directory `./out`, unknown paths return `404.html`.
- `public/_headers` — `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, Content-Security-Policy, `noindex`, and immutable caching for `/_next/static/*`.

**Automatic deploys from GitHub (Workers Builds):** the Cloudflare Worker is connected to `gharahld/early-steps`; each push to `main` runs:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

**Manual deploy:** `npm run deploy`.

Site URL: `https://early-steps-portal.<your-subdomain>.workers.dev`. Add a custom domain under **Workers & Pages → early-steps-portal → Settings → Domains & Routes**.

---

## PDF Output

| Form | Filename |
| --- | --- |
| Monthly Service Log / Invoice | `ES_Invoice_[ChildName]_[BillingMonth].pdf` |
| Daily SOAP Note | `SOAP_Note_[Child]_[Date].pdf` |

Both are US Letter, laid out from scans of the paper forms. PDFs ask viewers to print at 100% (`PrintScaling: None`); if a printout looks shrunk, choose **Actual size** in the print dialog.

---

## TODO / Future Enhancements

- [ ] Admin view with biller attestation and CDTC fiscal fields editable
- [ ] Optional sync/backup across devices (requires a backend and login)
- [ ] Export / import of saved forms
