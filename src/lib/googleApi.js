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
 * Get the title of the first tab in a spreadsheet.
 * Used so we don't have to assume "Sheet1" — many users rename their first tab.
 */
export async function getFirstSheetName(spreadsheetId) {
  const info = await getSpreadsheetInfo(spreadsheetId);
  return info.sheets?.[0]?.properties?.title || "Sheet1";
}

/**
 * Read all rows from a sheet tab.
 * @param {string} spreadsheetId - The spreadsheet ID from the URL
 * @param {string} range - e.g. "Sheet1" or "Clients!A:G". If omitted, the first tab is auto-detected.
 * @returns {string[][]} Array of rows (each row is array of cell values)
 */
export async function readSheet(spreadsheetId, range) {
  const effectiveRange = range || (await getFirstSheetName(spreadsheetId));
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(effectiveRange)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Sheets read failed (range="${effectiveRange}"): ${err.error?.message || res.statusText}`);
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
export async function readSheetAsObjects(spreadsheetId, range) {
  const rows = await readSheet(spreadsheetId, range);
  if (rows.length < 2) return [];
  const headerRow = rows[0].map(h => (h || "").toString().trim());
  return rows.slice(1).map(row => {
    const obj = {};
    headerRow.forEach((h, i) => { obj[h] = row[i] || ""; });
    return obj;
  }).filter(obj => Object.values(obj).some(v => v)); // skip fully empty rows
}

/**
 * Append rows to a sheet.
 * @param {string} spreadsheetId
 * @param {string[][]} rows - Array of rows to append
 * @param {string} range - Tab name, e.g. "Sheet1" or "Clients"
 */
export async function appendToSheet(spreadsheetId, rows, range) {
  const effectiveRange = range || (await getFirstSheetName(spreadsheetId));
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(effectiveRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
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
 * Create a new Google Doc with the given title and markdown-ish content.
 * Converts basic markdown (headings, bold, tables) into Google Docs API requests.
 * @param {string} title - Document title
 * @param {string} markdownContent - Content in markdown format
 * @returns {{ documentId: string, webViewLink: string }}
 */
export async function createGoogleDoc(title, markdownContent) {
  // Step 1: Create an empty doc
  const createRes = await fetch(DOCS_BASE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ title }),
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(`Doc creation failed: ${err.error?.message || createRes.statusText}`);
  }
  const doc = await createRes.json();
  const docId = doc.documentId;

  // Step 2: Build batchUpdate requests from markdown content
  const requests = markdownToDocRequests(markdownContent);

  if (requests.length > 0) {
    const updateRes = await fetch(`${DOCS_BASE}/${docId}:batchUpdate`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ requests }),
    });
    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      console.warn("Doc content update failed:", err.error?.message || updateRes.statusText);
      // Doc was created but content insertion failed — still return the doc
    }
  }

  return {
    documentId: docId,
    webViewLink: `https://docs.google.com/document/d/${docId}/edit`,
  };
}

/**
 * Convert markdown text to Google Docs API batchUpdate requests.
 * Handles: headings (#, ##, ###), bold (**text**), plain paragraphs.
 * Inserts text sequentially from index 1.
 */
function markdownToDocRequests(markdown) {
  const lines = markdown.split("\n");
  const requests = [];
  let index = 1; // Google Docs starts at index 1

  for (const line of lines) {
    let text = line;
    let headingLevel = 0;

    // Detect heading level
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      headingLevel = headingMatch[1].length;
      text = headingMatch[2];
    }

    // Strip bold markers for plain text insertion (we'll style separately)
    const plainText = text.replace(/\*\*(.*?)\*\*/g, "$1");
    const insertText = plainText + "\n";

    // Insert the text
    requests.push({
      insertText: {
        location: { index },
        text: insertText,
      },
    });

    // Apply heading style
    if (headingLevel > 0 && headingLevel <= 6) {
      const namedStyle = headingLevel === 1 ? "HEADING_1"
        : headingLevel === 2 ? "HEADING_2"
        : headingLevel === 3 ? "HEADING_3"
        : headingLevel === 4 ? "HEADING_4"
        : headingLevel === 5 ? "HEADING_5"
        : "HEADING_6";

      requests.push({
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + insertText.length },
          paragraphStyle: { namedStyleType: namedStyle },
          fields: "namedStyleType",
        },
      });
    }

    // Apply bold to **text** segments
    let searchStart = index;
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    let offset = 0;
    while ((match = boldRegex.exec(text)) !== null) {
      // Calculate position in the plain text (without ** markers)
      const beforeBold = text.substring(0, match.index).replace(/\*\*(.*?)\*\*/g, "$1");
      const boldStart = index + beforeBold.length;
      const boldEnd = boldStart + match[1].length;

      requests.push({
        updateTextStyle: {
          range: { startIndex: boldStart, endIndex: boldEnd },
          textStyle: { bold: true },
          fields: "bold",
        },
      });
    }

    index += insertText.length;
  }

  return requests;
}

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
