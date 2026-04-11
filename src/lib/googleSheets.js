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

import { getAccessToken, isGoogleSignedIn } from "./googleAuth.js";
import { readSheetAsObjects, appendToSheet, getSpreadsheetInfo } from "./googleApi.js";

const SHEET_ID = import.meta.env.VITE_GSHEET_ID || "";

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
    console.warn("[gsheet] No spreadsheet ID configured — skipping sheet read");
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
