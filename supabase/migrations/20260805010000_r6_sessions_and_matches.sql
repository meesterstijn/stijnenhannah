-- Rainbow Six Siege LAN Companion — fase 2, deel 2: sessies en matches.
--
-- Structuur: r6_sessions (één LAN-avond) -> r6_session_players (welke
-- spelers deden mee) -> r6_matches (elke gespeelde ronde) -> r6_match_players
-- (per-speler resultaat/statistieken van die ene match). Niets hiervan
-- slaat een totaalscore op — het scorebord wordt altijd afgeleid uit
-- r6_matches + r6_match_players (zie scoring.ts aan de frontend-kant),
-- zodat er nergens dubbele opslag ontstaat.

create table if not exists public.r6_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Operation LANstorm',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'live' check (status in ('live', 'ended')),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.r6_session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.r6_sessions(id) on delete cascade,
  player_id uuid not null references public.r6_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, player_id)
);

create table if not exists public.r6_matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.r6_sessions(id) on delete cascade,
  -- Automatisch toegekend door de trigger hieronder, niet door de client.
  match_number integer not null,
  played_at timestamptz not null default now(),
  map_id text references public.r6_maps(id),
  challenge_id text references public.r6_challenges(id),
  challenge_completed boolean not null default false,
  chaos_rule text,
  funniest_moment text,
  notes text,
  created_at timestamptz not null default now(),
  unique (session_id, match_number)
);

-- match_number = "hoogste nummer in deze sessie tot nu toe" + 1. Als trigger
-- (niet client-side geteld) zodat dit correct blijft ook als matches ooit
-- via een ander kanaal dan de app worden ingevoegd.
create or replace function public.set_r6_match_number()
returns trigger
language plpgsql
as $$
begin
  if new.match_number is null then
    select coalesce(max(match_number), 0) + 1
    into new.match_number
    from public.r6_matches
    where session_id = new.session_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_r6_match_number on public.r6_matches;
create trigger trg_set_r6_match_number
  before insert on public.r6_matches
  for each row
  execute function public.set_r6_match_number();

create table if not exists public.r6_match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.r6_matches(id) on delete cascade,
  player_id uuid not null references public.r6_players(id) on delete cascade,
  result text not null check (result in ('win', 'loss')),
  -- Eén operator per zijde; alleen operator_single_id ingevuld wanneer maar
  -- één zijde is gespeeld die ronde.
  operator_attacker_id text references public.r6_operators(id),
  operator_defender_id text references public.r6_operators(id),
  operator_single_id text references public.r6_operators(id),
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  revives integer not null default 0,
  headshots integer not null default 0,
  mvp boolean not null default false,
  clutch boolean not null default false,
  ace boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists r6_matches_session_id_idx on public.r6_matches (session_id);
create index if not exists r6_match_players_match_id_idx on public.r6_match_players (match_id);
create index if not exists r6_match_players_player_id_idx on public.r6_match_players (player_id);
create index if not exists r6_session_players_session_id_idx on public.r6_session_players (session_id);

alter table public.r6_sessions enable row level security;
alter table public.r6_session_players enable row level security;
alter table public.r6_matches enable row level security;
alter table public.r6_match_players enable row level security;

create policy "Authenticated users can do everything" on public.r6_sessions
  for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on public.r6_session_players
  for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on public.r6_matches
  for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on public.r6_match_players
  for all to authenticated using (true) with check (true);
