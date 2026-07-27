-- Rainbow Six Siege LAN Companion — fase 2, deel 1: stamdata.
--
-- Maps, operators en challenges zijn losse lookup-tabellen (in plaats van
-- een check-constraint of hardcoded frontend-lijst) juist omdat Ubisoft
-- regelmatig nieuwe maps/operators toevoegt: een nieuwe rij toevoegen via
-- de dashboard/SQL-editor is dan genoeg, zonder code-deploy of migratie.
-- `active` laat toe een map/operator "met pensioen" te sturen (bv. Favela
-- in het verleden) zonder historische matches te breken.
--
-- `r6_players` is een huishoud-brede spelerslijst, herbruikbaar over alle
-- toekomstige LAN's heen — dit is bewust de basis voor de "spelerprofielen"
-- en "lifetime statistieken" die later worden toegevoegd (zie fase 3+).

create table if not exists public.r6_players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Case-insensitieve uniciteit ("Stijn" en "stijn" zijn dezelfde speler) —
-- voorkomt dubbele opslag zonder de citext-extensie nodig te hebben.
create unique index if not exists r6_players_name_lower_key on public.r6_players (lower(name));

create table if not exists public.r6_maps (
  id text primary key,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.r6_operators (
  id text primary key,
  name text not null,
  side text not null check (side in ('attacker', 'defender')),
  active boolean not null default true
);

create table if not exists public.r6_challenges (
  id text primary key,
  name text not null,
  -- Centraal punt om de challenge-bonus per challenge aan te passen (zie
  -- ook 20260805020000_r6_session_rpcs.sql / scoring.ts aan de frontend-
  -- kant) — geen enkele bonuswaarde staat hardcoded in de UI.
  bonus_points integer not null default 2,
  active boolean not null default true
);

alter table public.r6_players enable row level security;
alter table public.r6_maps enable row level security;
alter table public.r6_operators enable row level security;
alter table public.r6_challenges enable row level security;

create policy "Authenticated users can do everything" on public.r6_players
  for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on public.r6_maps
  for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on public.r6_operators
  for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on public.r6_challenges
  for all to authenticated using (true) with check (true);

insert into public.r6_maps (id, name, sort_order) values
  ('bank', 'Bank', 1),
  ('clubhouse', 'Clubhouse', 2),
  ('chalet', 'Chalet', 3),
  ('border', 'Border', 4),
  ('oregon', 'Oregon', 5),
  ('kafe-dostoyevsky', 'Kafe Dostoyevsky', 6),
  ('coastline', 'Coastline', 7),
  ('villa', 'Villa', 8),
  ('skyscraper', 'Skyscraper', 9),
  ('theme-park', 'Theme Park', 10),
  ('kanal', 'Kanal', 11),
  ('consulate', 'Consulate', 12),
  ('nighthaven-labs', 'Nighthaven Labs', 13),
  ('lair', 'Lair', 14),
  ('outback', 'Outback', 15),
  ('emerald-plains', 'Emerald Plains', 16),
  ('favela', 'Favela', 17),
  ('plane', 'Plane', 18),
  ('yacht', 'Yacht', 19),
  ('house', 'House', 20),
  ('fortress', 'Fortress', 21),
  ('hereford-base', 'Hereford Base', 22)
on conflict (id) do nothing;

insert into public.r6_operators (id, name, side) values
  ('sledge', 'Sledge', 'attacker'),
  ('thatcher', 'Thatcher', 'attacker'),
  ('ash', 'Ash', 'attacker'),
  ('thermite', 'Thermite', 'attacker'),
  ('twitch', 'Twitch', 'attacker'),
  ('blitz', 'Blitz', 'attacker'),
  ('iq', 'IQ', 'attacker'),
  ('fuze', 'Fuze', 'attacker'),
  ('glaz', 'Glaz', 'attacker'),
  ('buck', 'Buck', 'attacker'),
  ('blackbeard', 'Blackbeard', 'attacker'),
  ('capitao', 'Capitao', 'attacker'),
  ('hibana', 'Hibana', 'attacker'),
  ('jackal', 'Jackal', 'attacker'),
  ('ying', 'Ying', 'attacker'),
  ('zofia', 'Zofia', 'attacker'),
  ('dokkaebi', 'Dokkaebi', 'attacker'),
  ('lion', 'Lion', 'attacker'),
  ('finka', 'Finka', 'attacker'),
  ('maverick', 'Maverick', 'attacker'),
  ('nomad', 'Nomad', 'attacker'),
  ('gridlock', 'Gridlock', 'attacker'),
  ('nokk', 'Nokk', 'attacker'),
  ('amaru', 'Amaru', 'attacker'),
  ('smoke', 'Smoke', 'defender'),
  ('mute', 'Mute', 'defender'),
  ('castle', 'Castle', 'defender'),
  ('pulse', 'Pulse', 'defender'),
  ('doc', 'Doc', 'defender'),
  ('rook', 'Rook', 'defender'),
  ('kapkan', 'Kapkan', 'defender'),
  ('tachanka', 'Tachanka', 'defender'),
  ('jager', 'Jager', 'defender'),
  ('bandit', 'Bandit', 'defender'),
  ('frost', 'Frost', 'defender'),
  ('valkyrie', 'Valkyrie', 'defender'),
  ('caveira', 'Caveira', 'defender'),
  ('echo', 'Echo', 'defender'),
  ('mira', 'Mira', 'defender'),
  ('lesion', 'Lesion', 'defender'),
  ('ela', 'Ela', 'defender'),
  ('vigil', 'Vigil', 'defender'),
  ('maestro', 'Maestro', 'defender'),
  ('alibi', 'Alibi', 'defender'),
  ('clash', 'Clash', 'defender'),
  ('kaid', 'Kaid', 'defender'),
  ('mozzie', 'Mozzie', 'defender'),
  ('warden', 'Warden', 'defender')
on conflict (id) do nothing;

insert into public.r6_challenges (id, name, bonus_points) values
  ('alleen-shotguns', 'Alleen shotguns', 2),
  ('alleen-pistolen', 'Alleen pistolen', 2),
  ('geen-drones', 'Geen drones', 2),
  ('alleen-melee', 'Alleen melee', 2),
  ('crouch-only', 'Crouch only', 2),
  ('recruit-only', 'Recruit only', 2),
  ('shield-only', 'Shield only', 2)
on conflict (id) do nothing;
