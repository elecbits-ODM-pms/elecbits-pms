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

## Client database sync

The "Client Data and IDs" Google Sheet is mirrored into the `public.clients`
Supabase table. The browser reads from Supabase, never directly from the
sheet. A **manual refresh button** in the chat header (the `Client DB · N`
badge) triggers a Supabase edge function that pulls the sheet on demand.

### Architecture

```
[Google Sheet] ──gviz CSV──▶ [Edge function: sync-clients] ──upsert──▶ [public.clients]
                                       ▲                                       │
                                       │                                       │
                                  invoked by                              read by
                                       │                                       │
                                       └──── [Browser refresh button]  ◀──────┘
```

### One-time setup

1. **Create the table**
   - Open the Supabase SQL editor for project `ngxdukdmudtebykmihgw`.
   - Paste & run `supabase/migrations/001_create_clients_table.sql`.
   - Verify: `select count(*) from public.clients;` returns `0`.

2. **Deploy the edge function**
   ```bash
   supabase functions deploy sync-clients --project-ref ngxdukdmudtebykmihgw
   ```
   No secrets configuration is needed — Supabase edge functions automatically
   have `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` injected from the
   project's own credentials.

3. **First sync**
   - Open the New Project chat in the deployed app.
   - Click the `Client DB · loading` badge in the header (or wait — it
     auto-preloads). On the next click of the badge, the edge function runs
     and the badge shows `Client DB · 421` (or whatever the live row count is).
   - Verify in Supabase SQL editor: `select count(*) from public.clients;`

### Manual refresh

Click the **`Client DB · N`** badge in the chat header at any time. It calls
the `sync-clients` edge function, which:

- Fetches the public sheet via gviz CSV
- Upserts every row by `source_row_number` (the sheet's row position)
- Hard-deletes any DB rows whose row number is no longer in the sheet
- Returns `{ ok, rowCount, upsertedCount, deletedCount, durationMs }`

Typical sync takes 1-2 seconds for ~500 clients.

### Local one-off sync (skip the edge function)

A standalone Node script does the same upsert without going through the
edge function. Useful for local development before the function is deployed:

```bash
SUPABASE_URL=https://ngxdukdmudtebykmihgw.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node scripts/sync-clients-from-sheet.mjs
```

The service role key is **NEVER** safe in the browser or in `.env.local` —
keep it in your shell environment only.

### Phase 2 (planned, not yet implemented)

Phase 1 is sync from sheet → DB only. Phase 2 will add the push direction:
- New-client writes go straight into `public.clients` via Supabase RLS
  (`dirty=true`).
- A new edge function uses a Google service account to push `dirty=true`
  rows back into the sheet.
- The browser drops the OAuth Sheets API dependency for client writes.

Until Phase 2 ships, new-client writes still use the in-browser OAuth Sheets
flow (`Connect Google Account`).

