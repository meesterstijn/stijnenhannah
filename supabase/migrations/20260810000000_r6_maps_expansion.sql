-- Rainbow Six Siege LAN Companion — r6_maps aanvullen met kaarten die
-- ontbraken t.o.v. de huidige, officiële Ubisoft mappool
-- (https://www.ubisoft.com/en-gb/game/rainbow-six/siege/game-info/maps):
-- Calypso Casino, Stadium Alpha, Stadium Bravo, Close Quarter en Tower.
-- Zelfde patroon als de bestaande seed (20260805000000): `id` is een
-- stabiele, leesbare slug, `on conflict (id) do nothing` maakt dit veilig
-- om opnieuw te draaien en tast bestaande rijen (en dus bestaande matches
-- die naar een map_id verwijzen) niet aan.
insert into public.r6_maps (id, name, sort_order) values
  ('calypso-casino', 'Calypso Casino', 23),
  ('stadium-alpha', 'Stadium Alpha', 24),
  ('stadium-bravo', 'Stadium Bravo', 25),
  ('close-quarter', 'Close Quarter', 26),
  ('tower', 'Tower', 27)
on conflict (id) do nothing;
