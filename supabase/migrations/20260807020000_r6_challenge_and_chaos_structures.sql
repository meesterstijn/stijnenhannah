-- Rainbow Six Siege LAN Companion — fase 2.2, deel 3: uitbreidbare
-- challenge- en chaos-structuur.
--
-- BEWUSTE, GEDOCUMENTEERDE GEFASEERDE AANPAK (in plaats van een volledige
-- herstructurering nu):
--
-- Bron van waarheid vandaag: `r6_matches.challenge_id` / `challenge_completed`
-- en `r6_matches.chaos_rule` (beide uit Fase 2.1) blijven de enige plek waar
-- het BESTAANDE matchformulier naar schrijft — dat blijft ongewijzigd
-- werken. Deze migratie voegt er NIETS aan toe en dupliceert er niets van:
-- er wordt geen rij in de nieuwe tabellen aangemaakt voor bestaande of
-- nieuwe "één challenge per match"-registraties via het huidige formulier.
--
-- Wat hier NIEUW bijkomt: `r6_session_challenges` en
-- `r6_chaos_effects`/`r6_session_chaos_effects` zijn voorbereid voor een
-- LATERE fase waarin een challenge/chaos-effect ook over meerdere matches of
-- de volledige sessie kan lopen (scope 'match_range'/'full_session'). Zolang
-- die latere fase niet gebouwd is, blijven deze tabellen leeg (geen enkel
-- UI-pad schrijft ernaar in deze fase).
--
-- Migratiepad zonder dataverlies, voor wanneer die latere fase wél gebouwd
-- wordt: een toekomstige migratie kan per bestaande `r6_matches`-rij met
-- `challenge_id is not null` een `r6_session_challenges`-rij aanmaken met
-- `scope = 'single_match'`, `start_match_number = end_match_number =
-- r6_matches.match_number`, `completed = r6_matches.challenge_completed` —
-- dat is een zuivere backfill (geen enkele bestaande waarde gaat verloren),
-- waarna de kolommen op `r6_matches` eventueel uitfaseren. Diezelfde
-- redenering geldt voor `chaos_rule` -> `r6_session_chaos_effects` met
-- `custom_text`. Dat gebeurt hier nog niet, om het werkende Fase
-- 2.1-matchformulier niet zonder bijbehorende frontend-migratie te breken.

create table if not exists public.r6_session_challenges (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.r6_sessions(id) on delete cascade,
  challenge_id text not null references public.r6_challenges(id),
  scope text not null check (scope in ('single_match', 'match_range', 'full_session')),
  start_match_number integer,
  end_match_number integer,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  completed boolean not null default false,
  assigned_to_player_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint r6_session_challenges_scope_range_check check (
    (scope = 'single_match' and start_match_number is not null and end_match_number is not null and start_match_number = end_match_number)
    or (scope = 'match_range' and start_match_number is not null and end_match_number is not null and end_match_number >= start_match_number)
    or (scope = 'full_session' and start_match_number is null and end_match_number is null)
  ),
  -- Cross-session-integriteit (fase 2.2 SQL-audit): een toegewezen speler
  -- moet daadwerkelijk aan déze sessie deelnemen, niet zomaar een bestaande
  -- lifetime-speler zijn. Composite FK tegen r6_session_players(session_id,
  -- player_id) i.p.v. een simpele FK naar r6_players(id) — MATCH SIMPLE
  -- staat assigned_to_player_id = null (geen toewijzing) gewoon toe.
  constraint r6_session_challenges_assignee_session_fk
    foreign key (session_id, assigned_to_player_id) references public.r6_session_players (session_id, player_id)
);

create index if not exists r6_session_challenges_session_id_idx on public.r6_session_challenges (session_id);

alter table public.r6_session_challenges enable row level security;

create table if not exists public.r6_chaos_effects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  duration_type text not null check (duration_type in ('single_match', 'match_range', 'full_session')),
  default_duration integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_r6_chaos_effects_updated_at on public.r6_chaos_effects;
create trigger trg_r6_chaos_effects_updated_at
  before update on public.r6_chaos_effects
  for each row
  execute function public.r6_set_updated_at();

alter table public.r6_chaos_effects enable row level security;

create policy "Authenticated users can do everything" on public.r6_chaos_effects
  for all to authenticated using (true) with check (true);

-- Startdata die de vrije voorbeeldenlijst uit Fase 1/2.1 (v1-preview, en het
-- huidige vrije-tekstveld chaos_rule) alvast als gestructureerde opties
-- beschikbaar maakt, zonder dat het matchformulier er al gebruik van maakt.
insert into public.r6_chaos_effects (name, description, duration_type, sort_order) values
  ('Alleen shotguns', 'Iedereen speelt alleen met shotguns.', 'single_match', 1),
  ('Alleen pistolen', 'Iedereen speelt alleen met pistolen.', 'single_match', 2),
  ('Operator blind kiezen', 'Kies je operator zonder te kijken.', 'single_match', 3),
  ('Geen drones gebruiken', 'Geen enkele drone deze ronde/sessie.', 'single_match', 4),
  ('Alleen melee kills', 'Alleen melee-kills tellen mee.', 'single_match', 5),
  ('Iedereen crouch-walk', 'Iedereen blijft gehurkt lopen.', 'single_match', 6),
  ('Alleen dezelfde operator-duo''s', 'Beide spelers spelen dezelfde operator.', 'single_match', 7)
on conflict (name) do nothing;

create table if not exists public.r6_session_chaos_effects (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.r6_sessions(id) on delete cascade,
  match_id uuid,
  chaos_effect_id uuid references public.r6_chaos_effects(id),
  custom_text text,
  start_match_number integer,
  end_match_number integer,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  constraint r6_session_chaos_effects_source_check check (chaos_effect_id is not null or custom_text is not null),
  -- Cross-session-integriteit (fase 2.2 SQL-audit): match_id (indien
  -- ingevuld) moet daadwerkelijk bij déze session_id horen — voorkomt dat
  -- een match uit sessie A aan een chaos-effect-rij van sessie B gekoppeld
  -- wordt. Composite FK i.p.v. een simpele FK naar r6_matches(id); MATCH
  -- SIMPLE staat match_id = null (chaos-effect voor de hele sessie) toe.
  constraint r6_session_chaos_effects_match_session_fk
    foreign key (match_id, session_id) references public.r6_matches (id, session_id) on delete cascade
);

create index if not exists r6_session_chaos_effects_session_id_idx on public.r6_session_chaos_effects (session_id);
create index if not exists r6_session_chaos_effects_match_id_idx on public.r6_session_chaos_effects (match_id);

alter table public.r6_session_chaos_effects enable row level security;
