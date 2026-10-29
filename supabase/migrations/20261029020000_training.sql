-- Trainingsmodule: persoonlijke fitness- en trainingscoach (zie docs/training.md).
--
-- Ontwerp:
--   * Elke rij hoort bij één gebruiker (user_id). Gegevens zijn strikt
--     privé: ook een andere owner ziet ze niet.
--   * Geen security definer: clients schrijven rechtstreeks in de tabellen,
--     begrensd door RLS (alleen eigen rijen, alleen met trainingstoegang).
--     Er is geen DELETE-recht; verwijderen = verwijdermarkering (deleted_at),
--     zodat andere apparaten de verwijdering ook binnenkrijgen.
--   * Ids worden op het apparaat aangemaakt (offline-first). Opslaan gaat
--     als upsert op id; de trigger training_touch maakt dat veilig:
--       - version: de client stuurt "mijn basisversie + 1". Klopt dat niet
--         met de serverversie, dan is er op een ander apparaat iets gewijzigd
--         en volgt een expliciet conflict (SQLSTATE TRC01), nooit een stille
--         overschrijving.
--       - last_change_id: een herhaalde push van dezelfde wijziging (bv. na
--         een verloren antwoord) wordt herkend en is een no-op (idempotent).
--       - changed_at: servertijd van de laatste wijziging, de sync-cursor.
--   * Systeemoefeningen en standaardschema's staan in de app (alleen-lezen
--     voor iedereen); in de database staan alleen eigen oefeningen/schema's.
--   * Gewichten als numeric (exact), herhalingen als niet-negatieve integers.

begin;

-- ── Toegang ────────────────────────────────────────────────────────────

-- Voorlopig alleen owners, elk met een eigen, gescheiden trainingslogboek.
create or replace function private.can_use_training()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'owner', false);
$$;

revoke execute on function private.can_use_training() from public, anon;
grant execute on function private.can_use_training() to authenticated;

-- ── Sync-metadata en versiecontrole ────────────────────────────────────

create or replace function private.training_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.version is null or new.version < 1 then
      new.version := 1;
    end if;
  else
    -- Dezelfde wijziging nogmaals (antwoord eerder kwijtgeraakt): niets doen.
    if new.last_change_id is not null
       and new.last_change_id = old.last_change_id then
      return old;
    end if;
    if new.version is distinct from old.version + 1 then
      raise exception 'Versieconflict: dit record is op een ander apparaat gewijzigd'
        using errcode = 'TRC01', detail = old.version::text;
    end if;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  new.changed_at := clock_timestamp();
  return new;
end;
$$;

revoke execute on function private.training_touch() from public, anon, authenticated;

-- ── Tabellen ───────────────────────────────────────────────────────────

-- Eén profiel per gebruiker (id = user_id): voorkeuren, apparatuur en
-- instellingen per oefening (favoriet, notitie, rusttijd).
create table if not exists public.training_profiles (
  id uuid primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  equipment jsonb not null default '{}'::jsonb
    check (jsonb_typeof(equipment) = 'object'),
  exercise_prefs jsonb not null default '{}'::jsonb
    check (jsonb_typeof(exercise_prefs) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  changed_at timestamptz not null default clock_timestamp(),
  last_change_id uuid,
  constraint training_profiles_one_per_user check (id = user_id),
  constraint training_profiles_size check (
    pg_column_size(settings) + pg_column_size(equipment)
      + pg_column_size(exercise_prefs) < 262144
  )
);

-- Eigen oefeningen. Details (spiergroepen, materiaal, instructie) in data.
create table if not exists public.training_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 65536),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  changed_at timestamptz not null default clock_timestamp(),
  last_change_id uuid
);

-- Eigen schema's. content = dagen met oefeningen; revision telt op bij elke
-- inhoudelijke wijziging. Sessies bewaren een eigen momentopname, dus een
-- wijziging hier verandert nooit oude trainingshistorie.
create table if not exists public.training_programs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  content jsonb not null
    check (jsonb_typeof(content) = 'object' and pg_column_size(content) < 262144),
  revision integer not null default 1 check (revision >= 1),
  source text check (char_length(source) <= 80),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  changed_at timestamptz not null default clock_timestamp(),
  last_change_id uuid
);

