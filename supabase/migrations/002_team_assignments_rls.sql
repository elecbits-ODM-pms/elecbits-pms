-- 002_team_assignments_rls.sql
--
-- Fix: the existing ta_write policy had no WITH CHECK clause, which
-- caused INSERT to fail for authenticated PM/admin users. This migration
-- recreates it with an explicit WITH CHECK, and adds backup policies
-- for the authenticated role.
--
-- Run this once in the Supabase SQL editor.

ALTER TABLE team_assignments ENABLE ROW LEVEL SECURITY;

-- Fix existing ta_write: add explicit WITH CHECK
DROP POLICY IF EXISTS ta_write ON team_assignments;
CREATE POLICY ta_write ON team_assignments
  FOR ALL TO public
  USING (is_pm_or_admin())
  WITH CHECK (is_pm_or_admin());

-- Backup policies for authenticated role
CREATE POLICY auth_insert_team_assignments ON team_assignments
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY auth_update_team_assignments ON team_assignments
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
