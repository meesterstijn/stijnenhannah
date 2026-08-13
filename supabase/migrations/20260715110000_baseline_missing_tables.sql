-- Ontbrekende historische fundering voor 15 tabellen die vóór het begin van
-- de migratiehistorie zijn ontstaan (waarschijnlijk via de Supabase
-- Table Editor) en waarvoor dus nooit een CREATE TABLE is getrackt, terwijl
-- latere migraties er wél via ALTER TABLE / policies / FK's op voortbouwen.
-- Vastgesteld via een repository-brede audit (frontend + alle 112
-- migraties) + twee live information_schema/pg_catalog-exports vanuit de
-- huidige productiedatabase (kolommen resp. constraints).
--
-- Timestamp is bewust 20260715110000 — vóór 20260715120000_note_reminders.sql,
-- de eerste migratie die 'notes' aanraakt (via ALTER TABLE). Zonder deze
-- baseline zou een reconstructie vanaf een lege database daar al stuklopen.
--
-- `create table if not exists`: op de huidige live database bestaan al deze
-- tabellen al gewoon — dit bestand is daar dus een volledige no-op. Op een
-- verse database ontstaat hier voor het eerst de tabel.
--
-- BEWUST NIET DE HUIDIGE EINDSTAAT GEKOPIEERD: elke kolom die aantoonbaar
-- door een latere, al bestaande migratie wordt toegevoegd staat hier NIET
-- in — anders zou die latere migratie stuklopen op "column already exists"
-- (met name 20260904000000_product_assignment_canonical_product.sql, die
-- canonical_product_id toevoegt via een kale `add column` ZONDER
-- `if not exists`). Zie per tabel de toelichting hieronder voor welke
-- kolom(men) bewust ontbreken en welke latere migratie ze toevoegt.
--
-- KOLOMTYPES/NULLABILITY/DEFAULTS: 1-op-1 overgenomen uit de aangeleverde
-- live information_schema.columns-export, ook waar dat afwijkt van het
-- "not null default now()"-patroon dat de wél-getrackte migraties elders in
-- deze repository consistent gebruiken (bv. group.groceries.created_at is
-- live nullable, groceries_upfront.created_at is live juist NOT NULL) —
-- dat inconsistente patroon is zelf het bewijs dat deze tabellen buiten de
-- normale migratieworkflow om zijn ontstaan, en we reconstrueren wat er
-- werkelijk staat, niet wat er "zou moeten" staan.
--
-- PRIMARY KEYS: 1-op-1 overgenomen uit de live constraint-export
-- (`product_assignments` op `product`, `weekplan` op `day`, de rest op
-- `id`). Alle PK-namen die Postgres hier automatisch genereert
-- (`<table>_pkey` bij een inline `primary key`-kolom) komen daarmee exact
-- overeen met de live constraintnamen uit de export.
--
-- FOREIGN KEYS: alleen opgenomen wanneer (a) live aantoonbaar aanwezig, (b)
-- het doel op dit historische moment al bestaat, en (c) niet door een
-- bestaande latere migratie wordt toegevoegd.
--   - notes.created_by, todos.created_by, birthdays.created_by,
--     quick_links.created_by: een vervolg-query op pg_constraint
--     (pg_get_constraintdef, schema-onafhankelijk — de eerdere
--     information_schema-export loste dit voor deze vier niet op omdat die
--     kennelijk op table_schema='public' filterde, terwijl het doel in het
--     "auth"-schema zit) heeft nu hard bevestigd: alle vier verwijzen naar
--     auth.users(id) — quick_links met ON DELETE SET NULL, de andere drie
--     zonder ON DELETE-clausule (dus NO ACTION). auth.users is Supabase's
--     eigen, altijd-aanwezige auth-tabel — geen chronologisch probleem, dus
--     hieronder gewoon inline toegevoegd.
--   - recipes.created_by: live eenduidig FOREIGN KEY -> profiles(id) (NOT
--     NULL) — maar profiles bestaat pas vanaf
--     20260816000000_app_roles_and_profiles.sql, ná dit bestand. Zie
--     20260816000500_recipes_created_by_baseline_fk.sql.
--   - weekplan.recipe_id -> recipes(id): kolom zelf hoort al niet in de
--     baseline (zie hieronder), dus ook geen FK hier.
--   - product_assignments.canonical_product_id -> products(id): idem.
--   - product_assignments.category_id -> product_categories(id): de live
--     constraint-export bevat GEEN FK hiervoor (alleen de PK op `product`
--     en de FK op `canonical_product_id`) — dus ook hier bewust geen FK
--     toegevoegd, want die bestaat live aantoonbaar niet.
--
-- UNIQUE CONSTRAINTS: de live constraint-export bevat voor geen van de 15
-- tabellen een UNIQUE constraint (alleen PRIMARY KEY, de twee behandelde
-- FOREIGN KEYs, en systeem-gegenereerde NOT NULL-checks) — dus geen enkele
-- toegevoegd.
--
-- "N_not_null"-constraints (bv. 2200_17850_1_not_null): dit zijn Postgres'
-- eigen interne representatie van een gewone NOT NULL-kolombeperking (2200
-- = OID van het "public"-schema), GEEN losse named CHECK constraints om
-- handmatig na te bouwen. NOT NULL is hieronder simpelweg gezet op elke
-- kolom waarvoor de live columns-export is_nullable = 'NO' toont.
--
-- INDEXES: de live pg_indexes-export voor alle 15 tabellen bevat uitsluitend
-- de indexes die automatisch bij hun primary keys horen, plus
-- product_assignments_canonical_product_id_idx (die hoort bij de later
-- toegevoegde canonical_product_id-kolom en wordt al aangemaakt door de
-- bestaande 20260904000000_product_assignment_canonical_product.sql). Dit
-- bestand voegt dus geen enkele index toe buiten wat de PK's hieronder al
-- automatisch opleveren — geen verzonnen performance-indexes, en die ene
-- latere index blijft bewust waar hij al hoort.
--
-- RLS/POLICIES: bewust GEEN ENABLE ROW LEVEL SECURITY en GEEN CREATE POLICY
-- voor 13 van de 15 tabellen (groceries, groceries_upfront, notes, todos,
-- birthdays, weekplan, recipes, cleaning_tasks, packing_items, quick_links,
-- travel_phrases, product_categories, product_assignments) — bestaande
-- latere migraties doen dit al volledig en correct (per-tabel RLS-enable +
-- policy voor notes/todos/birthdays in 20260716030000, voor weekplan in
-- 20260717010000, en tenslotte voor alle 13 opnieuw idempotent + owner-only
-- via 20260816010000_owner_only_lockdown.sql, dat dynamisch ALLE bestaande
-- policies verwijdert en herschrijft — dus ongeacht wat hier zou staan).
-- Nog een eigen policy toevoegen zou daar niets aan veranderen (wordt toch
-- overschreven) en voegt alleen risico op naamconflicten toe.
--
-- product_history en product_history_upfront staan NIET in de
-- owner_only_lockdown-array en worden door geen enkele andere migratie
-- geraakt — voor deze twee is hun live RLS/policy-toestand nu wél bevestigd
-- (via een read-only audit) en hieronder expliciet gereproduceerd, exact
-- zoals live — NIET aangescherpt naar owner-only, ook al is dat
-- architecturaal consistenter met de rest van de app. Met name
-- product_history_upfront's policy staat live open naar de PostgreSQL
-- pseudo-rol "public" (dus ook `anon`, niet alleen `authenticated`) — dat is
-- een bestaand, reëel toegangsrisico dat deze reconstructie bewust
-- getrouw overneemt in plaats van stilzwijgend dichtzet. Zie opleverrapport.

