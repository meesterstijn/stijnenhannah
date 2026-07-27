-- Rainbow Six Siege LAN Companion — live-scorebord-redesign, deel 2: het
-- event-log. Iedere tik op een actietegel wordt hier als losse, onveranderlijke
-- rij vastgelegd — het live scorebord (en straks ook de historische
-- statistieken) wordt hier volledig uit afgeleid, niet uit een los
-- opgeteld puntentotaal. Bestaande tabellen (r6_matches, r6_match_players,
-- de RPC's) blijven ongewijzigd en blijven werken zoals ze deden — dit is
-- een aanvullende, parallelle databron voor de nieuwe live-tik-flow, geen
-- vervanging.

create table if not exists public.r6_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.r6_sessions(id) on delete cascade,
  match_id uuid not null,
  player_id uuid not null,
  score_rule_code text not null references public.r6_score_rules(code),
  -- Momentopname van de puntenwaarde op het moment van tikken (zie de
  -- trigger hieronder, die dit altijd zelf invult en nooit een door de
  -- client meegestuurde waarde vertrouwt) — zo blijft een al getikte
  -- gebeurtenis zijn historische puntenwaarde behouden, ook als iemand
  -- later de puntenwaarde van die actie aanpast via de instellingen.
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  -- Cross-session-integriteit, zelfde patroon als de rest van dit schema
  -- (zie de fase 2.2 SQL-audit): match_id moet daadwerkelijk bij
  -- session_id horen, en player_id moet daadwerkelijk aan de sessie
  -- deelnemen — geen simpele losse FK's naar r6_matches(id)/r6_players(id).
  constraint r6_events_match_session_fk
    foreign key (match_id, session_id) references public.r6_matches (id, session_id) on delete cascade,
  constraint r6_events_session_player_fk
    foreign key (session_id, player_id) references public.r6_session_players (session_id, player_id)
);

create index if not exists r6_events_session_id_idx on public.r6_events (session_id);
create index if not exists r6_events_match_id_idx on public.r6_events (match_id);
create index if not exists r6_events_player_id_idx on public.r6_events (player_id);

-- Vult points_awarded altijd zelf in vanuit de huidige regel — de client
-- stuurt uitsluitend `score_rule_code` mee, nooit een puntenwaarde. Dit
-- voorkomt zowel onbedoelde inconsistentie (verouderde cache) als een
-- gemanipuleerde/verzonnen puntenwaarde vanaf de client.
create or replace function public.set_r6_event_points()
returns trigger
language plpgsql
as $$
declare
  v_points integer;
  v_is_active boolean;
begin
  select points, is_active into v_points, v_is_active
  from public.r6_score_rules
  where code = new.score_rule_code;

  if v_points is null then
    raise exception 'Onbekende score_rule_code: %', new.score_rule_code;
  end if;
  if not v_is_active then
    raise exception 'Actie % is niet meer actief', new.score_rule_code;
  end if;

  new.points_awarded := v_points;
  return new;
end;
$$;

drop trigger if exists trg_set_r6_event_points on public.r6_events;
create trigger trg_set_r6_event_points
  before insert on public.r6_events
  for each row
  execute function public.set_r6_event_points();

alter table public.r6_events enable row level security;

-- Zelfde live-only-schrijven-patroon als de rest van dit schema. Events
-- zijn een onveranderlijk log (geen UPDATE-policy — corrigeren van een
-- mistik gebeurt door de rij te verwijderen ("ongedaan maken"), niet door
-- 'm te wijzigen) en mogen alleen aangemaakt/verwijderd worden terwijl de
-- sessie live is. SELECT blijft altijd open, zodat afgeronde LAN's hun
-- volledige event-geschiedenis leesbaar houden.
create policy "Authenticated users can read events" on public.r6_events
  for select to authenticated using (true);

create policy "Authenticated users can insert events into live sessions" on public.r6_events
  for insert to authenticated
  with check (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "Authenticated users can delete events from live sessions" on public.r6_events
  for delete to authenticated
  using (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
