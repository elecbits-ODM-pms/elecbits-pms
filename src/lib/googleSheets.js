/*
 * Google Sheets & Drive Integration for Client Database
 *
 * Uses Google Sheets API v4 + Drive API v3 via OAuth2 tokens.
 * Falls back to the public gviz API for read-only access when not signed in.
 *
 * SETUP:
 * 1. Set VITE_GOOGLE_CLIENT_ID in .env.local (OAuth2 Client ID)
 * 2. Set VITE_GSHEET_ID in .env.local (default client spreadsheet)
 * 3. Enable Google Sheets API, Drive API, Docs API in Google Cloud Console
 * 4. See src/lib/googleAuth.js for full setup instructions
 */

import { isGoogleSignedIn } from "./googleAuth.js";
import { readSheetAsObjects, appendToSheet, getSpreadsheetInfo } from "./googleApi.js";

const SHEET_ID = import.meta.env.VITE_GSHEET_ID || "";

/* ═══════════════════════════════════════════════════════════════════
   CLIENT DATABASE SEARCH — public CSV (no auth required)
   ───────────────────────────────────────────────────────────────────
   Reads the "Client Data and IDs" tab of the spreadsheet specified by
   VITE_CLIENT_SHEET_ID via the gviz CSV endpoint. The sheet must be
   shared so anyone with the link can view, OR Published to the web.

   Sheet schema (1-indexed columns as they appear in the actual sheet):
     A  S. no.
     B  Organisation Name           (the searchable field)
     C  Category/Industry
     D  Client category/org size
     E  Client ID
     F  Client Folder
     G  Point of Contact
     H  Designation
     I  Contact Number
     J  Email ID
     K  Company Due Diligence
     L  Number of employees
     M  Funding Information
   ═══════════════════════════════════════════════════════════════════ */

// Hardcoded fallback so the deployed bundle always works without depending on
// platform env vars. The sheet is shared as "Anyone with the link → Viewer",
// so the ID is not a secret (it's effectively a public URL). Override locally
// by setting VITE_CLIENT_SHEET_ID in .env.local if you ever need to point at
// a different sheet for development.
const CLIENT_SHEET_ID = import.meta.env.VITE_CLIENT_SHEET_ID || "1VmZ1qKn5o7P5hefjngQoYcnahQUwI7Y3ejdgvGCB2bs";
const CLIENT_SHEET_NAME = "Client Data and IDs";

let _clientCsvCache = null;
let _clientCsvPromise = null;

/** Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped quotes, CRLF) */
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
      } else {
        field += c;
      }
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

/**
 * Fetch & cache the client CSV. Throws ClientDbError on any failure so the
 * caller can distinguish "couldn't reach the sheet" from "sheet has no match".
 */
export class ClientDbError extends Error {
  constructor(message, cause) { super(message); this.name = "ClientDbError"; this.cause = cause; }
}

async function fetchClientCsvRows(force = false) {
  if (!force && _clientCsvCache) return _clientCsvCache;
  if (!force && _clientCsvPromise) return _clientCsvPromise;
  if (!CLIENT_SHEET_ID) {
    const msg = "VITE_CLIENT_SHEET_ID is not set — restart the dev server after editing .env.local";
    console.error("[clientDb]", msg);
    throw new ClientDbError(msg);
  }
  const url = `https://docs.google.com/spreadsheets/d/${CLIENT_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CLIENT_SHEET_NAME)}`;
  _clientCsvPromise = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const msg = `HTTP ${res.status} fetching client sheet — make sure it's shared as "Anyone with the link → Viewer"`;
        console.error("[clientDb]", msg);
        throw new ClientDbError(msg);
      }
      const text = await res.text();
      // If Google returned an HTML error page instead of CSV, bail out cleanly
      if (text.trimStart().startsWith("<")) {
        const msg = "Sheet returned HTML instead of CSV — it isn't publicly accessible";
        console.error("[clientDb]", msg);
        throw new ClientDbError(msg);
      }
      const rows = parseCsv(text);
      _clientCsvCache = rows;
      console.log(`[clientDb] Loaded ${rows.length} rows from client database`);
      return rows;
    } catch (err) {
      if (err instanceof ClientDbError) throw err;
      console.error("[clientDb] CSV fetch error:", err);
      throw new ClientDbError(`Network error: ${err.message}`, err);
    } finally {
      _clientCsvPromise = null;
    }
  })();
  return _clientCsvPromise;
}

