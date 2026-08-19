-- Game Night V2.7A — datamodel/configuratiebasis voor de toekomstige
-- "Game Arena" (V2.7B). Uitsluitend additief: acht nieuwe, nullable
-- kolommen op de bestaande public.game_night_games, plus server-side
-- validatie/normalisatie. Geen nieuwe tabel, geen nieuwe RLS-policy nodig
-- (zie hieronder), geen backfill, geen wijziging aan cover_storage_path,
-- de WIN-engine, checkpoints, rondes of andere bestaande semantiek.
--
-- ── Twee soorten nieuwe kolommen, twee soorten server-side afdwinging ────
-- 1. Vrije-vorm velden die genormaliseerd moeten worden (kleuren, tagline):
--    een CHECK-constraint kan wel VALIDEREN maar niet TRANSFORMEREN (bv.
--    "#abc" naar "#aabbcc" expanderen, of trimmen) — daarvoor is een
--    BEFORE-trigger nodig. Dezelfde trigger valideert én normaliseert in
--    één stap, voor ELK schrijfpad naar deze tabel (de bestaande directe
--    `.update()`-aanroepen vanuit de frontend, een toekomstige RPC, of een
--    handmatige edit in de Supabase-dashboard) — niet alleen de nieuwe
--    frontendhooks uit dit opleverrapport.
-- 2. Vaste preset-allowlists (arena_style/arena_symbol/celebration_style):
--    een gewone CHECK-constraint volstaat, zelfde patroon als het bestaande
--    `difficulty`-veld op deze tabel.
--
-- ── RLS ────────────────────────────────────────────────────────────────
-- Geen nieuwe policy: de bestaande "game_night_games: owner only" (FOR ALL)
-- en "game_night_games: member select" policies gelden per RIJ, niet per
-- kolom — nieuwe nullable kolommen op een al-toegestane tabel hebben
-- vanzelf exact dezelfde owner-write/member-read-rechten als de bestaande
-- kolommen. Zie het opleverrapport voor de expliciete bevestiging.
--
-- ── Storage ────────────────────────────────────────────────────────────
-- setup_storage_path hergebruikt de bestaande game-night-covers-bucket
-- (zelfde publieke bucket, zelfde owner-only insert/update/delete-policies
-- uit 20260911000000_game_night_games.sql, die al generiek op
-- bucket_id + private.storage_first_segment_uuid(objects.name) matchen —
-- geen kolomspecifieke policy, dus geen wijziging nodig). Padconventie:
-- <game_id>/setup-<uuid>.<ext>, bewust met een "setup-"-prefix zodat een
-- toekomstige cover-upload-feature in dezelfde map nooit per ongeluk een
-- setupfoto overschrijft of ermee verward wordt.

alter table public.game_night_games
  add column if not exists setup_storage_path text,
  add column if not exists arena_primary_color text,
  add column if not exists arena_secondary_color text,
  add column if not exists arena_style text,
  add column if not exists arena_symbol text,
  add column if not exists arena_tagline text,
  add column if not exists celebration_style text;

comment on column public.game_night_games.setup_storage_path is
  'V2.7A: foto van het daadwerkelijk opgebouwde spel/bord (Storage-pad in game-night-covers), los van cover_storage_path (doos/cover-foto). Null = nog geen setupfoto; de toekomstige Game Arena valt dan terug op cover_storage_path.';
comment on column public.game_night_games.arena_primary_color is
  'V2.7A: primaire Game Arena-accentkleur, hex (#RGB of #RRGGBB, genormaliseerd naar lowercase #rrggbb door de trigger hieronder). Null = generieke GNV2-fallbackkleur.';
comment on column public.game_night_games.arena_secondary_color is
  'V2.7A: secundaire Game Arena-accentkleur, zelfde validatie/normalisatie als arena_primary_color. Null = generieke GNV2-fallbackkleur.';
comment on column public.game_night_games.arena_style is
  'V2.7A: vaste preset-stijl voor de toekomstige Game Arena (allowlist, zie constraint). Null = standaard GNV2 Game Arena-look.';
comment on column public.game_night_games.arena_symbol is
  'V2.7A: vaste preset-symbool-id (allowlist, zie constraint) — de database slaat alleen de preset-id op, de frontend bepaalt later welk icoon/decoratief element daarbij hoort. Null = geen preset gekozen, gedraagt zich als ''none''.';
