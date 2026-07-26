-- Reconciliation: two objects already exist on the live database without a
-- corresponding migration in history — evidently added out-of-band, the
-- same way `plants.category` was reconciled in
-- 20260802000000_plants_category_reconcile.sql. Every statement below is
-- idempotent and makes no destructive change on a database where these
-- already exist.

-- 1. `plants.planted_at` (timestamptz, nullable) — read/written by the
--    frontend (src/pages/Tuinieren.tsx) and copied 1:1 into
--    `plant_instances.planted_at` (itself timestamptz, added in
--    20260802010000_plant_instances_and_growing_seasons.sql) by
--    20260802020000_migrate_planted_plants_to_instances.sql, which inserts
--    `p.planted_at` with no cast and separately casts it `::date` alongside
--    the already-`date`-typed `acquired_at` — only consistent if the source
--    column is timestamptz. No default/constraint is implied by any caller;
--    every read guards for null (`p.planted_at ? ... : null`).
alter table public.plants
  add column if not exists planted_at timestamptz;

-- 2. `app_settings` — a global (not per-user) key/value settings table.
--    Read by the frontend (src/components/wifi-widget.tsx, keys
--    "wifi_ssid"/"wifi_password") via the normal anon/authenticated client,
--    and by the translate edge function
--    (supabase/functions/translate/index.ts, key "deepl_api_key") via the
--    service-role key, which bypasses RLS entirely. No code anywhere
--    inserts/updates/deletes rows — they're managed out-of-band (dashboard
--    or SQL editor). The translate function does `.eq("key", ...).single()`,
--    so `key` must be unique; primary key is the natural fit.
create table if not exists public.app_settings (
  key text primary key,
  value text
);

alter table public.app_settings enable row level security;

-- Only SELECT is exercised by any known caller today (the service-role key
-- used server-side bypasses RLS regardless of policy). Grant exactly that,
-- so this reconciliation doesn't widen access to a table that holds an API
-- key beyond what's actually in use. Guarded so re-running this migration,
-- or a differently-authored policy of the exact same name already present
-- on the live database, can never raise a duplicate-policy error.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'Authenticated users can read app settings'
  ) then
    create policy "Authenticated users can read app settings" on public.app_settings
      for select to authenticated using (true);
  end if;
end $$;
