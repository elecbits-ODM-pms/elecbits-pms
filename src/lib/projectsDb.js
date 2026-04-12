/*
 * projectsDb.js — Google Sheet sync for projects (mirrors clientsDb.js)
 *
 * When a project is created in the app it is inserted with dirty=true.
 * The push-projects Supabase edge function then appends it to the
 * "Project Data and IDs" Google Sheet using a service account.
 */

import { supabase } from "./supabase.js";

/**
 * Push dirty project rows from Supabase to the Google Sheet via the
 * push-projects edge function (uses a Google service account — no
 * browser sign-in needed).
 */
export async function pushDirtyProjectsToSheet() {
  console.log("[projectsDb] invoking push-projects edge function…");
  const { data, error } = await supabase.functions.invoke("push-projects", {
    method: "POST",
  });

  if (error) {
    let detail = error.message || String(error);
    try {
      if (error.context && typeof error.context.json === "function") {
        const body = await error.context.json();
        detail = body?.error || JSON.stringify(body);
      }
    } catch { /* ignore */ }
    console.error("[projectsDb] push-projects failed:", detail);
    return { ok: false, error: detail };
  }
  if (!data || data.ok !== true) {
    const msg = data?.error || "push-projects returned no data";
    console.error("[projectsDb] push-projects failed:", msg);
    return { ok: false, error: msg };
  }

  console.log(`[projectsDb] push-projects OK: ${data.pushed} rows pushed in ${data.durationMs}ms`);
  return { ok: true, pushed: data.pushed };
}

/**
 * Get the next project count for a given client ID.
 * Counts existing projects whose project_id starts with `EbZ-{clientId}-`.
 */
export async function getNextProjectCount(clientId) {
  if (!clientId) return 1;

  const prefix = `EbZ-${clientId}-`;
  const { data: rows, error } = await supabase
    .from("projects")
    .select("project_id")
    .like("project_id", `${prefix}%`);

  if (error) {
    console.error("[projectsDb] count query failed:", error);
    return 1;
  }

  if (!rows || rows.length === 0) return 1;

  // Parse the count suffix from each matching project_id and find the max
  let maxCount = 0;
  for (const r of rows) {
    const suffix = r.project_id.slice(prefix.length);
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && num > maxCount) maxCount = num;
  }
  return maxCount + 1;
}
