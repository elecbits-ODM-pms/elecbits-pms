/*
 * Google Sheets Integration for Client Database
 *
 * SETUP INSTRUCTIONS:
 * ──────────────────
 * 1. Open your Google Sheet with client data
 * 2. Share the sheet: File → Share → "Anyone with the link" → Viewer
 * 3. Copy the Sheet ID from the URL:
 *    https://docs.google.com/spreadsheets/d/[THIS_IS_THE_SHEET_ID]/edit
 * 4. Set VITE_GSHEET_ID in .env.local
 *
 * 5. For WRITING new rows, deploy a Google Apps Script web app:
 *    - Open the sheet → Extensions → Apps Script
 *    - Paste the code below → Deploy → Web App → "Anyone" can access
 *    - Copy the deployed URL → Set VITE_GSHEET_WRITE_URL in .env.local
 *
 * GOOGLE APPS SCRIPT CODE (paste into Apps Script editor):
 * ─────────────────────────────────────────────────────────
 *   function doPost(e) {
 *     var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 *     var data = JSON.parse(e.postData.contents);
 *     sheet.appendRow(data.row);
 *     return ContentService
 *       .createTextOutput(JSON.stringify({ status: "ok" }))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   }
 *
 *   function doGet(e) {
 *     return ContentService
 *       .createTextOutput(JSON.stringify({ status: "ok" }))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   }
 *
 * Expected sheet columns (Row 1 = headers):
 *   A: Client Name
 *   B: Client ID
 *   C: Industry
 *   D: Size
 *   E: Contact Name
 *   F: Contact Email
 *   G: Date Added
 */

const SHEET_ID = import.meta.env.VITE_GSHEET_ID || "";
const WRITE_URL = import.meta.env.VITE_GSHEET_WRITE_URL || "";

/**
 * Fetch all client rows from the Google Sheet.
 * Uses the Google Visualization API (no API key needed, sheet must be shared).
 * Returns: [{ clientName, clientId, industry, size, contactName, contactEmail, dateAdded }]
 */
export async function fetchClientsFromSheet() {
  if (!SHEET_ID) {
    console.warn("[gsheet] No VITE_GSHEET_ID configured — skipping sheet read");
    return [];
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
    const res = await fetch(url);
    const text = await res.text();

    // Response is JSONP-like: google.visualization.Query.setResponse({...})
    const jsonStr = text.match(/google\.visualization\.Query\.setResponse\((.+)\);?$/s);
    if (!jsonStr || !jsonStr[1]) {
      console.warn("[gsheet] Could not parse gviz response");
      return [];
    }

    const json = JSON.parse(jsonStr[1]);
    const rows = json.table?.rows || [];
    const cols = json.table?.cols || [];

    // Map rows to objects — skip header row (gviz already excludes it)
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
    }).filter(r => r.clientName); // skip empty rows
  } catch (err) {
    console.error("[gsheet] fetch error:", err);
    return [];
  }
}

/**
 * Append a new client row to the Google Sheet.
 * Uses a deployed Google Apps Script web app (see setup instructions above).
 */
export async function appendClientToSheet({ clientName, clientId, industry, size, contactName, contactEmail }) {
  if (!WRITE_URL) {
    console.warn("[gsheet] No VITE_GSHEET_WRITE_URL configured — skipping sheet write");
    return false;
  }

  try {
    const row = [
      clientName,
      clientId,
      industry,
      size,
      contactName || "",
      contactEmail || "",
      new Date().toISOString().slice(0, 10),
    ];

    await fetch(WRITE_URL, {
      method: "POST",
      mode: "no-cors", // Apps Script doesn't send CORS headers on POST
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row }),
    });

    // no-cors means we can't read the response, but the write still goes through
    return true;
  } catch (err) {
    console.error("[gsheet] write error:", err);
    return false;
  }
}

/**
 * Search for a company online using DuckDuckGo Instant Answer API.
 * Returns { abstract, url, image } or null.
 * Note: This is a best-effort search — may not find all companies.
 */
export async function searchCompanyInfo(companyName) {
  if (!companyName || companyName.length < 2) return null;

  try {
    // DuckDuckGo Instant Answer API (no key needed, supports CORS)
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

    // Fallback: check related topics
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
