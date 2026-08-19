-- Game Night V2.8 — kleinst mogelijke duurzame uitbreiding voor "Player
-- Characters" (opdracht sectie 5): één nullable kolom op de bestaande
-- public.game_night_players, met een vaste preset-allowlist. Zelfde patroon
-- als arena_style/arena_symbol/celebration_style op game_night_games
-- (20260912200000_game_night_arena_config.sql) — een gewone CHECK-
-- constraint volstaat, geen normalisatie nodig (het is uitsluitend een
-- vaste preset-id, geen vrije tekst/kleur).
--
-- BELANGRIJK (sectie 15): character is identiteit van de SPELER, niet van
-- een Game Night-sessie of -deelname — dus op game_night_players zelf, niet
-- op game_night_session_players. Blijft dus automatisch hetzelfde over
-- meerdere Game Nights totdat een speler/de owner het wijzigt.
--
-- Dit is FASE 1 (sectie 6/30): alleen een base-character-id. Cosmetics/
-- kleur-override/unlockables/hats/emotes zijn bewust NIET onderdeel van
-- deze migratie — character_id is een enkele kolom, geen nieuwe tabel, juist
-- om die latere uitbreiding niet dicht te timmeren (een aparte
-- game_night_player_cosmetics-tabel kan er later naast komen zonder deze
-- kolom te hoeven wijzigen).
--
-- Twaalf presets, gekozen uit de richtingen in de opdracht (sectie 4) met
-- een duidelijk te onderscheiden tijdelijk icoon (zie
-- src/features/game-night/lib/characterPresets.ts) — bewust GEEN 14e/15e
-- variant toegevoegd zonder visueel te onderscheiden icoon (bv. "goblin" en
-- "skeleton" zouden hetzelfde schedel-icoon delen; alleen "skeleton" is
-- opgenomen).
--
-- RLS: geen nieuwe policy nodig — "game_night_players: owner only" (FOR
-- ALL) dekt de owner-kant al per rij. Voor de member-self-service-kant
-- (eigen character kiezen) breidt 20260913000010_game_night_character_rpc.sql
-- de bestaande game_night_update_my_profile-RPC uit i.p.v. een nieuwe RPC
-- te bouwen — dezelfde SECURITY DEFINER-grens die nickname/color_id al
-- gebruikt.

alter table public.game_night_players
  add column if not exists character_id text;

comment on column public.game_night_players.character_id is
  'V2.8: gekozen Game Night-character-preset (vaste allowlist, zie constraint). Null = nog geen character gekozen; de UI toont dan een initiaal-fallback. Blijft ongewijzigd over meerdere Game Nights totdat de speler/owner het wijzigt (identiteit van de speler, geen sessie-eigenschap).';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_night_players_character_id_check'
      and conrelid = 'public.game_night_players'::regclass
  ) then
    alter table public.game_night_players
      add constraint game_night_players_character_id_check
      check (
        character_id is null or character_id in (
          'knight', 'wizard', 'astronaut', 'pirate', 'ninja', 'robot',
          'viking', 'detective', 'bard', 'racer', 'royal', 'skeleton'
        )
      );
  end if;
end $$;