/** Collapse internal whitespace/newlines so multi-line cells render in a single line. */
function cleanCell(raw) {
  return (raw || "").replace(/\s*[\r\n]+\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}

/** Extract a single email address from a messy cell that may contain labels, newlines, or multiple values. */
function cleanEmail(raw) {
  if (!raw) return "";
  const match = raw.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  return match ? match[0] : cleanCell(raw);
}

const MAX_MATCHES = 20;

/**
 * Search column B (Organisation Name) by splitting the query into whitespace-separated
 * words and matching every row whose name contains EVERY word (case-insensitive substring).
 *
 * Examples:
 *   "schneider"   → "Schneider Electric"
 *   "tata mot"    → "Tata Motors", "Tata Motor Finance" (both words must be present)
 *   "bos motor"   → "Boson Motors"
 *
 * Results are ordered by relevance (exact → prefix → substring on the full query) and
 * capped at MAX_MATCHES so the multi-match UI stays usable on broad queries like "ele".
 *
 * @param {string} query
 * @returns {Promise<Array<{
 *   rowNumber: number, sNo: string, organisationName: string,
 *   industry: string, orgSize: string, clientId: string, clientFolder: string,
 *   contactName: string, designation: string, contactPhone: string, contactEmail: string,
 *   dueDiligence: string, employees: string, funding: string
 * }>>}
 */
export async function searchClients(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  const queryWords = q.split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return [];

  const rows = await fetchClientCsvRows();
  if (rows.length < 2) return []; // need at least header + one data row

  const matches = [];
  // Row 0 is the header row; data starts at row 1.
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const orgName = cleanCell(row[1]); // Column B
    if (!orgName) continue;
    const lower = orgName.toLowerCase();
    // Multi-word AND: every query word must appear somewhere in the name
    if (!queryWords.every(w => lower.includes(w))) continue;
    // Relevance score on the original (joined) query: 0 = exact, 1 = prefix, 2 = substring
    const rank = lower === q ? 0 : lower.startsWith(q) ? 1 : 2;
    matches.push({
      _rank:            rank,
      rowNumber:        i + 1,
      sNo:              cleanCell(row[0]),
      organisationName: orgName,
      industry:         cleanCell(row[2]),
      orgSize:          cleanCell(row[3]),
      clientId:         cleanCell(row[4]),
      clientFolder:     cleanCell(row[5]),
      contactName:      cleanCell(row[6]),
      designation:      cleanCell(row[7]),
      contactPhone:     cleanCell(row[8]),
      contactEmail:     cleanEmail(row[9]),
      dueDiligence:     cleanCell(row[10]),
      employees:        cleanCell(row[11]),
      funding:          cleanCell(row[12]),
    });
  }
  matches.sort((a, b) => a._rank - b._rank || a.organisationName.localeCompare(b.organisationName));
  return matches.slice(0, MAX_MATCHES).map(m => {
    const out = { ...m };
    delete out._rank;
    return out;
  });
}

/** Force the next searchClients call to refetch the CSV (e.g. after the sheet was updated). */
export function clearClientDbCache() {
  _clientCsvCache = null;
  _clientCsvPromise = null;
}

/**
 * Kick off the CSV fetch ahead of time (e.g. when the chat opens) so the first
 * searchClients call is instant and connection errors surface immediately.
 * Resolves to { ok: true, rowCount } on success or { ok: false, error } on failure.
 */
