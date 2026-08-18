-- Game Night V5 — Geschiedenis, Spelerprofielen, Hall of Fame & titels.
--
-- Geen nieuwe tabellen: alle statistieken/records/titels worden client-side
-- (TypeScript, src/features/game-night/lib/gameNightStats.ts +
-- gameNightTitles.ts) berekend uit al bestaande rijen in
-- game_night_sessions/game_night_game_sessions/game_night_rounds/
-- game_night_round_results/game_night_game_session_results/etc. — geen
-- "player_awards"-cachetabel (sectie 50: dat zou een titel als opgeslagen
-- waarheid behandelen i.p.v. als afgeleide van historie).
--
-- Het enige dat wél ontbrak: een STABIELE, naam-onafhankelijke sleutel om
-- spel-specifieke titels (Skullcrusher e.d.) aan te koppelen (sectie 21) —
-- `game_night_games.name` is vrije tekst en dus geen betrouwbare key voor
-- `if game.name === 'Skull'`-achtige logica. Deze migratie voegt alleen die
-- ene kolom toe + backfilt 'm voor de 19 bestaande seed-spellen. Nullable
-- (geen NOT NULL): een spel zonder slug matcht simpelweg geen
-- spel-specifieke titelconfiguratie, maar blijft verder volledig normaal
-- bruikbaar (geen crash, geen verplichte migratie-volgorde voor toekomstige
-- handmatige game-inserts).

alter table public.game_night_games
  add column if not exists slug text;

comment on column public.game_night_games.slug is
  'Stabiele, naam-onafhankelijke sleutel voor spel-specifieke Hall of Fame-titels (zie gameNightTitles.ts GAME_AWARD_CONFIGS). Null = dit spel heeft nog geen spel-specifieke titel gekoppeld; dat is geen fout, alleen games met een bekende slug doen mee aan zulke titels.';

create unique index if not exists game_night_games_slug_idx
  on public.game_night_games (slug)
  where slug is not null;

update public.game_night_games set slug = 'catan'
  where id = '9a000000-0000-4000-8000-000000000001';
update public.game_night_games set slug = 'hitster'
  where id = '9a000000-0000-4000-8000-000000000002';
update public.game_night_games set slug = 'secret-hitler'
  where id = '9a000000-0000-4000-8000-000000000003';
update public.game_night_games set slug = 'kaartspel-standaard'
  where id = '9a000000-0000-4000-8000-000000000004';
update public.game_night_games set slug = 'sequence'
  where id = '9a000000-0000-4000-8000-000000000005';
update public.game_night_games set slug = 'catan-kaartspel'
  where id = '9a000000-0000-4000-8000-000000000006';
update public.game_night_games set slug = 'carcassonne'
  where id = '9a000000-0000-4000-8000-000000000007';
update public.game_night_games set slug = 'just-one'
  where id = '9a000000-0000-4000-8000-000000000008';
update public.game_night_games set slug = 'lost-cities'
  where id = '9a000000-0000-4000-8000-000000000009';
update public.game_night_games set slug = 'hand-to-hand-wombat'
  where id = '9a000000-0000-4000-8000-00000000000a';
update public.game_night_games set slug = 'skull'
  where id = '9a000000-0000-4000-8000-00000000000b';
update public.game_night_games set slug = '1000-bommen-en-granaten'
  where id = '9a000000-0000-4000-8000-00000000000c';
update public.game_night_games set slug = 'keezen'
  where id = '9a000000-0000-4000-8000-00000000000d';
update public.game_night_games set slug = 'sounds-fishy'
  where id = '9a000000-0000-4000-8000-00000000000e';
update public.game_night_games set slug = 'de-grote-dalmuti'
  where id = '9a000000-0000-4000-8000-00000000000f';
update public.game_night_games set slug = 'lama'
  where id = '9a000000-0000-4000-8000-000000000010';
update public.game_night_games set slug = 'koi'
  where id = '9a000000-0000-4000-8000-000000000011';
update public.game_night_games set slug = 'exploding-kittens'
  where id = '9a000000-0000-4000-8000-000000000012';
update public.game_night_games set slug = 'exploding-kittens-bordspel'
  where id = '9a000000-0000-4000-8000-000000000013';
