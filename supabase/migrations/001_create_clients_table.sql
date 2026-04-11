-- 001_create_clients_table.sql
--
-- Mirror of the "Client Data and IDs" Google Sheet, kept in step by the
-- sync-clients GitHub Action (every 5 minutes). The browser reads from this
-- table; writes (Phase 2) will insert with dirty=true and the cron will
-- push them up via service account.
--
-- Run this once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id                  uuid primary key default gen_random_uuid(),

  -- Sheet columns (A..R) — TEXT for safety, even s_no can contain "X-001" etc.
  s_no                text not null,
  organisation_name   text not null,
  industry            text,
  org_size            text,
  client_id           text,
  client_folder       text,
  contact_name        text,
  designation         text,
  contact_phone       text,
  contact_email       text,
  due_diligence       text,
  employees           text,
  funding             text,
  payment_terms       text,
  billing_info        text,
  shipping_info       text,
  city_state          text,
  sarthak_friends     text,

  -- Sync metadata
  source_row_number   integer not null,              -- row index in the sheet (1-based, header = 1)
  dirty               boolean not null default false,-- true = needs to be pushed back to the sheet (Phase 2)
  last_synced_at      timestamptz,                   -- last time the cron touched this row from the sheet
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- The sheet's S.no column has duplicates (e.g. two rows with s_no=176), so
  -- we use the sheet row number as the natural sync key instead. Row positions
  -- are inherently unique. Phase 2 write-back will need a more stable strategy
  -- (likely a hidden UUID column added to the sheet).
  unique (source_row_number)
);

-- Lookup indexes
create index if not exists clients_organisation_name_lower_idx
  on public.clients (lower(organisation_name));
create index if not exists clients_client_id_idx
  on public.clients (client_id) where client_id is not null;

-- Trigram index for fast substring search (used by the in-app search)
create extension if not exists pg_trgm;
create index if not exists clients_organisation_name_trgm_idx
  on public.clients using gin (lower(organisation_name) gin_trgm_ops);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row
  execute function public.set_updated_at();

-- Row-level security
alter table public.clients enable row level security;

-- Anon (browser anon key) can read all clients but cannot mutate.
drop policy if exists "clients_anon_read" on public.clients;
create policy "clients_anon_read"
  on public.clients
  for select
  to anon, authenticated
  using (true);

-- Authenticated users can insert (Phase 2 will use this for new-client writes).
drop policy if exists "clients_authed_insert" on public.clients;
create policy "clients_authed_insert"
  on public.clients
  for insert
  to authenticated
  with check (true);

-- The cron job uses the service_role key, which bypasses RLS by design.
-- No policy needed for it.
