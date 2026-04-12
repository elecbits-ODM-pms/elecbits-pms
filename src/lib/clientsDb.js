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
    cityState:        row.city_state ?? "",
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
          "employees, funding, city_state, source_row_number"
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
 * Insert a new client into Supabase. The row is marked dirty=true so the
 * sync-clients edge function won't delete it, and a future Phase 2 push
 * can write it back to the Google Sheet.
 *
 * source_row_number is set to max+1 so it won't collide with sheet rows.
 * Returns { ok: true, rowCount } on success, { ok: false, error } on failure.
 */
export async function appendNewClient({ sNo, organisationName, clientId, industry, orgSize }) {
  if (!organisationName || !clientId) {
    return { ok: false, error: "organisationName and clientId are required" };
  }

  try {
    // Get the next available source_row_number
    const { data: maxRow } = await supabase
      .from("clients")
      .select("source_row_number")
      .order("source_row_number", { ascending: false })
      .limit(1)
      .single();
    const nextRow = (maxRow?.source_row_number ?? 0) + 1;

    const { error } = await supabase.from("clients").insert({
      s_no: String(sNo ?? ""),
      organisation_name: organisationName,
      client_id: clientId,
      industry: industry || null,
      org_size: orgSize || null,
      source_row_number: nextRow,
      dirty: true,
      last_synced_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[clientDb] insert failed:", error);
      return { ok: false, error: error.message };
    }

    console.log(`[clientDb] inserted new client: ${clientId} ${organisationName} (row ${nextRow})`);
    clearClientDbCache();
    const reload = await preloadClientDb();

    // Auto-push to Google Sheet in the background
    pushDirtyToSheet().then(res => {
      if (res.ok) console.log(`[clientDb] auto-push OK: ${res.pushed} rows pushed to sheet`);
      else console.warn(`[clientDb] auto-push failed: ${res.error}`);
    });

    return { ok: true, rowCount: reload.rowCount };
  } catch (err) {
    console.error("[clientDb] insert error:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Update additional fields on an existing client row (identified by client_id).
 * Used after the initial insert to patch in contact, location, and other info
 * collected in later chat steps. Re-marks the row as dirty so the next push
 * sends the updated data to the sheet.
 */
export async function updateClientFields(clientId, fields) {
  if (!clientId) return { ok: false, error: "clientId is required" };

  const patch = {};
  if (fields.contactName)   patch.contact_name   = fields.contactName;
  if (fields.designation)   patch.designation     = fields.designation;
  if (fields.contactPhone)  patch.contact_phone   = fields.contactPhone;
  if (fields.contactEmail)  patch.contact_email   = fields.contactEmail;
  if (fields.cityState)     patch.city_state      = fields.cityState;
  if (fields.dueDiligence)  patch.due_diligence   = fields.dueDiligence;

  if (Object.keys(patch).length === 0) return { ok: true };

  patch.dirty = true; // re-mark so push picks it up

  const { error } = await supabase
    .from("clients")
    .update(patch)
    .eq("client_id", clientId);

  if (error) {
    console.error("[clientDb] updateClientFields failed:", error);
    return { ok: false, error: error.message };
  }

  console.log(`[clientDb] updated fields for ${clientId}:`, Object.keys(patch).join(", "));
  clearClientDbCache();

  // Auto-push updated data to Google Sheet
  pushDirtyToSheet().then(res => {
    if (res.ok) console.log(`[clientDb] auto-push OK: ${res.pushed} rows pushed to sheet`);
    else console.warn(`[clientDb] auto-push failed: ${res.error}`);
  });

  return { ok: true };
}

/**
 * Push dirty rows from Supabase to the Google Sheet via the push-clients
 * edge function (uses a Google service account — no browser sign-in needed).
 */
export async function pushDirtyToSheet() {
  console.log("[clientDb] invoking push-clients edge function…");
  const { data, error } = await supabase.functions.invoke("push-clients", {
    method: "POST",
  });

  if (error) {
    let detail = error.message || String(error);
    try {
      if (error.context && typeof error.context.json === "function") {
        const body = await error.context.json();
        detail = body?.error || JSON.stringify(body);
      }
    } catch { /* ignore */ }
    console.error("[clientDb] push-clients failed:", detail);
    return { ok: false, error: detail };
  }
  if (!data || data.ok !== true) {
    const msg = data?.error || "push-clients returned no data";
    console.error("[clientDb] push-clients failed:", msg);
    return { ok: false, error: msg };
  }

  console.log(`[clientDb] push-clients OK: ${data.pushed} rows pushed in ${data.durationMs}ms`);
  return { ok: true, pushed: data.pushed };
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