export async function preloadClientDb() {
  try {
    const rows = await fetchClientCsvRows();
    const dataRows = rows.slice(1).filter(r => cleanCell(r[1]));
    const firstFive = dataRows.slice(0, 5).map(r => cleanCell(r[1]));
    console.log("[clientDb] first 5 client names:", firstFive);
    return { ok: true, rowCount: dataRows.length };
  } catch (err) {
    return { ok: false, error: err instanceof ClientDbError ? err.message : err.message };
  }
}

/** True if VITE_CLIENT_SHEET_ID is set. Useful for status badges. */
export function isClientDbConfigured() {
  return !!CLIENT_SHEET_ID;
}

/**
 * Append a new client row to the public Client Data and IDs sheet.
 * Writes columns A (S.no), B (Organisation Name), C (Client ID).
 *
 * REQUIRES: the user is signed in via signInWithGoogle() AND that account
 * has edit permission on the sheet. Reads are anonymous (gviz CSV) but
 * writes always go through the OAuth-protected Sheets API v4.
 *
 * Throws ClientDbError on any failure (auth, network, API). The caller is
 * expected to catch and fall back to a "saved locally" warning so the
 * project creation flow can still proceed.
 *
 * @param {{ sNo: number|string, organisationName: string, clientId: string }} client
 * @returns {Promise<{ ok: true }>}
 */