comment on column public.game_night_games.arena_tagline is
  'V2.7A: korte sfeerzin voor de toekomstige Game Arena/Live Play (bv. "Het eiland ligt open. De strijd kan beginnen."). Getrimd en gelimiteerd door de trigger hieronder; lege string wordt null.';
comment on column public.game_night_games.celebration_style is
  'V2.7A: vaste preset-id voor toekomstige WIN-feedbackanimatie (allowlist, zie constraint) — bevat uitsluitend een presetnaam, geen animatiecode. Null = generieke standaardcelebratie.';

-- ── Preset-allowlists (vaste CHECK-constraints, zelfde patroon als het
-- bestaande difficulty-veld) — heruitvoerbaar via een pg_constraint-guard,
-- Postgres kent geen "ADD CONSTRAINT IF NOT EXISTS". ──────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_night_games_arena_style_check'
      and conrelid = 'public.game_night_games'::regclass
  ) then
    alter table public.game_night_games
      add constraint game_night_games_arena_style_check
      check (arena_style is null or arena_style in ('warm', 'dark', 'neon', 'playful', 'classic'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_night_games_arena_symbol_check'
      and conrelid = 'public.game_night_games'::regclass
  ) then
    alter table public.game_night_games
      add constraint game_night_games_arena_symbol_check
      check (arena_symbol is null or arena_symbol in ('hex', 'skull', 'music', 'cards', 'dice', 'crown', 'burst', 'star', 'none'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_night_games_celebration_style_check'
      and conrelid = 'public.game_night_games'::regclass
  ) then
    alter table public.game_night_games
      add constraint game_night_games_celebration_style_check
      check (celebration_style is null or celebration_style in ('burst', 'pulse', 'spark', 'slam', 'glitch', 'confetti'));
  end if;
end $$;

-- ── Kleur-/tagline-normalisatie (trigger, sectie 4/7 van de opdracht) ────
-- BEFORE-trigger i.p.v. alleen een CHECK: kleuren moeten ook GENORMALISEERD
-- worden (shorthand #abc -> #aabbcc, lowercase), en tagline moet getrimd en
-- bij lege string naar null omgezet worden — een CHECK-constraint kan dat
-- niet, alleen valideren. Werkt voor elk schrijfpad naar deze tabel, niet
-- alleen de nieuwe frontendhooks.
create or replace function private.game_night_normalize_arena_fields()
returns trigger
language plpgsql
as $$
declare
  v_hex_re text := '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$';
  v_c text;
begin
  if new.arena_primary_color is not null then
    v_c := trim(new.arena_primary_color);
    if v_c !~ v_hex_re then
      raise exception 'arena_primary_color moet een geldige hexkleur zijn (#RGB of #RRGGBB)'
        using errcode = '22023';
    end if;
    if length(v_c) = 4 then
      v_c := '#' || repeat(substr(v_c, 2, 1), 2) || repeat(substr(v_c, 3, 1), 2) || repeat(substr(v_c, 4, 1), 2);
    end if;
    new.arena_primary_color := lower(v_c);
  end if;

  if new.arena_secondary_color is not null then
    v_c := trim(new.arena_secondary_color);
    if v_c !~ v_hex_re then
      raise exception 'arena_secondary_color moet een geldige hexkleur zijn (#RGB of #RRGGBB)'
        using errcode = '22023';
    end if;
    if length(v_c) = 4 then
      v_c := '#' || repeat(substr(v_c, 2, 1), 2) || repeat(substr(v_c, 3, 1), 2) || repeat(substr(v_c, 4, 1), 2);
    end if;
    new.arena_secondary_color := lower(v_c);
  end if;

  if new.arena_tagline is not null then
    new.arena_tagline := nullif(trim(new.arena_tagline), '');
    if new.arena_tagline is not null and char_length(new.arena_tagline) > 140 then
      raise exception 'arena_tagline mag maximaal 140 tekens bevatten'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists game_night_games_normalize_arena on public.game_night_games;
create trigger game_night_games_normalize_arena
  before insert or update on public.game_night_games
  for each row execute function private.game_night_normalize_arena_fields();

-- ── Setupfoto: dezelfde bucket, geen nieuwe storage-policy nodig ─────────
-- De bestaande "game-night-covers: owner upload/update/delete"-policies
-- (20260911000000_game_night_games.sql) matchen op
-- private.storage_first_segment_uuid(objects.name) tegen een bestaande
-- game_night_games-rij — dat geldt identiek voor het pad
-- <game_id>/setup-<uuid>.<ext>. Geen SQL-wijziging hier; puur ter
-- documentatie in dit bestand voor de volgende reviewer.
