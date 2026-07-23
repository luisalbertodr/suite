# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
Frontend SPA (Vite + React + TypeScript + shadcn-ui + Tailwind) for **Suite / Lipoout**, a
medical-aesthetics clinic management app. There is **no local backend**: the app talks to a
self-hosted Supabase instance at `https://supabase.lipoout.com` (API, Postgres, Auth, Edge
Functions). Only the frontend runs in this dev environment.

### Services and standard commands
Single service (the Vite frontend). Scripts live in `package.json`:
- Dev server: `npm run dev` → serves on `http://localhost:8080` (host/port fixed in `vite.config.ts`).
- Lint: `npm run lint` (eslint flat config in `eslint.config.js`; it also lints `supabase/functions/**`).
- Build: `npm run build` (production) / `npm run build:dev` (development mode).
- Preview built output: `npm run preview` (port 8080).

Use `npm` (there is a `package-lock.json`). `bun.lock*` files also exist but npm is what the
README documents and what CI-equivalent setup uses here.

### Non-obvious caveats
- **Env is required to boot**: `src/lib/supabase.ts` throws at startup if `VITE_SUPABASE_URL`
  and `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`) are missing. A committed
  `.env` already provides these pointing at the production Supabase; keep it in place to run the app.
- **Backend is live production**: `https://supabase.lipoout.com` is reachable from the VM and
  serves the real database. Do not create accounts or write data casually — there is no
  self-service signup UI, and email auto-confirm is disabled. There is no local/mock Supabase.
- **Auth gate**: the whole app (`/*`) is behind `ProtectedRoute` (Supabase email/password) or a
  superuser session. Public routes that don't require login: `/pago/:token`,
  `/cuestionario/:id/paciente`, `/consentimiento/:id/paciente`, `/superuser`. Without valid
  credentials you land on the login screen; the auth round-trip against the live backend still
  works (a wrong password returns "Credenciales incorrectas").
- **Lint is noisy but functional**: `npm run lint` currently reports many pre-existing
  `no-explicit-any` / `ban-ts-comment` errors across `src/` and `supabase/functions/`. That is the
  repo's existing state, not a broken setup — the command itself runs to completion.
- **Production deploy** (frontend → aaPanel host 112, migrations/edge functions → Supabase host
  110) is done from a Windows machine via PowerShell scripts in `scripts/` over SSH. Those hosts
  are private LAN IPs (`192.168.99.x`) and are **not** reachable from the cloud VM; do not attempt
  deploys from here.
