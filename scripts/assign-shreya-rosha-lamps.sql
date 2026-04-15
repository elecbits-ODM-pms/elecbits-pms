-- ============================================================
-- Assign Shreya (sr_pm) as "Senior PM" on Rosha Lamps project
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run multiple times — skips if already assigned
-- ============================================================

DO $$
DECLARE
  _shreya_id  uuid := '3d6cfb19-1c1c-4d81-b25c-a0631458d955';
  _project_id uuid := '2b06f72c-6256-4a72-a4c8-0322982a4faf';
  _proj_name  text;
  _start_date date;
  _end_date   date;
BEGIN

  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = _shreya_id) THEN
    RAISE EXCEPTION 'User Shreya (id=%) not found in public.users', _shreya_id;
  END IF;

  -- Fetch project details
  SELECT name, start_date, end_date
  INTO _proj_name, _start_date, _end_date
  FROM public.projects
  WHERE id = _project_id;

  IF _proj_name IS NULL THEN
    RAISE EXCEPTION 'Project (id=%) not found in public.projects', _project_id;
  END IF;

  RAISE NOTICE 'Project: % (id=%)', _proj_name, _project_id;
  RAISE NOTICE 'User: Shreya (id=%)', _shreya_id;

  -- Check if already assigned
  IF EXISTS (
    SELECT 1
    FROM public.team_assignments
    WHERE project_id = _project_id
      AND user_id    = _shreya_id
      AND role       = 'Senior PM'
  ) THEN
    RAISE NOTICE 'SKIP — Shreya is already assigned as Senior PM on %', _proj_name;
  ELSE
    INSERT INTO public.team_assignments (project_id, user_id, role, start_date, end_date)
    VALUES (_project_id, _shreya_id, 'Senior PM', _start_date, _end_date);

    RAISE NOTICE 'SUCCESS — Assigned Shreya as Senior PM on %', _proj_name;
  END IF;

END;
$$;