create table if not exists public.training_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid, -- geen FK: historie blijft ook als een schema weg is
  program_revision integer,
  day_id text check (char_length(day_id) <= 80),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null check (status in (
    'planned', 'active', 'paused', 'completed', 'cancelled', 'skipped'
  )),
  started_at timestamptz not null,
  ended_at timestamptz,
  local_date date not null, -- trainingsdag in de tijdzone van de gebruiker
  time_zone text check (char_length(time_zone) <= 64),
  notes text check (char_length(notes) <= 4000),
  -- Momentopname van de training zoals gepland/uitgevoerd (oefeningen,
  -- voorgeschreven sets, rusttijden).
  snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) < 524288),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  changed_at timestamptz not null default clock_timestamp(),
  last_change_id uuid,
  unique (id, user_id),
  constraint training_sessions_end check (ended_at is null or ended_at >= started_at)
);

-- Eén rij per voltooide set. Een set bestaat pas als hij voltooid is;
-- ongedaan maken = verwijdermarkering. Per positie (sessie, oefening-slot,
-- soort, setnummer) bestaat maximaal één rij: dubbel tikken of een herhaalde
-- push kan zo nooit een dubbele set opleveren.
create table if not exists public.training_sets (
  id uuid primary key,
  user_id uuid not null,
  session_id uuid not null,
  exercise_id text not null check (char_length(exercise_id) between 1 and 80),
  slot smallint not null check (slot between 0 and 99),
  kind text not null check (kind in ('warmup', 'work')),
  set_index smallint not null check (set_index between 0 and 99),
  weight_kg numeric(6, 2) check (weight_kg between 0 and 999.99),
  reps integer check (reps between 0 and 1000),
  duration_s integer check (duration_s between 0 and 86400),
  jumps integer check (jumps between 0 and 100000),
  -- Voorbereid voor later (RPE/RIR-registratie); nu nog niet in de UI.
  rpe numeric(3, 1) check (rpe between 1 and 10),
  rir smallint check (rir between 0 and 10),
  notes text check (char_length(notes) <= 500),
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  changed_at timestamptz not null default clock_timestamp(),
  last_change_id uuid,
  unique (session_id, slot, kind, set_index),
  foreign key (session_id, user_id)
    references public.training_sessions (id, user_id) on delete cascade,
  constraint training_sets_measured check (
    reps is not null or duration_s is not null
  )
);

-- Lichaamsgewicht en -metingen, één rij per datum (id is per datum
-- deterministisch, zodat twee apparaten geen dubbele dag maken).
create table if not exists public.training_body_metrics (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 2) check (weight_kg between 20 and 400),
  measurements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(measurements) = 'object' and pg_column_size(measurements) < 8192),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  changed_at timestamptz not null default clock_timestamp(),
  last_change_id uuid
);

-- ── Indexen ────────────────────────────────────────────────────────────

create index if not exists training_profiles_user_changed
  on public.training_profiles (user_id, changed_at);
create index if not exists training_exercises_user_changed
  on public.training_exercises (user_id, changed_at);
create index if not exists training_programs_user_changed
  on public.training_programs (user_id, changed_at);
create index if not exists training_sessions_user_changed
  on public.training_sessions (user_id, changed_at);
create index if not exists training_sessions_user_started
  on public.training_sessions (user_id, started_at desc);
create index if not exists training_sets_user_changed
  on public.training_sets (user_id, changed_at);
create index if not exists training_sets_history
  on public.training_sets (user_id, exercise_id, completed_at desc);
create index if not exists training_sets_session
  on public.training_sets (session_id);
create index if not exists training_body_metrics_user_changed
  on public.training_body_metrics (user_id, changed_at);
create index if not exists training_body_metrics_user_date
  on public.training_body_metrics (user_id, measured_on);

-- ── Triggers en RLS ────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'training_profiles', 'training_exercises', 'training_programs',
    'training_sessions', 'training_sets', 'training_body_metrics'
  ] loop
    execute format('drop trigger if exists trg_%1$s_touch on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_touch before insert or update on public.%1$I
         for each row execute function private.training_touch()', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);

    execute format('drop policy if exists "Eigen rijen lezen" on public.%I', t);
    execute format('drop policy if exists "Eigen rijen toevoegen" on public.%I', t);
    execute format('drop policy if exists "Eigen rijen wijzigen" on public.%I', t);
    execute format(
      'create policy "Eigen rijen lezen" on public.%I for select to authenticated
         using (user_id = (select auth.uid()) and (select private.can_use_training()))', t);
    execute format(
      'create policy "Eigen rijen toevoegen" on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()) and (select private.can_use_training()))', t);
    execute format(
      'create policy "Eigen rijen wijzigen" on public.%I for update to authenticated
         using (user_id = (select auth.uid()) and (select private.can_use_training()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

commit;
