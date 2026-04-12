/*
 * clientsDb.js — Supabase-backed client database (Phase 1: read path)
 *
 * Reads the public.clients table that the sync-clients GitHub Action keeps in
 * step with the "Client Data and IDs" Google Sheet. The browser no longer
 * fetches the sheet directly.
 *
 * The exports here mirror the previous googleSheets.js shape so
 * ProjectCreationChat only needs to swap one import line:
 *   - searchClients(query)        — multi-word AND substring search
 *   - preloadClientDb()           — warms an in-memory cache, returns row count
 *   - isClientDbConfigured()      — true if Supabase env vars are present
 *   - ClientDbError               — distinct error type for fetch failures
 *
 * Phase 2 will add appendNewClient(...) here (Supabase insert with dirty=true)
 * and the cron will push it to the sheet.
 */

import { supabase } from "./supabase.js";

const MAX_MATCHES = 20;

// In-memory cache so repeated searches hit the network once. Cleared on
// preloadClientDb() and on any explicit invalidation.
let _cache = null;
let _cachePromise = null;

export class ClientDbError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "ClientDbError";
    this.cause = cause;
  }
}

/** True if the Supabase client is wired up. (Always true in this app — supabase.js bails out early if env vars are missing.) */
export function isClientDbConfigured() {
  return !!supabase;
}

/** Drop the in-memory cache so the next call refetches. */
export function clearClientDbCache() {
  _cache = null;
  _cachePromise = null;
}

/** Map a Supabase row to the shape ProjectCreationChat expects. */
function rowToClient(row) {
  return {
    rowNumber:        row.source_row_number ?? null,
    sNo:              row.s_no ?? "",
    organisationName: row.organisation_name ?? "",
    industry:         row.industry ?? "",
    orgSize:          row.org_size ?? "",
    clientId:         row.client_id ?? "",
    clientFolder:     row.client_folder ?? "",
    contactName:      row.contact_name ?? "",
    designation:      row.designation ?? "",
    contactPhone:     row.contact_phone ?? "",
    contactEmail:     row.contact_email ?? "",
    dueDiligence:     row.due_diligence ?? "",
    employees:        row.employees ?? "",
    funding:          row.funding ?? "",
  };
}

async function fetchAllClients(force = false) {
  if (!force && _cache) return _cache;
  if (!force && _cachePromise) return _cachePromise;

  _cachePromise = (async () => {
    try {
      // The table is small (~500 rows). Fetch everything once and search in JS.
      // If the table grows past ~5k rows we should switch to a server-side RPC.
      const { data, error } = await supabase
        .from("clients")
        .select(
          "s_no, organisation_name, industry, org_size, client_id, client_folder, " +
          "contact_name, designation, contact_phone, contact_email, due_diligence, " +
          "employees, funding, source_row_number"
        )
        .order("source_row_number", { ascending: true })
        .limit(10000);

      if (error) {
        console.error("[clientDb] supabase select failed:", error);
        throw new ClientDbError(`Supabase read failed: ${error.message}`, error);
      }

      const clients = (data || []).map(rowToClient);
      _cache = clients;
      console.log(`[clientDb] loaded ${clients.length} rows from Supabase`);
      return clients;
    } catch (err) {
      if (err instanceof ClientDbError) throw err;
      throw new ClientDbError(`Unexpected error: ${err.message}`, err);
    } finally {
      _cachePromise = null;
    }
  })();

  return _cachePromise;
}

/**
 * Preload the client cache so the first searchClients() is instant and any
 * connection failure surfaces before the user types. Resolves to
 * { ok: true, rowCount } on success or { ok: false, error } on failure.
 */
export async function preloadClientDb() {
  try {
    const clients = await fetchAllClients(true); // force refresh on preload
    const firstFive = clients.slice(0, 5).map(c => c.organisationName);
    console.log("[clientDb] first 5 client names:", firstFive);
    return { ok: true, rowCount: clients.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Trigger the `sync-clients` Supabase edge function. The function fetches the
 * Google Sheet server-side (using the service role key, bypassing RLS) and
 * upserts every row into public.clients. Then we drop the local cache and
 * re-read so the badge reflects the new row count.
 *
 * Returns { ok: true, rowCount, upsertedCount, deletedCount, durationMs }
 * on success, or { ok: false, error } on failure.
 */
export async function triggerSheetSync() {
  console.log("[clientDb] invoking sync-clients edge function…");
  const t0 = Date.now();
  const { data, error } = await supabase.functions.invoke("sync-clients", {
    method: "POST",
  });
  const transportMs = Date.now() - t0;

  if (error) {
    // Supabase JS wraps non-2xx responses in FunctionsHttpError — try to
    // extract the real body so we can surface a meaningful message.
    let detail = error.message || String(error);
    try {
      if (error.context && typeof error.context.json === "function") {
        const body = await error.context.json();
        detail = body?.error || JSON.stringify(body);
      }
    } catch { /* ignore parse failure */ }
    console.error("[clientDb] sync-clients invoke failed:", detail, error);
    return { ok: false, error: detail };
  }
  if (!data || data.ok !== true) {
    const msg = data?.error || "edge function returned no data";
    console.error("[clientDb] sync-clients failed:", msg);
    return { ok: false, error: msg };
  }

  console.log(
    `[clientDb] sync-clients OK in ${data.durationMs}ms (transport ${transportMs}ms): ` +
    `${data.rowCount} rows, ${data.upsertedCount} upserts, ${data.deletedCount} deletes`
  );

  // Drop the in-memory cache and re-read fresh data so the badge updates.
  clearClientDbCache();
  const reload = await preloadClientDb();
  if (!reload.ok) return reload;
  return { ok: true, rowCount: reload.rowCount, ...data };
}

/**
 * Multi-word AND substring search on organisation_name (case-insensitive).
 * Results ranked exact > prefix > substring, alphabetised within each tier,
 * capped at MAX_MATCHES.
 */
export async function searchClients(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  const queryWords = q.split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return [];

  const clients = await fetchAllClients();
  if (clients.length === 0) return [];

  const matches = [];
  for (const c of clients) {
    const orgName = c.organisationName;
    if (!orgName) continue;
    const lower = orgName.toLowerCase();
    if (!queryWords.every(w => lower.includes(w))) continue;
    const rank = lower === q ? 0 : lower.startsWith(q) ? 1 : 2;
    matches.push({ ...c, _rank: rank });
  }

  matches.sort(
    (a, b) => a._rank - b._rank || a.organisationName.localeCompare(b.organisationName)
  );

  return matches.slice(0, MAX_MATCHES).map(m => {
    const out = { ...m };
    delete out._rank;
    return out;
  });
}
