-- Game Night — huidige spellenkast (section 6). Feitelijke spelmetadata
-- (spelersaantal/duur/moeilijkheid) is publieke, niet-auteursrechtelijke
-- informatie over hoe een spel gespeeld wordt — geen covers/artwork, die
-- blijven `cover_storage_path = null` totdat er echte covers geüpload
-- worden (de UI toont dan een ontworpen placeholder, zie GameCard.tsx).
-- Vaste uuid's + on conflict do nothing, zelfde herdraaibestendige aanpak
-- als de andere seed-migraties in dit project.

insert into public.game_night_games (id, name, min_players, max_players, duration_minutes, difficulty, tags) values
  ('9a000000-0000-4000-8000-000000000001', 'Catan', 3, 4, 90, 'gemiddeld', array['Strategie', 'Handelen', 'Bouwen']),
  ('9a000000-0000-4000-8000-000000000002', 'Hitster', 2, 10, 30, 'licht', array['Muziek', 'Party', 'Gokken']),
  ('9a000000-0000-4000-8000-000000000003', 'Secret Hitler', 5, 10, 45, 'gemiddeld', array['Bluffen', 'Sociaal', 'Verraad']),
  ('9a000000-0000-4000-8000-000000000004', 'Kaartspel (standaard)', 2, 8, 20, 'licht', array['Klassiek', 'Flexibel', 'Kaarten']),
  ('9a000000-0000-4000-8000-000000000005', 'Sequence', 2, 12, 40, 'licht', array['Strategie', 'Bordspel', 'Tactiek']),
  ('9a000000-0000-4000-8000-000000000006', 'Catan kaartspel', 2, 2, 60, 'gemiddeld', array['Strategie', 'Duel', 'Bouwen']),
  ('9a000000-0000-4000-8000-000000000007', 'Carcassonne', 2, 5, 45, 'gemiddeld', array['Strategie', 'Tactiek', 'Relaxed']),
  ('9a000000-0000-4000-8000-000000000008', 'Just One', 3, 7, 20, 'licht', array['Coöperatief', 'Woorden', 'Party']),
  ('9a000000-0000-4000-8000-000000000009', 'Lost Cities', 2, 2, 30, 'gemiddeld', array['Strategie', 'Duel', 'Kaarten']),
  ('9a000000-0000-4000-8000-00000000000a', 'Hand-to-Hand Wombat', 2, 6, 15, 'licht', array['Snel', 'Reactie', 'Party']),
  ('9a000000-0000-4000-8000-00000000000b', 'Skull', 3, 6, 30, 'gemiddeld', array['Bluffen', 'Sociaal', 'Spanning']),
  ('9a000000-0000-4000-8000-00000000000c', '1000 Bommen & Granaten', 2, 10, 30, 'licht', array['Kaarten', 'Snel', 'Tactiek']),
  ('9a000000-0000-4000-8000-00000000000d', 'Keezen', 2, 6, 45, 'licht', array['Klassiek', 'Familie', 'Bordspel']),
  ('9a000000-0000-4000-8000-00000000000e', 'Sounds Fishy', 3, 6, 30, 'licht', array['Bluffen', 'Party', 'Lachen']),
  ('9a000000-0000-4000-8000-00000000000f', 'De Grote Dalmuti', 4, 8, 30, 'licht', array['Kaarten', 'Party', 'Chaos']),
  ('9a000000-0000-4000-8000-000000000010', 'LAMA', 2, 6, 15, 'licht', array['Kaarten', 'Snel', 'Tactiek']),
  ('9a000000-0000-4000-8000-000000000011', 'Koi', 2, 4, 20, 'licht', array['Strategie', 'Relaxed', 'Kaarten']),
  ('9a000000-0000-4000-8000-000000000012', 'Exploding Kittens', 2, 5, 15, 'licht', array['Kaarten', 'Party', 'Snel']),
  ('9a000000-0000-4000-8000-000000000013', 'Exploding Kittens bordspel', 2, 5, 30, 'licht', array['Bordspel', 'Party', 'Chaos'])
on conflict (id) do nothing;
