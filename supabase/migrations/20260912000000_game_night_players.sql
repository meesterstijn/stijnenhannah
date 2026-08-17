-- Game Night — permanente spelers. Iedereen die meespeelt krijgt een
-- blijvend spelersprofiel (geen gastmodus, zie de opdracht sectie 2) zodat
-- latere statistieken/Hall of Fame altijd een stabiele player_id hebben om
-- naartoe te herleiden. Zelfde owner-only rechtenpatroon als de rest van
-- Game Night (private.is_owner(), zie 20260911000000_game_night_games.sql).
--
-- Geen hard-delete: een speler met historie mag nooit verdwijnen (sectie
-- 26). `archived_at` verbergt een speler uit de actieve selectielijst
-- zonder ook maar één FK/resultaatrij aan te raken — dezelfde soft-delete
-- vorm als qr_labels.deleted_at (20260907000000).

create table public.game_night_players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  -- Vrije tekstwaarde (bv. een hex-kleur of een tokenkleur zoals "amber") —
  -- bewust geen enum, de UI bepaalt hoe dit gerenderd wordt.
  color text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.game_night_players.archived_at is
  'Soft-delete/archief-tijdstip. Null = normaal actief, selecteerbaar voor nieuwe Game Nights. Niet-null = gearchiveerd: verdwijnt uit de actieve spelerslijst, maar de rij en al zijn resultaathistorie blijven intact.';

-- De veelgebruikte query is "actieve spelers, gesorteerd" — deze partial
-- index dekt precies dat pad zonder gearchiveerde spelers mee te tellen.
create index game_night_players_active_idx
  on public.game_night_players (sort_order, name)
  where archived_at is null;

create trigger set_game_night_players_updated_at
  before update on public.game_night_players
  for each row execute function public.set_updated_at();

alter table public.game_night_players enable row level security;

create policy "game_night_players: owner only" on public.game_night_players
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_players from anon;
