-- ============================================================
-- Add users: Gargi Sharma (jr_pm), Ankit Ashok Mishra (jr_hw),
--            Harshal Vaishampayan (sc)
-- Run in Supabase Dashboard → SQL Editor
-- Idempotent: safe to re-run.
-- ============================================================

DO $$
DECLARE
  _id       uuid;
  _created  int := 0;
  _updated  int := 0;
  _rec      record;
BEGIN

  CREATE TEMP TABLE _team (
    email         text,
    name          text,
    resource_role text,
    role          text,
    dept          text,
    login_type    text
  ) ON COMMIT DROP;

  INSERT INTO _team VALUES
    ('gargi.sharma@elecbits.in',         'Gargi Sharma',          'jr_pm', 'pm',        'Project Management', 'pm'),
    ('ankit.ashokmishra@elecbits.in',    'Ankit Ashok Mishra',    'jr_hw', 'developer', 'Hardware',           'developer'),
    ('harshal.vaishampayan@elecbits.in', 'Harshal Vaishampayan',  'sc',    'developer', 'Supply Chain',       'developer');

  FOR _rec IN SELECT * FROM _team
  LOOP
    SELECT id INTO _id FROM auth.users WHERE email = _rec.email;

    IF _id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.users WHERE id = _id) THEN
        UPDATE public.users SET
          name          = _rec.name,
          resource_role = _rec.resource_role,
          role          = _rec.role,
          dept          = _rec.dept,
          login_type    = _rec.login_type,
          project_tags  = CASE WHEN project_tags IS NULL OR project_tags = '{}' THEN '{"engineering"}'::text[] ELSE project_tags END
        WHERE id = _id;

        _updated := _updated + 1;
        RAISE NOTICE 'UPDATED  %  →  role=% resource_role=%', _rec.email, _rec.role, _rec.resource_role;
      ELSE
        INSERT INTO public.users (
          id, name, email, role, resource_role, dept, login_type, avatar, max_projects, skills, project_tags
        ) VALUES (
          _id, _rec.name, _rec.email, _rec.role, _rec.resource_role, _rec.dept, _rec.login_type,
          upper(left(_rec.name, 1) || coalesce(left(split_part(_rec.name, ' ', 2), 1), '')),
          2, '{}'::text[], '{"engineering"}'::text[]
        );

        _created := _created + 1;
        RAISE NOTICE 'CREATED (profile only)  %  →  role=% resource_role=%', _rec.email, _rec.role, _rec.resource_role;
      END IF;
    ELSE
      _id := gen_random_uuid();

      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token
      ) VALUES (
        _id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        _rec.email,
        crypt('Elecbits@123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', _rec.name),
        now(),
        now(),
        '',
        ''
      );

      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        _id,
        _rec.email,
        jsonb_build_object('sub', _id::text, 'email', _rec.email),
        'email',
        now(),
        now(),
        now()
      );

      INSERT INTO public.users (
        id, name, email, role, resource_role, dept, login_type, avatar, max_projects, skills, project_tags
      ) VALUES (
        _id,
        _rec.name,
        _rec.email,
        _rec.role,
        _rec.resource_role,
        _rec.dept,
        _rec.login_type,
        upper(left(_rec.name, 1) || coalesce(left(split_part(_rec.name, ' ', 2), 1), '')),
        2,
        '{}'::text[],
        '{"engineering"}'::text[]
      );

      _created := _created + 1;
      RAISE NOTICE 'CREATED  %  →  role=% resource_role=%', _rec.email, _rec.role, _rec.resource_role;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════';
  RAISE NOTICE '  CREATED: %', _created;
  RAISE NOTICE '  UPDATED: %', _updated;
  RAISE NOTICE '══════════════════════════════════════';
END;
$$;
