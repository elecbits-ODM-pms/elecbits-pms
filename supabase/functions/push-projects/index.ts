// supabase/functions/push-projects/index.ts
//
// Reads dirty=true rows from public.projects and appends them to the
// "Project Data and IDs" Google Sheet using a service account.
// After a successful append, marks rows as dirty=false.
//
// REQUIRED SECRET (already set for push-clients):
//   GOOGLE_SERVICE_ACCOUNT_JSON — the full JSON key file contents
//
// Optional overrides:
//   PROJECT_SHEET_ID    — defaults to the elecbits project sheet
//   PROJECT_SHEET_NAME  — defaults to "Project Data and IDs"
//
// Deploy:
//   supabase functions deploy push-projects --project-ref ngxdukdmudtebykmihgw --no-verify-jwt

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHEET_ID   = Deno.env.get("PROJECT_SHEET_ID")   ?? "1sdDqs4b_HlN4MQYl1VKD_04ZN6u8QJ2ZtAUX3pnlrsw";
const SHEET_NAME = Deno.env.get("PROJECT_SHEET_NAME") ?? "";

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
// Google Service Account JWT → Access Token
// ─────────────────────────────────────────────────────────────────────────────

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const pemBody = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput))
  );
  const jwt = `${signingInput}.${base64url(signature)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange failed: ${tokenRes.status} ${err}`);
  }
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const saJson      = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing" }, 500);
  }
  if (!saJson) {
    return json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON secret not set." }, 500);
  }

  try {
    const serviceAccount = JSON.parse(saJson);
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Optional: accept a project_id in the body to force-push a specific project
    let forceProjectId: string | null = null;
    try {
      const body = await req.json();
      forceProjectId = body?.project_id ?? null;
    } catch { /* no body or invalid JSON — that's fine */ }

    // If force-pushing, mark the target row as dirty first
    if (forceProjectId) {
      await supabase
        .from("projects")
        .update({ dirty: true })
        .eq("project_id", forceProjectId);
    }

    // 1. Read dirty project rows
    const { data: dirtyRows, error: readErr } = await supabase
      .from("projects")
      .select("*")
      .eq("dirty", true)
      .order("created_at", { ascending: true });

    if (readErr) {
      return json({ error: `Read dirty rows failed: ${readErr.message}` }, 500);
    }
    if (!dirtyRows || dirtyRows.length === 0) {
      return json({ ok: true, pushed: 0, message: "No dirty rows to push", durationMs: Date.now() - startedAt });
    }

    // 2. Get Google access token via service account
    const accessToken = await getAccessToken(serviceAccount);

    // 3. Build rows to append matching the actual sheet layout (columns A:X):
    //    A: S. No.
    //    B: Date of Entry
    //    C: Project - ID
    //    D: Project Name
    //    E: Type of Services (project_tag)
    //    F: Technology / Capability
    //    G: LLD - PM
    //    H: Milestone Tracker
    //    I: Audit Checklist - PM
    //    J: Product ID - Technical /GW - Link
    //    K: Audit Checklist - Product
    //    L: Initial Customer Contact (client_name)
    //    M: Senior PM
    //    N: PM
    //    O: TM
    //    P: Senior HW
    //    Q: HW
    //    R: Senior FW
    //    S: FW
    //    T: Industrial Design
    //    U: Timeline
    //    V: Start Date
    //    W: End Date
    //    X: Remarks
    const sheetRows = dirtyRows.map((r) => [
      "",                          // A: S. No.
      r.date_of_entry  ?? "",      // B: Date of Entry
      r.project_id     ?? "",      // C: Project - ID
      r.name           ?? "",      // D: Project Name
      r.project_tag    ?? "",      // E: Type of Services
      "",                          // F: Technology / Capability
      r.lld_url        ?? "",      // G: LLD - PM
      "",                          // H: Milestone Tracker
      "",                          // I: Audit Checklist - PM
      "",                          // J: Product ID - Technical /GW - Link
      "",                          // K: Audit Checklist - Product
      r.client_name    ?? "",      // L: Initial Customer Contact
      "",                          // M: Senior PM
      "",                          // N: PM
      "",                          // O: TM
      "",                          // P: Senior HW
      "",                          // Q: HW
      "",                          // R: Senior FW
      "",                          // S: FW
      "",                          // T: Industrial Design
      "",                          // U: Timeline
      r.start_date     ?? "",      // V: Start Date
      r.end_date       ?? "",      // W: End Date
      "",                          // X: Remarks
    ]);

    // 4. Resolve the sheet tab name — find the latest month tab (or use configured name)
    let tabName = SHEET_NAME;
    let allTabs: string[] = [];
    // Always fetch metadata so we know all tab names
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      allTabs = (meta.sheets || []).map((s: { properties: { title: string } }) => s.properties.title);
      if (!tabName) {
        // Use the LAST tab (most recent month)
        tabName = allTabs[allTabs.length - 1] ?? "";
      }
    }

    // 5. Append to Google Sheet via Sheets API v4
    const rawRange = tabName ? `'${tabName}'!A:X` : "A:X";
    const range = encodeURIComponent(rawRange);
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

    const appendRes = await fetch(appendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: sheetRows }),
    });

    if (!appendRes.ok) {
      const errBody = await appendRes.text();
      return json({ error: `Sheet append failed: ${appendRes.status} ${errBody}`, tabName, range: rawRange }, 502);
    }

    const appendData = await appendRes.json();
    const updatedRows = appendData.updates?.updatedRows ?? sheetRows.length;
    const updatedRange = appendData.updates?.updatedRange ?? "";

    // 5. Mark pushed rows as dirty=false
    const dirtyIds = dirtyRows.map((r) => r.id);
    const { error: updateErr } = await supabase
      .from("projects")
      .update({ dirty: false, last_synced_at: new Date().toISOString() })
      .in("id", dirtyIds);

    if (updateErr) {
      return json({
        error: `Rows appended to sheet but failed to clear dirty flag: ${updateErr.message}`,
        pushed: updatedRows,
      }, 500);
    }

    const durationMs = Date.now() - startedAt;
    return json({
      ok: true,
      pushed: updatedRows,
      dirtyCleared: dirtyIds.length,
      tabName,
      allTabs,
      updatedRange,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[push-projects] failed:", message);
    return json({ error: message }, 500);
  }
});
