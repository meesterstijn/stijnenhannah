-- Rainbow Six Siege LAN Companion — fase 2.2, deel 2: achievement-fundament.
-- Alleen de structuur + wat gedemonstreerde startdata — geen automatische
-- toekenningslogica en geen beheerpagina in deze fase.

-- Composite-FK-fundament voor cross-session-integriteit (fase 2.2
-- SQL-audit): `r6_matches.id` alleen is al uniek, maar een kolom die zowel
-- match_id als session_id opslaat (hieronder r6_player_achievements,
-- later ook r6_session_chaos_effects/r6_session_media) kan met een gewone
-- foreign key op id niet tegenhouden dat een match_id uit sessie A wordt
-- gecombineerd met een session_id van sessie B. Deze unique constraint op
-- (id, session_id) — puur een extra kolomcombinatie om tegen te refereren,
-- id blijft los ook al uniek — maakt een samengestelde foreign key
-- mogelijk die dat wél afdwingt.
alter table public.r6_matches add constraint r6_matches_id_session_id_uq unique (id, session_id);

create table if not exists public.r6_achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon text,
  category text,
  -- condition_type/condition_value beschrijven (voor een latere
  -- toekenningsengine) ONDER WELKE voorwaarde dit behaald wordt, bv.
  -- condition_type = 'stat_threshold', condition_value = {"stat": "aces", "gte": 1}.
  -- Vrij van vorm (jsonb) omdat de daadwerkelijke engine nog niet bestaat —
  -- bewust nog niet dichtgetimmerd in losse kolommen.
  condition_type text,
  condition_value jsonb,
  points integer not null default 0,
  is_secret boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_r6_achievements_updated_at on public.r6_achievements;
create trigger trg_r6_achievements_updated_at
  before update on public.r6_achievements
  for each row
  execute function public.r6_set_updated_at();

alter table public.r6_achievements enable row level security;

create policy "Authenticated users can do everything" on public.r6_achievements
  for all to authenticated using (true) with check (true);

-- Behaalde achievements. session_id/match_id zijn beide nullable zodat één
-- tabel zowel lifetime- (beide null), sessie- (alleen session_id) als
-- match-gebonden (beide gevuld) achievements kan vastleggen.
--
-- `achievement_id` is bewust `on delete restrict`: een al behaalde
-- achievement mag niet hard verwijderd worden (zie ook de instructie om
-- `is_active = false` te gebruiken i.p.v. te verwijderen) — de foreign key
-- dwingt dat ook op databaseniveau af, niet alleen via een UI-afspraak.
create table if not exists public.r6_player_achievements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.r6_players(id) on delete cascade,
  achievement_id uuid not null references public.r6_achievements(id) on delete restrict,
  -- Session-gebonden achievements verdwijnen mee als de sessie wordt
  -- verwijderd (zie 20260807060000) — een behaalde achievement die alleen
  -- betekenis had binnen die ene LAN heeft geen bestaansreden meer zonder
  -- de sessie. Lifetime-achievements (session_id null) blijven ongemoeid.
  session_id uuid references public.r6_sessions(id) on delete cascade,
  -- Geen simpele `references r6_matches(id)` hier: de samengestelde FK
  -- verderop (match_id, session_id) dekt dit al, strenger, en twee aparte
  -- FK's op dezelfde kolom zou puur overbodig zijn.
  match_id uuid,
  earned_at timestamptz not null default now(),
  -- Uitsluitend aanvullende context (bv. "welke map", "hoeveel kills toen") —
  -- nooit een vervanging van player_id/achievement_id/session_id/match_id
  -- zelf, die blijven altijd als losse kolommen leidend.
  metadata jsonb,
  -- Cross-session-integriteit (fase 2.2 SQL-audit):
  -- 1. Als match_id gevuld is, moet de match ook daadwerkelijk bij
  --    session_id horen — een samengestelde FK op (match_id, session_id)
  --    tegen r6_matches(id, session_id). MATCH SIMPLE (het Postgres-
  --    standaardgedrag) slaat de check over zodra één van de twee kolommen
  --    NULL is, dus dit staat "match_id is null" gewoon toe (lifetime/
  --    sessie-achievement) — precies het gewenste gedrag.
  -- 2. Diezelfde MATCH SIMPLE-eigenschap betekent dat de FK hierboven NIET
  --    tegenhoudt dat match_id gevuld is terwijl session_id leeg blijft
  --    (die combinatie zou de FK-check overslaan). Deze losse check-
  --    constraint sluit dat gat.
  -- 3. Als session_id gevuld is, moet player_id ook daadwerkelijk aan die
  --    sessie deelnemen — samengestelde FK tegen r6_session_players
  --    (session_id, player_id), met dezelfde MATCH SIMPLE-vrijstelling
  --    voor lifetime-achievements (session_id null).
  constraint r6_player_achievements_match_session_fk
    foreign key (match_id, session_id) references public.r6_matches (id, session_id) on delete cascade,
  constraint r6_player_achievements_match_requires_session
    check (match_id is null or session_id is not null),
  constraint r6_player_achievements_session_player_fk
    foreign key (session_id, player_id) references public.r6_session_players (session_id, player_id)
);

