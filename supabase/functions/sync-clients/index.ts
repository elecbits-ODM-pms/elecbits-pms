// supabase/functions/sync-clients/index.ts
//
// Pulls the public "Client Data and IDs" Google Sheet via the gviz CSV
// endpoint and upserts every row into public.clients. Hard-deletes any DB
// rows whose source_row_number is no longer in the sheet (catches both
// trailing and middle deletions).
//
// Triggered manually from the chat header refresh button via:
//   supabase.functions.invoke("sync-clients")
//
// SECRETS — Supabase edge functions automatically have these injected, no
// extra `supabase secrets set` needed:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (bypasses RLS)
//
// Optional overrides via `supabase secrets set`:
//   CLIENT_SHEET_ID    — defaults to the elecbits public client sheet
//   CLIENT_SHEET_NAME  — defaults to "Client Data and IDs"
//
// Deploy:  supabase functions deploy sync-clients --project-ref ngxdukdmudtebykmihgw

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHEET_ID   = Deno.env.get("CLIENT_SHEET_ID")   ?? "1VmZ1qKn5o7P5hefjngQoYcnahQUwI7Y3ejdgvGCB2bs";
const SHEET_NAME = Deno.env.get("CLIENT_SHEET_NAME") ?? "Client Data and IDs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ─────────────────────────────────────────────────────────────────────────────
// CSV parsing — minimal RFC-4180-ish parser, same as the browser-side version
// ─────────────────────────────────────────────────────────────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
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
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip CR */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

const cleanCell = (raw: string | undefined): string =>
  (raw ?? "").replace(/\s*[\r\n]+\s*/g, " ").replace(/\s{2,}/g, " ").trim();

const cleanEmail = (raw: string | undefined): string => {
  if (!raw) return "";
  const m = raw.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  return m ? m[0] : cleanCell(raw);
};

interface ClientRow {
  s_no: string;
  organisation_name: string;
  industry: string | null;
  org_size: string | null;
  client_id: string | null;
  client_folder: string | null;
  contact_name: string | null;
  designation: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  due_diligence: string | null;
  employees: string | null;
  funding: string | null;
  payment_terms: string | null;
  billing_info: string | null;
  shipping_info: string | null;
  city_state: string | null;
  sarthak_friends: string | null;
  source_row_number: number;
  last_synced_at: string;
  dirty: boolean;
}

function rowToClient(row: string[], sheetRowNumber: number): ClientRow | null {
  const sNo = cleanCell(row[0]);
  const orgName = cleanCell(row[1]);
  if (!sNo || !orgName) return null;
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
// HTTP handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const startedAt = Date.now();

  // Edge functions get SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injected by
  // the runtime — no `supabase secrets set` needed.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in function env" }, 500);
  }

  try {
    // 1. Fetch CSV
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    const res = await fetch(csvUrl);
    if (!res.ok) {
      return json({ error: `Sheet fetch failed: HTTP ${res.status} ${res.statusText}`, csvUrl }, 502);
    }
    const text = await res.text();
    if (text.trimStart().startsWith("<")) {
      return json({ error: "Sheet returned HTML instead of CSV — it isn't publicly accessible", csvUrl }, 502);
    }

    // 2. Parse → client rows
    const rows = parseCsv(text);
    if (rows.length < 2) {
      return json({ error: `Sheet has only ${rows.length} rows — expected header + data` }, 502);
    }
    const clients: ClientRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const c = rowToClient(rows[i], i + 1);
      if (c) clients.push(c);
    }

    // 3. Upsert via service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: upsertErr, count: upsertedCount } = await supabase
      .from("clients")
      .upsert(clients, { onConflict: "source_row_number", count: "exact", ignoreDuplicates: false });
    if (upsertErr) {
      return json({ error: `Upsert failed: ${upsertErr.message}`, code: upsertErr.code }, 500);
    }

    // 4. Hard-delete rows whose row number is no longer in the sheet
    const liveRowNumbers = clients.map(c => c.source_row_number);
    const inListLiteral = `(${liveRowNumbers.join(",")})`;
    const { data: deleted, error: delErr } = await supabase
      .from("clients")
      .delete({ count: "exact" })
      .not("source_row_number", "in", inListLiteral)
      .select("source_row_number");
    if (delErr) {
      return json({ error: `Delete failed: ${delErr.message}`, code: delErr.code }, 500);
    }

    const durationMs = Date.now() - startedAt;
    return json({
      ok: true,
      rowCount: clients.length,
      upsertedCount: upsertedCount ?? clients.length,
      deletedCount: deleted?.length ?? 0,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-clients] failed:", message);
    return json({ error: message }, 500);
  }
});
