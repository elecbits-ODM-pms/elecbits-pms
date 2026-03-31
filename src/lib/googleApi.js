/*
 * Google API wrappers — Sheets v4, Drive v3, Docs v1
 * All methods require a valid access token from googleAuth.js
 */

import { getAccessToken } from "./googleAuth.js";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const DOCS_BASE = "https://docs.googleapis.com/v1/documents";

function headers() {
  const token = getAccessToken();
  if (!token) throw new Error("Not authenticated with Google. Please sign in first.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/* ═══════════════════════════════════════════════════════════════════
   SHEETS API v4
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Read all rows from a sheet tab.
 * @param {string} spreadsheetId - The spreadsheet ID from the URL
 * @param {string} range - e.g. "Sheet1" or "Clients!A:G"
 * @returns {string[][]} Array of rows (each row is array of cell values)
 */
export async function readSheet(spreadsheetId, range = "Sheet1") {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Sheets read failed: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.values || [];
}

/**
 * Read rows and return as array of objects (first row = headers).
 * @param {string} spreadsheetId
 * @param {string} range
 * @returns {Object[]}
 */
export async function readSheetAsObjects(spreadsheetId, range = "Sheet1") {
  const rows = await readSheet(spreadsheetId, range);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ""; });
    return obj;
  }).filter(obj => Object.values(obj).some(v => v)); // skip fully empty rows
}

/**
 * Append rows to a sheet.
 * @param {string} spreadsheetId
 * @param {string[][]} rows - Array of rows to append
 * @param {string} range - Tab name, e.g. "Sheet1" or "Clients"
 */
export async function appendToSheet(spreadsheetId, rows, range = "Sheet1") {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ values: rows }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Sheets append failed: ${err.error?.message || res.statusText}`);
  }
  return res.json();
}

/**
 * Update a specific cell or range.
 * @param {string} spreadsheetId
 * @param {string} range - e.g. "Sheet1!A2:B2"
 * @param {string[][]} values
 */
export async function updateSheet(spreadsheetId, range, values) {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Sheets update failed: ${err.error?.message || res.statusText}`);
  }
  return res.json();
}

/**
 * Get spreadsheet metadata (title, sheet tabs, etc.)
 * @param {string} spreadsheetId
 */
export async function getSpreadsheetInfo(spreadsheetId) {
  const url = `${SHEETS_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Sheets info failed: ${err.error?.message || res.statusText}`);
  }
  return res.json();
}

/* ═══════════════════════════════════════════════════════════════════
   DRIVE API v3
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Search for files in Google Drive.
 * @param {Object} opts
 * @param {string} opts.query - Search query (file name)
 * @param {string} opts.mimeType - Filter by MIME type (optional)
 *   - Sheets: "application/vnd.google-apps.spreadsheet"
 *   - Docs:   "application/vnd.google-apps.document"
 *   - Folders: "application/vnd.google-apps.folder"
 * @param {number} opts.maxResults - Max files to return (default 20)
 * @returns {{ id, name, mimeType, modifiedTime, webViewLink }[]}
 */
export async function searchDriveFiles({ query, mimeType, maxResults = 20 } = {}) {
  const qParts = [];
  if (query) qParts.push(`name contains '${query.replace(/'/g, "\\'")}'`);
  if (mimeType) qParts.push(`mimeType = '${mimeType}'`);
  qParts.push("trashed = false");

  const q = encodeURIComponent(qParts.join(" and "));
  const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,webViewLink)");
  const url = `${DRIVE_BASE}/files?q=${q}&fields=${fields}&pageSize=${maxResults}&orderBy=modifiedTime desc`;

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Drive search failed: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.files || [];
}

/**
 * List all spreadsheets in the user's Drive.
 * @param {number} maxResults
 */
export async function listSpreadsheets(maxResults = 50) {
  return searchDriveFiles({
    mimeType: "application/vnd.google-apps.spreadsheet",
    maxResults,
  });
}

/**
 * List all Google Docs in the user's Drive.
 * @param {number} maxResults
 */
export async function listDocs(maxResults = 50) {
  return searchDriveFiles({
    mimeType: "application/vnd.google-apps.document",
    maxResults,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   DOCS API v1
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Read a Google Doc's content as plain text.
 * @param {string} documentId
 * @returns {{ title: string, text: string }}
 */
export async function readDoc(documentId) {
  const url = `${DOCS_BASE}/${documentId}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Docs read failed: ${err.error?.message || res.statusText}`);
  }
  const doc = await res.json();

  // Extract plain text from the document body
  let text = "";
  const extractText = (elements) => {
    for (const el of elements || []) {
      if (el.paragraph) {
        for (const pe of el.paragraph.elements || []) {
          if (pe.textRun) text += pe.textRun.content;
        }
      }
      if (el.table) {
        for (const row of el.table.tableRows || []) {
          for (const cell of row.tableCells || []) {
            extractText(cell.content);
            text += "\t";
          }
          text += "\n";
        }
      }
    }
  };
  extractText(doc.body?.content);

  return { title: doc.title || "", text: text.trim() };
}
