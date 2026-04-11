#!/usr/bin/env node
/**
 * sync-clients-from-sheet.mjs
 *
 * Pulls the public "Client Data and IDs" Google Sheet via the gviz CSV
 * endpoint and upserts every row into public.clients in Supabase. Rows that
 * exist in the DB but no longer exist in the sheet are HARD DELETED (per the
 * project decision).
 *
 * Run locally:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/sync-clients-from-sheet.mjs
 *
 * In CI: this is invoked from .github/workflows/sync-clients.yml every 5 min.
 *
 * Phase 2 (later): also reads `dirty=true` rows and pushes them back to the
 * sheet via the Google Sheets API using a service account.
 */

import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID    = process.env.CLIENT_SHEET_ID    || "1VmZ1qKn5o7P5hefjngQoYcnahQUwI7Y3ejdgvGCB2bs";
const SHEET_NAME  = process.env.CLIENT_SHEET_NAME  || "Client Data and IDs";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[sync] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

// ─────────────────────────────────────────────────────────────────────────────
// CSV parsing — same minimal RFC-4180 parser as src/lib/googleSheets.js
// ─────────────────────────────────────────────────────────────────────────────

function parseCsv(text) {
  const rows = [];
  let cur = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ""; }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === '\r') { /* skip CR */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

function cleanCell(raw) {
  return (raw || "").replace(/\s*[\r\n]+\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}

function cleanEmail(raw) {
  if (!raw) return "";
  const m = raw.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  return m ? m[0] : cleanCell(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet → row objects
// ─────────────────────────────────────────────────────────────────────────────

function rowToClient(row, sheetRowNumber) {
  const sNo = cleanCell(row[0]);
  const orgName = cleanCell(row[1]);
  if (!sNo || !orgName) return null; // skip empty / header-malformed rows
  return {
    s_no:              sNo,
    organisation_name: orgName,
    industry:          cleanCell(row[2])  || null,
    org_size:          cleanCell(row[3])  || null,
    client_id:         cleanCell(row[4])  || null,
    client_folder:     cleanCell(row[5])  || null,
    contact_name:      cleanCell(row[6])  || null,
    designation:       cleanCell(row[7])  || null,
    contact_phone:     cleanCell(row[8])  || null,
    contact_email:     cleanEmail(row[9]) || null,
    due_diligence:     cleanCell(row[10]) || null,
    employees:         cleanCell(row[11]) || null,
    funding:           cleanCell(row[12]) || null,
    payment_terms:     cleanCell(row[13]) || null,
    billing_info:      cleanCell(row[14]) || null,
    shipping_info:     cleanCell(row[15]) || null,
    city_state:        cleanCell(row[16]) || null,
    sarthak_friends:   cleanCell(row[17]) || null,
    source_row_number: sheetRowNumber,
    last_synced_at:    new Date().toISOString(),
    dirty:             false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date();
  console.log(`[sync] starting at ${startedAt.toISOString()}`);
  console.log(`[sync] sheet: ${CSV_URL}`);

  // 1. Fetch CSV
  const res = await fetch(CSV_URL);
  if (!res.ok) {
    throw new Error(`Sheet fetch failed: HTTP ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error("Sheet returned HTML — it isn't publicly accessible");
  }

  // 2. Parse rows
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error(`Sheet has only ${rows.length} rows — expected header + data`);
  }

  // 3. Map → client objects (skip blanks). Keyed by source_row_number, which
  //    is inherently unique. The sheet's S.no column has duplicates so we
  //    can't rely on it as a sync key.
  const clients = [];
  for (let i = 1; i < rows.length; i++) {
    const client = rowToClient(rows[i], i + 1); // sheet rows are 1-based; +1 to skip header
    if (client) clients.push(client);
  }
  console.log(`[sync] parsed ${clients.length} valid clients from ${rows.length - 1} data rows`);

  // 4. Upsert into Supabase
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: upsertErr, count: upsertedCount } = await supabase
    .from("clients")
    .upsert(clients, { onConflict: "source_row_number", count: "exact", ignoreDuplicates: false });

  if (upsertErr) {
    throw new Error(`Upsert failed: ${upsertErr.message}`);
  }
  console.log(`[sync] upserted ${upsertedCount ?? clients.length} rows`);

  // 5. Hard-delete rows whose source_row_number is no longer present in the
  //    parsed set. Catches both trailing deletions AND middle rows that were
  //    emptied (org_name cleared → rowToClient returned null → not in clients).
  //    For ~500 rows the in-list filter is fine; if this grows past ~5000 we
  //    should switch to a stored proc that diffs server-side.
  const liveRowNumbers = clients.map(c => c.source_row_number);
  const inListLiteral = `(${liveRowNumbers.join(",")})`;
  const { data: deleted, error: delErr } = await supabase
    .from("clients")
    .delete({ count: "exact" })
    .not("source_row_number", "in", inListLiteral)
    .select("source_row_number");

  if (delErr) {
    throw new Error(`Delete failed: ${delErr.message}`);
  }
  if (deleted && deleted.length > 0) {
    console.log(
      `[sync] hard-deleted ${deleted.length} rows missing from sheet:`,
      deleted.slice(0, 10).map(d => d.source_row_number),
      deleted.length > 10 ? "…" : ""
    );
  } else {
    console.log("[sync] no rows to delete");
  }

  const endedAt = new Date();
  const durationMs = endedAt - startedAt;
  console.log(`[sync] done in ${durationMs}ms`);
}

main().catch(err => {
  console.error("[sync] FAILED:", err.message);
  console.error(err.stack);
  process.exit(1);
});
