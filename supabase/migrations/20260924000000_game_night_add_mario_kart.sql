-- Game Night — Mario Kart toevoegen aan de spellenkast. Anders dan de
-- overige spellen gebruikt Mario Kart geen rondes/sessieresultaten (sectie
-- "Klassement" op GameNightGameDetail blijft voor dit spel leeg) maar een
-- eigen, per-Game-Night resettend puntenklassement — zie
-- 20260924010000_game_night_mario_kart_points.sql. `slug` wordt hier meteen
-- gezet (in tegenstelling tot de oorspronkelijke seed, die slugs pas later
-- via een aparte migratie toevoegde) omdat GameNightGameDetail er nu al op
-- routeert (gameDetailPath) en de nieuwe MarioKartLeaderboard-component 'm
-- gebruikt om dit ene spel te herkennen.
insert into public.game_night_games (id, name, slug, min_players, max_players, duration_minutes, difficulty, tags) values
  ('9a000000-0000-4000-8000-000000000014', 'Mario Kart', 'mario-kart', 2, 10, 30, 'licht', array['party', 'snel', 'elkaar-dwarszitten'])
on conflict (id) do nothing;
