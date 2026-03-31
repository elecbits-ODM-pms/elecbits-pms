/*
 * Google OAuth2 Authentication via Google Identity Services (GIS)
 *
 * SETUP:
 * 1. Go to Google Cloud Console → APIs & Services → Credentials
 * 2. Create an OAuth 2.0 Client ID (Web application)
 * 3. Add your app's origin to "Authorized JavaScript origins"
 *    (e.g. http://localhost:5173 for dev, your production URL for prod)
 * 4. Enable these APIs in Google Cloud Console → APIs & Services → Library:
 *    - Google Sheets API
 *    - Google Drive API
 *    - Google Docs API
 * 5. Set VITE_GOOGLE_CLIENT_ID in .env.local
 *
 * NOTE: Client Secret is NOT used in browser apps. Only the Client ID is needed.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",       // read/write sheets
  "https://www.googleapis.com/auth/drive.readonly",      // list/find files in drive
  "https://www.googleapis.com/auth/documents.readonly",  // read docs
].join(" ");

let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;
let gisLoaded = false;
let gisLoadPromise = null;

/** Load the Google Identity Services script dynamically */
function loadGisScript() {
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      gisLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => { gisLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

/**
 * Request an access token via OAuth2 popup.
 * Returns the access token string, or null if user cancelled.
 */
export async function signInWithGoogle() {
  if (!CLIENT_ID) {
    console.warn("[googleAuth] No VITE_GOOGLE_CLIENT_ID configured");
    return null;
  }

  await loadGisScript();

  return new Promise((resolve) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error("[googleAuth] token error:", response.error);
          accessToken = null;
          resolve(null);
          return;
        }
        accessToken = response.access_token;
        // Token is valid for ~1 hour
        tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
        resolve(accessToken);
      },
    });
    tokenClient.requestAccessToken();
  });
}

/** Get the current access token, or null if not signed in / expired */
export function getAccessToken() {
  if (!accessToken || Date.now() >= tokenExpiry) return null;
  return accessToken;
}

/** Check if user is currently authenticated with a valid token */
export function isGoogleSignedIn() {
  return !!getAccessToken();
}

/** Revoke the token and sign out */
export function signOutGoogle() {
  if (accessToken) {
    window.google?.accounts?.oauth2?.revoke?.(accessToken);
  }
  accessToken = null;
  tokenExpiry = 0;
}

/** Check if Google Client ID is configured */
export function isGoogleConfigured() {
  return !!CLIENT_ID;
}
