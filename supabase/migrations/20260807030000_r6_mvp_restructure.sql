-- Rainbow Six Siege LAN Companion — fase 2.2, deel 4: MVP-herstructurering.
--
-- `r6_match_players.mvp` was een boolean per speler per match — niets
-- voorkwam dat twee spelers in dezelfde match allebei mvp=true hadden
-- staan ("maximaal één officiële MVP per match" was dus niet op
-- databaseniveau afgedwongen). Door mvp te verplaatsen naar één enkele,
-- nullable `r6_matches.mvp_player_id`-kolom wordt "hoogstens één officiële
-- MVP per match" een structurele onmogelijkheid om te schenden, in plaats
-- van een regel die apart afgedwongen moet worden.

alter table public.r6_matches
  add column if not exists mvp_player_id uuid references public.r6_players(id),
  add column if not exists mvp_reason text;

-- Backfill vanuit de bestaande r6_match_players.mvp-booleans, vóórdat die
-- kolom verdwijnt. Bij tegenstrijdige data (meerdere mvp=true in dezelfde
-- match — kon in het oude model, was nooit als zodanig afgedwongen) wordt
-- deterministisch de speler met de meeste kills gekozen (bij gelijke kills:
-- laagste player_id, voor een altijd reproduceerbare uitkomst) én expliciet
-- gemeld via RAISE NOTICE, zodat zo'n geval zichtbaar is i.p.v. stilzwijgend
-- opgelost.
do $$
declare
  rec record;
  v_winner uuid;
begin
  for rec in
    select match_id, count(*) as cnt
    from public.r6_match_players
    where mvp = true
    group by match_id
  loop
    if rec.cnt > 1 then
      raise notice 'r6_matches %: % spelers hadden mvp=true — deterministisch opgelost via hoogste kills (tie-break: laagste player_id).', rec.match_id, rec.cnt;
    end if;

    select player_id into v_winner
    from public.r6_match_players
    where match_id = rec.match_id and mvp = true
    order by kills desc, player_id asc
    limit 1;

    update public.r6_matches set mvp_player_id = v_winner where id = rec.match_id;
  end loop;
end $$;

alter table public.r6_match_players drop column if exists mvp;

-- ── Defense-in-depth: deferred constraint trigger ───────────────────────
-- Waarom een trigger en niet (alleen) een foreign key: een FK kan
-- "mvp_player_id moet een rij in r6_match_players hebben voor dézelfde
-- match" niet uitdrukken — dat is een voorwaarde die afhangt van rijen in
-- een ANDERE tabel die op het moment van de r6_matches-insert vaak nog
-- niet bestaan (de RPC's hieronder maken eerst de match aan, en pas
-- daarna de r6_match_players-rijen). Een gewone (niet-deferred) trigger
-- zou daardoor altijd falen. Een DEFERRABLE INITIALLY DEFERRED constraint
-- trigger controleert pas bij COMMIT (einde van de transactie) — op dat
-- moment staan de match_players-rijen er al, dus de check klopt.
--
-- Dit is de database-brede achtervang tegen een directe API-call die de
-- RPC's hieronder omzeilt (bv. een rechtstreekse REST-update op
-- r6_matches.mvp_player_id, die de huidige RLS-policy tijdens een live
-- sessie toestaat). De RPC's zelf doen dezelfde validatie ook al vooraf,
-- voor een snelle, leesbare foutmelding vóór er iets wordt weggeschreven.
create or replace function public.validate_r6_match_mvp()
returns trigger
language plpgsql
as $$
begin
  if new.mvp_player_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.r6_match_players mp
    where mp.match_id = new.id and mp.player_id = new.mvp_player_id
  ) then
    raise exception 'mvp_player_id % is geen deelnemer aan match %', new.mvp_player_id, new.id;
  end if;

  if not exists (
    select 1 from public.r6_session_players sp
    where sp.session_id = new.session_id and sp.player_id = new.mvp_player_id
  ) then
    raise exception 'mvp_player_id % neemt niet deel aan sessie %', new.mvp_player_id, new.session_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_r6_match_mvp on public.r6_matches;