export async function appendNewClientToDb({ sNo, organisationName, clientId }) {
  if (!CLIENT_SHEET_ID) {
    throw new ClientDbError("Client database sheet ID not configured");
  }
  if (!organisationName || !clientId) {
    throw new ClientDbError("organisationName and clientId are required");
  }
  if (!isGoogleSignedIn()) {
    throw new ClientDbError("Sign in with Google to save new clients to the sheet");
  }
  // Sheets API v4 range syntax: tab name with spaces must be wrapped in
  // single quotes; encodeURIComponent handles the % encoding.
  const range = `'${CLIENT_SHEET_NAME}'!A:C`;
  const row = [String(sNo ?? ""), organisationName, clientId];
  try {
    await appendToSheet(CLIENT_SHEET_ID, [row], range);
    // Invalidate the read cache so a subsequent searchClients/preload picks
    // up the new row instead of the stale snapshot.
    clearClientDbCache();
    console.log(`[clientDb] appended new client: ${clientId} ${organisationName}`);
    return { ok: true };
  } catch (err) {
    console.error("[clientDb] append failed:", err);
    throw new ClientDbError(`Sheet write failed: ${err.message}`, err);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   READ CLIENTS — uses Sheets API v4 when signed in, gviz fallback
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Fetch all client rows from the Google Sheet.
 * If signed in with Google OAuth → uses Sheets API v4 (can access private sheets).
 * If not signed in → falls back to gviz public API (sheet must be shared publicly).
 * Returns: [{ clientName, clientId, industry, size, contactName, contactEmail, dateAdded }]
 */
export async function fetchClientsFromSheet(spreadsheetId) {
  const sheetId = spreadsheetId || SHEET_ID;
  if (!sheetId) {
    // Legacy OAuth-protected sheet path. The new public client database
    // (searchClients/preloadClientDb) handles all client lookups now, so
    // an unconfigured legacy sheet is expected and harmless — silently no-op.
    return [];
  }

  // Use Sheets API v4 if signed in
  if (isGoogleSignedIn()) {
    try {
      const rows = await readSheetAsObjects(sheetId);
      console.log(`[gsheet] read ${rows.length} rows from spreadsheet ${sheetId}`);
      if (rows.length === 0) {
        console.warn("[gsheet] sheet returned 0 rows — check the first tab actually has data with a header row");
        return [];
      }
      // Build a case/space-insensitive header lookup so we accept many naming variants
      const pickField = (row, ...aliases) => {
        const norm = (s) => (s || "").toString().toLowerCase().replace(/[\s_-]+/g, "");
        const map = {};
        Object.keys(row).forEach(k => { map[norm(k)] = row[k]; });
        for (const a of aliases) {
          const v = map[norm(a)];
          if (v) return v;
        }
        return "";
      };
      const mapped = rows.map(row => ({
        clientName:   pickField(row, "Client Name", "ClientName", "Company", "Company Name", "Name"),
        clientId:     pickField(row, "Client ID", "ClientID", "ID", "Code"),
        industry:     pickField(row, "Industry", "Sector"),
        size:         pickField(row, "Size", "Company Size"),
        contactName:  pickField(row, "Contact Name", "Contact", "Primary Contact", "POC"),
        contactEmail: pickField(row, "Contact Email", "Email", "E-mail"),
        dateAdded:    pickField(row, "Date Added", "Created", "Created At"),
      }));
      const filtered = mapped.filter(r => r.clientName);
      if (filtered.length === 0 && mapped.length > 0) {
        console.warn(
          "[gsheet] mapped 0 clients — header names did not match any known aliases. Headers in sheet:",
          Object.keys(rows[0])
        );
      }
      return filtered;
    } catch (err) {
      console.error("[gsheet] API read error, falling back to gviz:", err);
      return fetchClientsViaGviz(sheetId);
    }
  }

  // Fallback: public gviz API
  return fetchClientsViaGviz(sheetId);
}

/** Legacy gviz read (works without auth if sheet is shared publicly) */
async function fetchClientsViaGviz(sheetId) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
    const res = await fetch(url);
    const text = await res.text();

    const jsonStr = text.match(/google\.visualization\.Query\.setResponse\((.+)\);?$/s);
    if (!jsonStr || !jsonStr[1]) {
      console.warn("[gsheet] Could not parse gviz response");
      return [];
    }

    const json = JSON.parse(jsonStr[1]);
    const rows = json.table?.rows || [];

    return rows.map(row => {
      const cell = (i) => {
        const c = row.c?.[i];
        if (!c) return "";
        return c.v != null ? String(c.v) : (c.f || "");
      };
      return {
        clientName:   cell(0),
        clientId:     cell(1),
        industry:     cell(2),
        size:         cell(3),
        contactName:  cell(4),
        contactEmail: cell(5),
        dateAdded:    cell(6),
      };
    }).filter(r => r.clientName);
  } catch (err) {
    console.error("[gsheet] gviz fetch error:", err);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════════
   WRITE CLIENT — uses Sheets API v4 (requires OAuth)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Append a new client row to the Google Sheet.
 * Requires OAuth sign-in (Sheets API v4).
 */
export async function appendClientToSheet({ clientName, clientId, industry, size, contactName, contactEmail }, spreadsheetId) {
  const sheetId = spreadsheetId || SHEET_ID;
  if (!sheetId) {
    console.warn("[gsheet] No spreadsheet ID — skipping write");
    return false;
  }

  if (!isGoogleSignedIn()) {
    console.warn("[gsheet] Not signed in — cannot write to sheet");
    return false;
  }

  try {
    const row = [
      clientName,
      clientId,
      industry || "",
      size || "",
      contactName || "",
      contactEmail || "",
      new Date().toISOString().slice(0, 10),
    ];

    await appendToSheet(sheetId, [row]);
    return true;
  } catch (err) {
    console.error("[gsheet] write error:", err);
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   COMPANY SEARCH — DuckDuckGo Instant Answer API (no auth needed)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Search for a company online using DuckDuckGo Instant Answer API.
 * Returns { abstract, url, image } or null.
 */
export async function searchCompanyInfo(companyName) {
  if (!companyName || companyName.length < 2) return null;

  try {
    const q = encodeURIComponent(companyName + " company");
    const res = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`);
    const data = await res.json();

    if (data.Abstract || data.AbstractText) {
      return {
        abstract: data.AbstractText || data.Abstract || "",
        url: data.AbstractURL || data.Results?.[0]?.FirstURL || "",
        source: data.AbstractSource || "DuckDuckGo",
        image: data.Image || "",
      };
    }

    if (data.RelatedTopics?.length > 0) {
      const first = data.RelatedTopics[0];
      return {
        abstract: first.Text || "",
        url: first.FirstURL || "",
        source: "DuckDuckGo",
        image: "",
      };
    }

    return null;
  } catch (err) {
    console.error("[search] error:", err);
    return null;
  }
}