-- ── product_categories ──────────────────────────────────────────────────
-- id is een handmatig gekozen tekst-slug (bv. "groente-fruit"), geen
-- gen_random_uuid() — zie src/lib/categories.ts (DEFAULT_CATEGORIES,
-- saveCategories()). sort_order hoort hier NIET bij: die kolom (uiteindelijk
-- NOT NULL DEFAULT 0) komt van 20260716080000_category_sort_order.sql.
create table if not exists public.product_categories (
  id text primary key,
  name text not null,
  created_at timestamptz default now()
);

-- ── recipes ──────────────────────────────────────────────────────────────
-- created_by hoort hier NIET bij — zie toelichting bovenaan dit bestand en
-- 20260816000500_recipes_created_by_baseline_fk.sql.
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  ingredients text not null,
  instructions text,
  servings integer not null default 4,
  created_at timestamptz not null default now(),
  steps text default '',
  time text default '',
  category text default 'Gerechten'
);

-- ── weekplan ─────────────────────────────────────────────────────────────
-- day is de PK (bv. "ma".."zo"), geen aparte id-kolom — zie
-- src/pages/Weekmenu.tsx (upsert met onConflict: "day"). recipe_id hoort
-- hier NIET bij: die FK-kolom naar recipes(id) komt van
-- 20260716060000_weekplan_recipe_link.sql — recipes bestaat dan al, dankzij
-- dit bestand hierboven.
create table if not exists public.weekplan (
  day text primary key,
  meal text not null default ''
);

-- ── groceries ────────────────────────────────────────────────────────────
create table if not exists public.groceries (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  done boolean not null default false,
  created_at timestamptz default now()
);

