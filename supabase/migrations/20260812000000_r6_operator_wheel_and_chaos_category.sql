-- Rainbow Six Siege LAN Companion — Operator Wheel (toewijzing per game) +
-- kleine uitbreiding van de bestaande chaos-structuur.
--
-- Chaos Wheel hergebruikt bewust de al bestaande, sinds fase 2.2 voorbereide
-- tabellen r6_chaos_effects (de wheel-segmenten: naam/omschrijving/
-- actief/volgorde) en r6_session_chaos_effects (de geaccepteerde regel per
-- game, via match_id) — die hadden alleen nog geen enkel UI-pad dat ernaar
-- schreef. Er is dus geen nieuwe tabel nodig voor Chaos Wheel, op één
-- kolom na: `category` ontbrak nog voor het beheerscherm ("categorie
-- kiezen").
alter table public.r6_chaos_effects
  add column if not exists category text;

-- Operator Wheel had wél een echt nieuwe tabel nodig: nergens bestond een
-- plek om "welke attacker/defender heeft speler X in game Y" vast te
-- leggen. Composite foreign keys (zelfde patroon als de rest van dit
-- schema, zie de fase 2.2 SQL-audit) voorkomen cross-sessie-fouten: de
-- game moet bij de sessie horen, en de speler moet daadwerkelijk aan díé
-- sessie deelnemen. `unique (match_id, player_id)` maakt een upsert
-- ("opnieuw verdelen overschrijft pas na accepteren" = client-side state
-- tot het moment van opslaan, dan één upsert) mogelijk en dwingt af dat
-- een speler maximaal één actieve toewijzing per game heeft.
create table if not exists public.r6_game_operator_assignments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.r6_sessions(id) on delete cascade,
  match_id uuid not null,
  player_id uuid not null,
  attacker_operator_id text references public.r6_operators(id),
  defender_operator_id text references public.r6_operators(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id),
  constraint r6_game_operator_assignments_match_session_fk
    foreign key (match_id, session_id) references public.r6_matches (id, session_id) on delete cascade,
  constraint r6_game_operator_assignments_session_player_fk
    foreign key (session_id, player_id) references public.r6_session_players (session_id, player_id)
);

create index if not exists r6_game_operator_assignments_session_id_idx on public.r6_game_operator_assignments (session_id);
create index if not exists r6_game_operator_assignments_match_id_idx on public.r6_game_operator_assignments (match_id);

drop trigger if exists trg_r6_game_operator_assignments_updated_at on public.r6_game_operator_assignments;
create trigger trg_r6_game_operator_assignments_updated_at
  before update on public.r6_game_operator_assignments
  for each row
  execute function public.r6_set_updated_at();

-- Een FK naar r6_operators(id) alléén kan de "kant" (attacker/defender) niet
-- afdwingen — een check-constraint kan ook niet joinen naar een andere
-- tabel. Vandaar deze trigger: bevestigt dat attacker_operator_id
-- daadwerkelijk side='attacker' heeft en defender_operator_id side=
-- 'defender', als achtervang tegen een directe API-aanroep die de RPC/UI
-- (die dit al filtert op actieve operators per kant) omzeilt.
create or replace function public.validate_r6_operator_assignment_sides()
returns trigger
language plpgsql
as $$
declare
  v_attacker_side text;
  v_defender_side text;
begin
  if new.attacker_operator_id is not null then
    select side into v_attacker_side from public.r6_operators where id = new.attacker_operator_id;
    if v_attacker_side is distinct from 'attacker' then
      raise exception 'attacker_operator_id % is geen attacker-operator', new.attacker_operator_id;
    end if;
  end if;

  if new.defender_operator_id is not null then
    select side into v_defender_side from public.r6_operators where id = new.defender_operator_id;
    if v_defender_side is distinct from 'defender' then
      raise exception 'defender_operator_id % is geen defender-operator', new.defender_operator_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_r6_operator_assignment_sides on public.r6_game_operator_assignments;
create trigger trg_validate_r6_operator_assignment_sides
  before insert or update on public.r6_game_operator_assignments
  for each row
  execute function public.validate_r6_operator_assignment_sides();

alter table public.r6_game_operator_assignments enable row level security;

-- Zelfde live-only-schrijven-patroon als de rest van dit schema (zie
-- 20260807060000): SELECT altijd open (toewijzingen van afgeronde LAN's
-- blijven zichtbaar in Geschiedenis/Statistieken), schrijven alleen
-- terwijl de sessie live is.
create policy "Authenticated users can read operator assignments" on public.r6_game_operator_assignments
  for select to authenticated using (true);

create policy "Authenticated users can insert operator assignments into live sessions" on public.r6_game_operator_assignments
  for insert to authenticated
  with check (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "Authenticated users can update operator assignments in live sessions" on public.r6_game_operator_assignments
  for update to authenticated
  using (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  )
  with check (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "Authenticated users can delete operator assignments from live sessions" on public.r6_game_operator_assignments
  for delete to authenticated
  using (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
