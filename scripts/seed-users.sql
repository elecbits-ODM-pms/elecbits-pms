-- ============================================================
-- Seed 20 users into Supabase (auth.users + public.users)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================
-- For each user:
--   1. Check if email exists in auth.users
--   2. If exists → update public.users role fields
--   3. If not exists → create auth.users row + public.users row
-- ============================================================

DO $$
DECLARE
  _id       uuid;
  _exists   boolean;
  _created  int := 0;
  _updated  int := 0;
  _errors   int := 0;
  _rec      record;
BEGIN

  -- Temporary table with all 20 team members
  CREATE TEMP TABLE _team (
    email         text,
    name          text,
    resource_role text,
    role          text,
    dept          text,
    login_type    text
  ) ON COMMIT DROP;

  INSERT INTO _team VALUES
    ('saurav@elecbits.in',          'Saurav',           'sr_pm', 'superadmin', 'Project Management',    'superadmin'),
    ('shreya@elecbits.in',          'Shreya',           'sr_pm', 'superadmin', 'Project Management',    'superadmin'),
    ('akash.sharma@elecbits.in',    'Akash Sharma',     'sr_pm', 'pm',         'Project Management',    'pm'),
    ('anunay.dixit@elecbits.in',    'Anunay Dixit',     'sr_pm', 'pm',         'Project Management',    'pm'),
    ('jerom.johnshibu@elecbits.in', 'Jerom Johnshibu',  'pm',    'pm',         'Project Management',    'pm'),
    ('chhavi.bhatia@elecbits.in',   'Chhavi Bhatia',    'pm',    'pm',         'Project Management',    'pm'),
    ('nived.p@elecbits.in',         'Nived P',          'pm',    'pm',         'Project Management',    'pm'),
    ('arun.pratapsingh@elecbits.in','Arun Mohan',       'sr_hw', 'developer',  'Hardware',              'developer'),
    ('amitabh.gogoi@elecbits.in',   'Amitabh Gogoi',    'sr_fw', 'developer',  'Firmware',              'developer'),
    ('yogesh@elecbits.in',          'Yogesh',           'jr_hw', 'developer',  'Hardware',              'developer'),
    ('jeena.george@elecbits.in',    'Jeena George',     'jr_hw', 'developer',  'Hardware',              'developer'),
    ('rahul.singh@elecbits.in',     'Rahul Singh',      'jr_hw', 'developer',  'Hardware',              'developer'),
    ('sai.kiran@elecbits.in',       'Sai Kiran',        'jr_fw', 'developer',  'Firmware',              'developer'),
    ('nethravathi.j@elecbits.in',   'Nethravathi J',    'jr_fw', 'developer',  'Firmware',              'developer'),
    ('nethravathi.gk@elecbits.in',  'Nethravathi GK',   'jr_fw', 'developer',  'Firmware',              'developer'),
    ('sheik.ayesha@elecbits.in',    'Ayesha Sheik',     'jr_fw', 'developer',  'Firmware',              'developer'),
    ('syed.shigarf@elecbits.in',    'Syed Shigarf',     'jr_fw', 'developer',  'Firmware',              'developer'),
    ('israfil.khan@elecbits.in',    'Israfil Khan',     'jr_fw', 'developer',  'Firmware',              'developer'),
    ('sonu.kumar@elecbits.in',      'Sonu Kumar',       'jr_fw', 'developer',  'Firmware',              'developer'),
    ('nikhil@elecbits.in',          'Nikhil',           'sc',    'superadmin', 'Solution Architecture', 'superadmin');

  FOR _rec IN SELECT * FROM _team
  LOOP
    -- Check if auth user exists
    SELECT id INTO _id FROM auth.users WHERE email = _rec.email;

    IF _id IS NOT NULL THEN
      -- Auth user exists → check if public.users row also exists
      IF EXISTS (SELECT 1 FROM public.users WHERE id = _id) THEN
        -- Both exist → update
        UPDATE public.users SET
          name          = _rec.name,
          resource_role = _rec.resource_role,
          role          = _rec.role,
          dept          = _rec.dept,
          login_type    = _rec.login_type
        WHERE id = _id;

        _updated := _updated + 1;
        RAISE NOTICE 'UPDATED  %  →  role=% resource_role=%', _rec.email, _rec.role, _rec.resource_role;
      ELSE
        -- Auth exists but public.users missing → insert public.users row
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
      -- User does not exist → create auth user + public.users row
      _id := gen_random_uuid();

      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token
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

      -- Also create identity record (required by Supabase Auth)
      INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
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

      -- Insert into public.users
      INSERT INTO public.users (
        id,
        name,
        email,
        role,
        resource_role,
        dept,
        login_type,
        avatar,
        max_projects,
        skills,
        project_tags
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