-- ── groceries_upfront ────────────────────────────────────────────────────
-- Zelfde vorm als groceries (tweede, losstaande boodschappenlijst) — alleen
-- created_at is hier live wél NOT NULL (bewust zo overgenomen, niet
-- gelijkgetrokken met groceries).
create table if not exists public.groceries_upfront (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── notes ────────────────────────────────────────────────────────────────
-- remind_at/reminder_sent_at horen hier NIET bij: die komen van
-- 20260715120000_note_reminders.sql, de eerstvolgende migratie
-- chronologisch. created_by -> auth.users(id): zie FK-toelichting bovenaan
-- dit bestand.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── todos ────────────────────────────────────────────────────────────────
-- remind_at/reminder_sent_at horen hier NIET bij: die komen van
-- 20260720010000_todo_remind_at.sql. created_by -> auth.users(id): zie
-- FK-toelichting bovenaan dit bestand.
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  text text not null default '',
  done boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ── birthdays ────────────────────────────────────────────────────────────
-- created_by -> auth.users(id): zie FK-toelichting bovenaan dit bestand.
create table if not exists public.birthdays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  day integer not null,
  month integer not null,
  year integer,
  notes text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  type text not null default 'verjaardag'
);

-- ── cleaning_tasks ───────────────────────────────────────────────────────
create table if not exists public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  last_done_at timestamptz,
  interval_days integer not null default 90,
  position integer not null default 0
);

-- ── packing_items ────────────────────────────────────────────────────────
create table if not exists public.packing_items (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  category text not null default 'Overig',
  checked_stijn boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  checked_hannah boolean not null default false
);

-- ── quick_links ──────────────────────────────────────────────────────────
-- created_by -> auth.users(id) on delete set null: zie FK-toelichting
-- bovenaan dit bestand.
create table if not exists public.quick_links (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  emoji text not null default '🔗',
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── travel_phrases ───────────────────────────────────────────────────────
create table if not exists public.travel_phrases (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  phrase_nl text not null,
  phrase_jp text not null,
  phrase_romaji text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- ── product_assignments ──────────────────────────────────────────────────
-- product is de PK (geen aparte id-kolom) — zie src/lib/categories.ts
-- (assignCategory() doet upsert({product, category_id}) zonder expliciete
-- onConflict, wat standaard op de PK mikt). canonical_product_id hoort hier
-- NIET bij: die kolom komt van
-- 20260904000000_product_assignment_canonical_product.sql via een KALE
-- `add column` ZONDER `if not exists` — zou die kolom hier al bestaan, dan
-- faalt die migratie gegarandeerd met "column already exists". category_id
-- heeft live GEEN foreign key naar product_categories(id) (bevestigd door
-- de constraint-export bevat die niet) — dus ook hier bewust geen FK.
create table if not exists public.product_assignments (
  product text primary key,
  category_id text not null
);

-- ── product_history ──────────────────────────────────────────────────────
create table if not exists public.product_history (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- RLS/policy live bevestigd (zie FK/RLS-toelichting bovenaan dit bestand):
-- policy "allow_authenticated", rol authenticated, cmd ALL, qual/with_check
-- true. Geen bestaande migratie raakt product_history's RLS aan (niet
-- opgenomen in owner_only_lockdown.sql's dynamische tabel-array), dus dit
-- is de enige en juiste plek om dit te reproduceren.
alter table public.product_history enable row level security;

drop policy if exists "allow_authenticated" on public.product_history;
create policy "allow_authenticated" on public.product_history
  for all to authenticated using (true) with check (true);

-- ── product_history_upfront ──────────────────────────────────────────────
-- Zelfde vorm als product_history — created_at is hier live wél NOT NULL
-- (bewust zo overgenomen, niet gelijkgetrokken).
create table if not exists public.product_history_upfront (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- RLS/policy live bevestigd: policy "Allow all", rol public (!), cmd ALL,
-- qual/with_check true. `to public` is hier bewust NIET versmald naar
-- `authenticated` — dit reproduceert exact de live situatie, inclusief het
-- feit dat dit ook de Postgres-pseudorol `anon` omvat (een bestaand
-- toegangsrisico, hier bewust getrouw overgenomen i.p.v. stilzwijgend
-- aangescherpt — zie ook de toelichting bovenaan dit bestand). Net als bij
-- product_history raakt geen bestaande migratie deze RLS/policy aan.
alter table public.product_history_upfront enable row level security;

drop policy if exists "Allow all" on public.product_history_upfront;
create policy "Allow all" on public.product_history_upfront
  for all to public using (true) with check (true);

-- Handmatige controle na het draaien van deze migratie (niet onderdeel van
-- de migratie zelf) — vergelijk met de aangeleverde live column-export:
--
-- select table_name, column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in (
--     'groceries','groceries_upfront','notes','todos','birthdays',
--     'weekplan','recipes','cleaning_tasks','packing_items','quick_links',
--     'travel_phrases','product_categories','product_assignments',
--     'product_history','product_history_upfront'
--   )
-- order by table_name, ordinal_position;
