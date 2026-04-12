// supabase/functions/push-clients/index.ts
//
// Reads dirty=true rows from public.clients and appends them to the
// "Client Data and IDs" Google Sheet using a service account.
// After a successful append, marks rows as dirty=false.
//
// REQUIRED SECRET (set once via `supabase secrets set`):
//   GOOGLE_SERVICE_ACCOUNT_JSON — the full JSON key file contents
//
// Optional overrides:
//   CLIENT_SHEET_ID    — defaults to the elecbits public client sheet
//   CLIENT_SHEET_NAME  — defaults to "Client Data and IDs"
//
// Deploy:
//   supabase functions deploy push-clients --project-ref ngxdukdmudtebykmihgw --no-verify-jwt

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

  // Import the PEM private key
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

  // Exchange JWT for access token
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
    return json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON secret not set. Run: supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<json>'" }, 500);
  }

  try {
    const serviceAccount = JSON.parse(saJson);
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Read dirty rows
    const { data: dirtyRows, error: readErr } = await supabase
      .from("clients")
      .select("*")
      .eq("dirty", true)
      .order("source_row_number", { ascending: true });

    if (readErr) {
      return json({ error: `Read dirty rows failed: ${readErr.message}` }, 500);
    }
    if (!dirtyRows || dirtyRows.length === 0) {
      return json({ ok: true, pushed: 0, message: "No dirty rows to push", durationMs: Date.now() - startedAt });
    }

    // 2. Get Google access token via service account
    const accessToken = await getAccessToken(serviceAccount);

    // 3. Build rows to append (columns A:R matching the sheet layout)
    const sheetRows = dirtyRows.map((r) => [
      r.s_no              ?? "",
      r.organisation_name ?? "",
      r.industry          ?? "",
      r.org_size          ?? "",
      r.client_id         ?? "",
      r.client_folder     ?? "",
      r.contact_name      ?? "",
      r.designation       ?? "",
      r.contact_phone     ?? "",
      r.contact_email     ?? "",
      r.due_diligence     ?? "",
      r.employees         ?? "",
      r.funding           ?? "",
      r.payment_terms     ?? "",
      r.billing_info      ?? "",
      r.shipping_info     ?? "",
      r.city_state        ?? "",
      r.sarthak_friends   ?? "",
    ]);

    // 4. Append to Google Sheet via Sheets API v4
    const range = encodeURIComponent(`'${SHEET_NAME}'!A:R`);
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

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
      return json({ error: `Sheet append failed: ${appendRes.status} ${errBody}` }, 502);
    }

    const appendData = await appendRes.json();
    const updatedRows = appendData.updates?.updatedRows ?? sheetRows.length;

    // 5. Mark pushed rows as dirty=false
    const dirtyIds = dirtyRows.map((r) => r.id);
    const { error: updateErr } = await supabase
      .from("clients")
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
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[push-clients] failed:", message);
    return json({ error: message }, 500);
  }
});
