// supabase/functions/read-project-ids/index.ts
//
// Reads column B (Project IDs) from the "Project Data and IDs" Google Sheet
// and returns the max project count for a given client ID prefix.
// Used by the frontend to avoid ID collisions with manually-added sheet rows.
//
// Deploy:
//   supabase functions deploy read-project-ids --project-ref ngxdukdmudtebykmihgw --no-verify-jwt

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SHEET_ID = Deno.env.get("PROJECT_SHEET_ID") ?? "1sdDqs4b_HlN4MQYl1VKD_04ZN6u8QJ2ZtAUX3pnlrsw";
const SHEET_NAME = Deno.env.get("PROJECT_SHEET_NAME") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
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
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      enc.encode(signingInput)
    )
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

  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) {
    return json(
      { error: "GOOGLE_SERVICE_ACCOUNT_JSON secret not set." },
      500
    );
  }

  try {
    let clientId: string | null = null;
    try {
      const body = await req.json();
      clientId = body?.clientId ?? null;
    } catch {
      /* no body */
    }

    if (!clientId) {
      return json({ error: "clientId is required in request body" }, 400);
    }

    const serviceAccount = JSON.parse(saJson);
    const accessToken = await getAccessToken(serviceAccount);

    // Resolve the sheet tab name (latest month tab)
    let tabName = SHEET_NAME;
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const allTabs = (
        meta.sheets || []
      ).map(
        (s: { properties: { title: string } }) => s.properties.title
      );
      if (!tabName && allTabs.length > 0) {
        tabName = allTabs[allTabs.length - 1];
      }
    }

    // Read column C (Project IDs) from the sheet — B is Date of Entry
    const rawRange = tabName ? `'${tabName}'!C:C` : "C:C";
    const range = encodeURIComponent(rawRange);
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`;

    const readRes = await fetch(readUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!readRes.ok) {
      const errBody = await readRes.text();
      return json(
        { error: `Sheet read failed: ${readRes.status} ${errBody}` },
        502
      );
    }

    const readData = await readRes.json();
    const values: string[][] = readData.values || [];

    // Filter for IDs matching EbZ-{clientId}-* and find the max count
    const prefix = `EbZ-${clientId}-`;
    let maxCount = 0;

    for (const row of values) {
      const cell = (row[0] || "").trim();
      if (cell.startsWith(prefix)) {
        const suffix = cell.slice(prefix.length);
        const num = parseInt(suffix, 10);
        if (!isNaN(num) && num > maxCount) maxCount = num;
      }
    }

    return json({ ok: true, maxCount, tabName });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[read-project-ids] failed:", message);
    return json({ error: message }, 500);
  }
});
