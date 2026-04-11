# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

---

## Client database sync (Phase 1)

The "Client Data and IDs" Google Sheet is mirrored into the `public.clients`
Supabase table by a GitHub Action that runs every 5 minutes. The browser reads
from Supabase, never from the sheet directly.

### One-time setup

1. **Create the table**
   - Open the Supabase SQL editor for project `ngxdukdmudtebykmihgw`.
   - Paste & run `supabase/migrations/001_create_clients_table.sql`.
   - Verify: `SELECT count(*) FROM public.clients;` returns 0.

2. **Add GitHub Actions secrets**
   Repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_URL` — `https://ngxdukdmudtebykmihgw.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` — copy from Supabase dashboard → **Project Settings → API → service_role secret**. ⚠ This key bypasses RLS — keep it out of the browser bundle.

3. **First sync**
   - Repo → **Actions → Sync clients from Google Sheet → Run workflow** (manual dispatch).
   - Once it completes, `SELECT count(*) FROM public.clients;` should show ~421.
   - From there, the cron runs every 5 min automatically.

### Local one-off sync

```bash
SUPABASE_URL=https://ngxdukdmudtebykmihgw.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node scripts/sync-clients-from-sheet.mjs
```

### Phase 2 (planned)

Phase 1 is **pull-only** (sheet → DB). Phase 2 adds the push direction:
- New-client writes go to Supabase (`dirty=true`).
- The cron uses a Google service account to push `dirty=true` rows up to the sheet, then clears the flag.
- Browser drops the OAuth Sheets API dependency entirely for client writes.

Until Phase 2 ships, new-client writes still go through OAuth Sheets API in
the browser (the existing `Connect Google Account` flow).

