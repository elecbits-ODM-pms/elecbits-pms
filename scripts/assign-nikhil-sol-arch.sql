-- ============================================================
-- Assign Nikhil (sol_arch) as "Solution Architects" on ALL projects
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run multiple times — skips projects already assigned
-- ============================================================

DO $$
DECLARE
  _nikhil_id  uuid;
  _proj       record;
  _assigned   int := 0;
  _skipped    int := 0;
BEGIN

  -- 1. Locate Nikhil in public.users
  SELECT id INTO _nikhil_id
  FROM public.users
  WHERE name ILIKE 'nikhil%'
    AND resource_role = 'sol_arch'
  LIMIT 1;

  IF _nikhil_id IS NULL THEN
    RAISE EXCEPTION
      'User "Nikhil" with resource_role=sol_arch not found in public.users. '
      'Make sure the seed script (scripts/seed-users.sql) has been run first.';
  END IF;

  RAISE NOTICE 'Found Nikhil → id = %', _nikhil_id;

  -- 2. Iterate over every project and assign if not already present
  FOR _proj IN
    SELECT id, name, project_id, start_date, end_date
    FROM   public.projects
    ORDER  BY created_at
  LOOP

    IF EXISTS (
      SELECT 1
      FROM   public.team_assignments
      WHERE  project_id = _proj.id
        AND  user_id    = _nikhil_id
        AND  role       = 'Solution Architects'
    ) THEN
      RAISE NOTICE 'SKIP     % (%)', _proj.name, _proj.project_id;
      _skipped := _skipped + 1;

    ELSE
      INSERT INTO public.team_assignments (project_id, user_id, role, start_date, end_date)
      VALUES (_proj.id, _nikhil_id, 'Solution Architects', _proj.start_date, _proj.end_date);

      RAISE NOTICE 'ASSIGNED % (%)', _proj.name, _proj.project_id;
      _assigned := _assigned + 1;
    END IF;

  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE '  ASSIGNED : %', _assigned;
  RAISE NOTICE '  SKIPPED  : %  (already had Nikhil)', _skipped;
  RAISE NOTICE '══════════════════════════════════════════';

END;
$$;
