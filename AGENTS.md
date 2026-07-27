# AGENTS.md

## Cursor Cloud specific instructions

This repo's primary product is a **Vite + React + TypeScript + shadcn-ui** frontend for the "Lipoout Suite" clinic-management app. It talks to a **remote self-hosted Supabase** backend at `https://supabase.lipoout.com` (there is no local Supabase stack wired up for the frontend).

### Services and commands (frontend = the only service to run locally)
- Dev server: `npm run dev` → serves on `http://localhost:8080` (port fixed in `vite.config.ts`).
- Lint: `npm run lint`. Build: `npm run build`. Preview: `npm run preview` (also port 8080).
- Standard scripts live in `package.json`; do not duplicate them elsewhere.

### Non-obvious caveats
- The Supabase client (`src/lib/supabase.ts`) **throws at startup if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing**. A committed `.env` already provides working values pointing at the remote server, so the app boots and can log in as long as `supabase.lipoout.com` is network-reachable.
- The app is almost entirely behind Supabase Auth (`ProtectedRoute`). To exercise core functionality you must log in. Test credentials are provided via the `LIPOOUT_TEST_EMAIL` / `LIPOOUT_TEST_PASSWORD` environment secrets; read them from env at runtime (do not hardcode). Default route after login redirects `/` → `/agenda`.
- `npm run lint` uses ESLint flat config and lints `supabase/functions/**` (Deno edge functions) too, so it reports many pre-existing errors in that code — that is expected and unrelated to the frontend.
- The subprojects (`style-sync-agent/`, `supabase/` edge functions + migrations, `vfp/`, `openwa/`, `scripts/`) are backend/legacy-sync/deploy tooling and are **not** needed to run or develop the frontend locally. `scripts/*.ps1` deployment scripts are Windows/PowerShell and target on-prem servers.
- Deployment is manual to on-prem servers (see `.cursor/rules/*.mdc`); do not attempt to deploy from a cloud agent unless explicitly asked.
