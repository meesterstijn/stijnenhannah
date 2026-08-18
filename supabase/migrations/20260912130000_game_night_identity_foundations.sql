-- Game Night V2.1b — puur additieve profiel/themafundamenten (opdracht
-- sectie 10). Bewust een APARTE migratie van
-- 20260912120000_game_night_win_events.sql: deze twee stukken zijn
-- functioneel onafhankelijk (win-events raken geen speler/spel-kolommen),
-- dus los uitvoerbaar/leesbaar/terug te draaien is veiliger dan alles in
-- één bestand. Geen enkele kolom hier krijgt in V2.1 betekenis in RLS of
-- UI — puur schema, klaar voor latere fases.

-- ── Gecureerd kleurenpalet ─────────────────────────────────────────────────
-- Kleine, aparte tabel i.p.v. een appconfig-constante: de opdracht (Game
-- Night V2-architectuurplan, sectie 17) vraagt dat de owner het palet later
-- kan aanpassen zonder deploy — dat impliceert data, geen code. Elke kleur
-- wordt een echte rij, niet een los stuk vrije tekst zoals het bestaande
-- game_night_players.color (die kolom blijft ongewijzigd bestaan als
-- fallback voor al gezette, niet-gecureerde kleuren, zie hieronder).
create table public.game_night_color_palette (
  id uuid primary key default gen_random_uuid(),
  hex text not null check (hex ~ '^#[0-9a-fA-F]{6}$'),
  label text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.game_night_color_palette is
  'Gecureerd kleurenpalet voor spelerherkenning (Game Night V2). Owner-beheerd; geen UI in V2.1. Spelers/spellen wijzen er via color_id/accent_color_id naar, in plaats van vrije hexwaarden te kiezen.';

alter table public.game_night_color_palette enable row level security;

create policy "game_night_color_palette: owner only" on public.game_night_color_palette
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_color_palette from anon;

-- Kleine, gecureerde seedset (8 kleuren) — bewust ruim voldoende contrast
-- tussen alle onderlinge paren voor een vriendengroep van deze omvang, geen
-- honderden speculatieve varianten.
insert into public.game_night_color_palette (hex, label, sort_order) values
  ('#B8863B', 'Brons', 0),
  ('#8C3B3B', 'Bordeaux', 1),
  ('#3B6B4A', 'Bos', 2),
  ('#3B5C8C', 'Denim', 3),
  ('#6B3B6B', 'Pruim', 4),
  ('#2E7A73', 'Petrol', 5),
  ('#B85C2E', 'Terracotta', 6),
  ('#565F6B', 'Leisteen', 7);

-- ── Spelerfundamenten ──────────────────────────────────────────────────────
alter table public.game_night_players
  add column if not exists nickname text,
  -- `set null` (niet `cascade`/`restrict`): het verwijderen van een
  -- auth-account mag nooit de speler zelf of zijn historie raken — alleen
  -- de koppeling verdwijnt, het spelersprofiel blijft intact. Nullable en
  -- in V2.1 zonder enige RLS-betekenis: deze kolom geeft nog GEEN nieuwe
  -- toegangsrechten (geen game_night_member-rol, geen self-service
  -- accountflow — dat is expliciet latere scope).
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists color_id uuid references public.game_night_color_palette(id) on delete set null;

-- Eén auth-account hoort bij hoogstens één speler.
create unique index if not exists game_night_players_auth_user_id_idx
  on public.game_night_players (auth_user_id)
  where auth_user_id is not null;

comment on column public.game_night_players.nickname is
  'Primaire weergavenaam voor Game Night V2 (spelers wijzigen dit later zelf). NULL = nog niet gezet; weergavelogica valt dan terug op `name`. `name` blijft de echte/bestaande naam en wijzigt niet van betekenis.';
comment on column public.game_night_players.auth_user_id is
  'Koppeling met een Supabase auth-account (V2 telefoonprofiel). Geeft in V2.1 GEEN nieuwe toegangsrechten — er is geen RLS-policy die dit veld leest. Player-record kan zonder account bestaan (owner voegt spelers nu al handmatig toe); een account hoort bij hoogstens één speler (zie unique index).';
comment on column public.game_night_players.color_id is
  'Verwijzing naar het gecureerde palet (game_night_color_palette). NULL = nog geen gecureerde kleur gekozen; de bestaande vrije-tekstkolom `color` blijft als fallback voor al gezette, niet-gecureerde kleuren.';

-- ── Spelthemafundament ─────────────────────────────────────────────────────
alter table public.game_night_games
  add column if not exists accent_color_id uuid references public.game_night_color_palette(id) on delete set null;

comment on column public.game_night_games.accent_color_id is
  'Optionele accentkleur uit hetzelfde gecureerde palet als spelers (Game Night V2 per-spel-thema). NULL = geen accent, UI valt terug op het neutrale standaardpalet. Geen UI in V2.1.';
