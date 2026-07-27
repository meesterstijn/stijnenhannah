-- Rainbow Six Siege LAN Companion — fase 2.1, deel 1: referentiedata
-- corrigeren en uitbreiden. Wijzigt r6_maps/r6_operators/r6_challenges uit
-- 20260805000000_r6_reference_data.sql (dat bestand blijft zelf ongewijzigd
-- — dit is een vervolgmigratie zoals gevraagd).

-- `active` -> `is_active`: consistente naamgeving, zoals gevraagd, over alle
-- drie referentietabellen. Een rename is lossless (kolominhoud blijft
-- intact), dus veilig op zowel een lege als een reeds gevulde database.
alter table public.r6_maps rename column active to is_active;
alter table public.r6_operators rename column active to is_active;
alter table public.r6_challenges rename column active to is_active;

-- sort_order ontbrak nog op operators/challenges (r6_maps had 'm al). Nuttig
-- voor toekomstige beheer-/wheel-UI's; default 0 zodat dit een non-destructieve
-- toevoeging is voor eventueel al bestaande rijen.
alter table public.r6_operators add column if not exists sort_order integer not null default 0;
alter table public.r6_challenges add column if not exists sort_order integer not null default 0;

-- Operators: uitgebreid van 48 naar 70 bekende operators (attackers +
-- defenders). Dit is bewust nog steeds niet 100% uitputtend tot de meest
-- recente seizoenen — dat is precies waarom dit een los te vullen
-- lookup-tabel is (zie 20260805000000). `on conflict ... do update set
-- sort_order` update alléén de sorteervolgorde van al bestaande rijen
-- (nooit `is_active`, voor het geval iemand die al bewust heeft
-- omgezet naar false) en voegt de nieuwe operators toe.
insert into public.r6_operators (id, name, side, sort_order) values
  ('sledge', 'Sledge', 'attacker', 1),
  ('thatcher', 'Thatcher', 'attacker', 2),
  ('ash', 'Ash', 'attacker', 3),
  ('thermite', 'Thermite', 'attacker', 4),
  ('twitch', 'Twitch', 'attacker', 5),
  ('blitz', 'Blitz', 'attacker', 6),
  ('iq', 'IQ', 'attacker', 7),
  ('fuze', 'Fuze', 'attacker', 8),
  ('glaz', 'Glaz', 'attacker', 9),
  ('buck', 'Buck', 'attacker', 10),
  ('blackbeard', 'Blackbeard', 'attacker', 11),
  ('capitao', 'Capitao', 'attacker', 12),
  ('hibana', 'Hibana', 'attacker', 13),
  ('jackal', 'Jackal', 'attacker', 14),
  ('ying', 'Ying', 'attacker', 15),
  ('zofia', 'Zofia', 'attacker', 16),
  ('dokkaebi', 'Dokkaebi', 'attacker', 17),
  ('lion', 'Lion', 'attacker', 18),
  ('finka', 'Finka', 'attacker', 19),
  ('maverick', 'Maverick', 'attacker', 20),
  ('nomad', 'Nomad', 'attacker', 21),
  ('gridlock', 'Gridlock', 'attacker', 22),
  ('nokk', 'Nokk', 'attacker', 23),
  ('amaru', 'Amaru', 'attacker', 24),
  ('kali', 'Kali', 'attacker', 25),
  ('iana', 'Iana', 'attacker', 26),
  ('ace', 'Ace', 'attacker', 27),
  ('zero', 'Zero', 'attacker', 28),
  ('flores', 'Flores', 'attacker', 29),
  ('osa', 'Osa', 'attacker', 30),
  ('sens', 'Sens', 'attacker', 31),
  ('grim', 'Grim', 'attacker', 32),
  ('brava', 'Brava', 'attacker', 33),
  ('ram', 'Ram', 'attacker', 34),
  ('deimos', 'Deimos', 'attacker', 35),
  ('smoke', 'Smoke', 'defender', 1),
  ('mute', 'Mute', 'defender', 2),
  ('castle', 'Castle', 'defender', 3),
  ('pulse', 'Pulse', 'defender', 4),
  ('doc', 'Doc', 'defender', 5),
  ('rook', 'Rook', 'defender', 6),
  ('kapkan', 'Kapkan', 'defender', 7),
  ('tachanka', 'Tachanka', 'defender', 8),
  ('jager', 'Jager', 'defender', 9),
  ('bandit', 'Bandit', 'defender', 10),
  ('frost', 'Frost', 'defender', 11),
  ('valkyrie', 'Valkyrie', 'defender', 12),
  ('caveira', 'Caveira', 'defender', 13),
  ('echo', 'Echo', 'defender', 14),
  ('mira', 'Mira', 'defender', 15),
  ('lesion', 'Lesion', 'defender', 16),
  ('ela', 'Ela', 'defender', 17),
  ('vigil', 'Vigil', 'defender', 18),
  ('maestro', 'Maestro', 'defender', 19),
  ('alibi', 'Alibi', 'defender', 20),
  ('clash', 'Clash', 'defender', 21),
  ('kaid', 'Kaid', 'defender', 22),
  ('mozzie', 'Mozzie', 'defender', 23),
  ('warden', 'Warden', 'defender', 24),
  ('goyo', 'Goyo', 'defender', 25),
  ('wamai', 'Wamai', 'defender', 26),
  ('oryx', 'Oryx', 'defender', 27),
  ('melusi', 'Melusi', 'defender', 28),
  ('aruni', 'Aruni', 'defender', 29),
  ('thunderbird', 'Thunderbird', 'defender', 30),
  ('thorn', 'Thorn', 'defender', 31),
  ('azami', 'Azami', 'defender', 32),
  ('solis', 'Solis', 'defender', 33),
  ('fenrir', 'Fenrir', 'defender', 34),
  ('tubarao', 'Tubarao', 'defender', 35)
on conflict (id) do update set sort_order = excluded.sort_order;

update public.r6_maps set sort_order = v.sort_order
from (values
  ('bank', 1), ('clubhouse', 2), ('chalet', 3), ('border', 4), ('oregon', 5),
  ('kafe-dostoyevsky', 6), ('coastline', 7), ('villa', 8), ('skyscraper', 9),
  ('theme-park', 10), ('kanal', 11), ('consulate', 12), ('nighthaven-labs', 13),
  ('lair', 14), ('outback', 15), ('emerald-plains', 16), ('favela', 17),
  ('plane', 18), ('yacht', 19), ('house', 20), ('fortress', 21), ('hereford-base', 22)
) as v(id, sort_order)
where public.r6_maps.id = v.id;

update public.r6_challenges set sort_order = v.sort_order
from (values
  ('alleen-shotguns', 1), ('alleen-pistolen', 2), ('geen-drones', 3),
  ('alleen-melee', 4), ('crouch-only', 5), ('recruit-only', 6), ('shield-only', 7)
) as v(id, sort_order)
where public.r6_challenges.id = v.id;
