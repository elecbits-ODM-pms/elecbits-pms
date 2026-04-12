-- Add columns to support Google Sheet sync for projects (mirrors the client sync pattern).
-- dirty = true means the row was created/updated in the app and needs to be pushed to the sheet.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS dirty          BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