create constraint trigger trg_validate_r6_match_mvp
  after insert or update on public.r6_matches
  deferrable initially deferred
  for each row
  execute function public.validate_r6_match_mvp();

-- ── RPC's: overloads opruimen + MVP-parameters + MVP-validatie ──────────
-- CORRECTIE (fase 2.2 SQL-audit): CREATE OR REPLACE vervangt een functie
-- alleen bij een exacte match van naam + argumenttypen. De vorige aanname
-- dat een extra parameter met default dit "gewoon" zou vervangen was
-- onjuist — zonder de DROP FUNCTION hieronder zouden de 9-parameterversies
-- uit 20260806030000_r6_match_and_session_player_rpcs.sql blijven bestaan
-- náást deze nieuwe 11-parameterversies. Deze DROP FUNCTION-statements
-- verwijderen die exacte oude signatures eerst, zodat na deze migratie
-- precies één create_r6_match en precies één update_r6_match overblijven.
drop function if exists public.create_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text);
drop function if exists public.update_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text);

create or replace function public.create_r6_match(
  p_session_id uuid,
  p_map_id text,
  p_players jsonb,
  p_challenge_id text default null,
  p_challenge_completed boolean default false,
  p_chaos_rule text default null,
  p_funniest_moment text default null,
  p_notes text default null,
  p_result text default 'unknown',
  p_mvp_player_id uuid default null,
  p_mvp_reason text default null
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_status   text;
begin
  if p_session_id is null then
    raise exception 'session_id is verplicht';
  end if;
  if p_players is null or jsonb_array_length(p_players) = 0 then
    raise exception 'Minimaal één speler is verplicht per match';
  end if;

  select status into v_status from public.r6_sessions where id = p_session_id;
  if v_status is null then
    raise exception 'Sessie niet gevonden';
  end if;
  if v_status <> 'live' then
    raise exception 'Deze LAN is afgerond — heropen de LAN om een nieuwe match toe te voegen';
  end if;

  -- MVP-integriteit, vóór enige insert: (a) moet voorkomen in de
  -- meegestuurde spelerslijst van déze match, (b) moet daadwerkelijk aan
  -- de sessie deelnemen. Snelle, leesbare foutmelding — de deferred
  -- constraint trigger hierboven dwingt hetzelfde nog eens af als
  -- database-brede achtervang.
  if p_mvp_player_id is not null then
    if not exists (
      select 1 from jsonb_array_elements(p_players) as p
      where (p->>'player_id')::uuid = p_mvp_player_id
    ) then
      raise exception 'mvp_player_id % komt niet voor in de spelerslijst van deze match', p_mvp_player_id;
    end if;
    if not exists (
      select 1 from public.r6_session_players sp
      where sp.session_id = p_session_id and sp.player_id = p_mvp_player_id
    ) then
      raise exception 'mvp_player_id % neemt niet deel aan deze sessie', p_mvp_player_id;
    end if;
  end if;

  insert into public.r6_matches (
    session_id, map_id, result, challenge_id, challenge_completed, chaos_rule, funniest_moment, notes,
    mvp_player_id, mvp_reason
  ) values (
    p_session_id, p_map_id, coalesce(p_result, 'unknown'), p_challenge_id, coalesce(p_challenge_completed, false),
    p_chaos_rule, p_funniest_moment, p_notes,
    p_mvp_player_id, p_mvp_reason
  )
  returning id into v_match_id;

  insert into public.r6_match_players (
    match_id, player_id,
    operator_attacker_id, operator_defender_id, operator_single_id,
    kills, deaths, assists, revives, headshots, clutch, ace
  )
  select
    v_match_id,
    (p->>'player_id')::uuid,
    p->>'operator_attacker_id',
    p->>'operator_defender_id',
    p->>'operator_single_id',
    coalesce((p->>'kills')::int, 0),
    coalesce((p->>'deaths')::int, 0),
    coalesce((p->>'assists')::int, 0),
    coalesce((p->>'revives')::int, 0),
    coalesce((p->>'headshots')::int, 0),
    coalesce((p->>'clutch')::boolean, false),
    coalesce((p->>'ace')::boolean, false)
  from jsonb_array_elements(p_players) as p;

  return v_match_id;
end;
$$;

create or replace function public.update_r6_match(
  p_match_id uuid,
  p_map_id text,
  p_players jsonb,
  p_challenge_id text default null,
  p_challenge_completed boolean default false,
  p_chaos_rule text default null,
  p_funniest_moment text default null,
  p_notes text default null,
  p_result text default 'unknown',
  p_mvp_player_id uuid default null,
  p_mvp_reason text default null
)
returns void
language plpgsql
as $$
declare
  v_status     text;
  v_session_id uuid;
begin
  if p_match_id is null then
    raise exception 'match_id is verplicht';
  end if;
  if p_players is null or jsonb_array_length(p_players) = 0 then
    raise exception 'Minimaal één speler is verplicht per match';
  end if;

  select s.status, s.id into v_status, v_session_id
  from public.r6_matches m
  join public.r6_sessions s on s.id = m.session_id
  where m.id = p_match_id;

  if v_status is null then
    raise exception 'Match niet gevonden';
  end if;
  if v_status <> 'live' then
    raise exception 'Deze LAN is afgerond — heropen de LAN om deze match te bewerken';
  end if;

  if p_mvp_player_id is not null then
    if not exists (
      select 1 from jsonb_array_elements(p_players) as p
      where (p->>'player_id')::uuid = p_mvp_player_id
    ) then
      raise exception 'mvp_player_id % komt niet voor in de spelerslijst van deze match', p_mvp_player_id;
    end if;
    if not exists (
      select 1 from public.r6_session_players sp
      where sp.session_id = v_session_id and sp.player_id = p_mvp_player_id
    ) then
      raise exception 'mvp_player_id % neemt niet deel aan deze sessie', p_mvp_player_id;
    end if;
  end if;

  update public.r6_matches
  set
    map_id = p_map_id,
    result = coalesce(p_result, 'unknown'),
    challenge_id = p_challenge_id,
    challenge_completed = coalesce(p_challenge_completed, false),
    chaos_rule = p_chaos_rule,
    funniest_moment = p_funniest_moment,
    notes = p_notes,
    mvp_player_id = p_mvp_player_id,
    mvp_reason = p_mvp_reason
  where id = p_match_id;

  delete from public.r6_match_players where match_id = p_match_id;

  insert into public.r6_match_players (
    match_id, player_id,
    operator_attacker_id, operator_defender_id, operator_single_id,
    kills, deaths, assists, revives, headshots, clutch, ace
  )
  select
    p_match_id,
    (p->>'player_id')::uuid,
    p->>'operator_attacker_id',
    p->>'operator_defender_id',
    p->>'operator_single_id',
    coalesce((p->>'kills')::int, 0),
    coalesce((p->>'deaths')::int, 0),
    coalesce((p->>'assists')::int, 0),
    coalesce((p->>'revives')::int, 0),
    coalesce((p->>'headshots')::int, 0),
    coalesce((p->>'clutch')::boolean, false),
    coalesce((p->>'ace')::boolean, false)
  from jsonb_array_elements(p_players) as p;
end;
$$;

-- Expliciet met volledige (definitieve) signature: na DROP+CREATE zijn dit
-- verse functie-objecten zonder overgeërfde grants — PostgreSQL kent
-- EXECUTE op nieuwe functies standaard aan PUBLIC toe.
revoke execute on function public.create_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text, uuid, text) from public, anon;
grant  execute on function public.create_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text, uuid, text) to authenticated;

revoke execute on function public.update_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text, uuid, text) from public, anon;
grant  execute on function public.update_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text, uuid, text) to authenticated;