-- Drie partiële unieke indexen i.p.v. één brede unique-constraint: een
-- gewone `unique(player_id, achievement_id, session_id, match_id)` zou NIET
-- werken voor lifetime-achievements, want PostgreSQL behandelt NULL = NULL
-- niet als gelijk in een unique-constraint (twee "lifetime"-rijen met beide
-- kolommen NULL zouden dus alsnog dubbel toegekend kunnen worden). Deze drie
-- partiële indexen dekken elk exact één scope en zijn wél waterdicht.
create unique index if not exists r6_player_achievements_lifetime_uq
  on public.r6_player_achievements (player_id, achievement_id)
  where session_id is null and match_id is null;

create unique index if not exists r6_player_achievements_session_uq
  on public.r6_player_achievements (player_id, achievement_id, session_id)
  where session_id is not null and match_id is null;

create unique index if not exists r6_player_achievements_match_uq
  on public.r6_player_achievements (player_id, achievement_id, match_id)
  where match_id is not null;

create index if not exists r6_player_achievements_player_id_idx on public.r6_player_achievements (player_id);
create index if not exists r6_player_achievements_session_id_idx on public.r6_player_achievements (session_id);

alter table public.r6_player_achievements enable row level security;

-- Nog geen enkel UI-pad schrijft naar deze tabel in deze fase (automatische
-- toekenning volgt in een latere fase, samen met de engine) — een
-- sessie-live-lock zoals bij r6_matches is daarom nu nog niet zinvol
-- af te dwingen en wordt tegelijk met die toekenningslogica toegevoegd.
create policy "Authenticated users can do everything" on public.r6_player_achievements
  for all to authenticated using (true) with check (true);

-- Gedemonstreerde startdata — expliciet gemarkeerd als voorbeeld, geen
-- volledige/uitputtende achievementset. `condition_type`/`condition_value`
-- zijn ingevuld als documentatie van de bedoeling, ook al leest nog niets
-- ze uit.
insert into public.r6_achievements (code, name, description, icon, category, condition_type, condition_value, points, sort_order) values
  ('first_ace', 'Eerste Ace', 'Behaal je eerste ace tijdens een LAN-avond.', '🎯', 'demo', 'stat_threshold', '{"stat": "aces", "gte": 1}', 5, 1),
  ('clutch_king', 'Clutch King', 'Win drie clutches binnen één LAN-avond.', '👑', 'demo', 'stat_threshold', '{"stat": "clutches", "gte": 3, "scope": "session"}', 10, 2),
  ('headshot_specialist', 'Headshot Specialist', 'Behaal tien headshots binnen één LAN-avond.', '🎯', 'demo', 'stat_threshold', '{"stat": "headshots", "gte": 10, "scope": "session"}', 5, 3),
  ('medic', 'Medic', 'Revive vijf keer een teamgenoot binnen één LAN-avond.', '💉', 'demo', 'stat_threshold', '{"stat": "revives", "gte": 5, "scope": "session"}', 5, 4)
on conflict (code) do nothing;
