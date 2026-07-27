-- Rainbow Six Siege LAN Companion — fase 2, deel 3: RPC's.
--
-- Zelfde patroon als create_plant_instance_with_season (zie
-- 20260803130000_create_plant_instance_with_season_rpc.sql): SECURITY
-- INVOKER (default), alle geraakte tabellen hebben "authenticated can do
-- everything"-RLS, dus de aanroeper heeft geen extra rechten nodig. Alles
-- gebeurt in één transactie — bij een fout rolt alles terug, nooit een
-- halve sessie/match.

-- Maakt een nieuwe LAN-sessie + herbruikt/maakt spelers op naam + koppelt
-- ze aan de sessie, in één keer. Minimaal twee (unieke) spelernamen vereist.
create or replace function public.create_r6_session(
  p_name text default 'Operation LANstorm',
  p_started_at timestamptz default now(),
  p_player_names text[] default '{}'
)
returns jsonb
language plpgsql
as $$
declare
  v_session_id   uuid;
  v_player_id    uuid;
  v_player_ids   uuid[] := '{}';
  v_name         text;
  v_distinct_count integer;
begin
  select count(distinct lower(trim(n)))
  into v_distinct_count
  from unnest(p_player_names) as n
  where trim(n) <> '';

  if v_distinct_count < 2 then
    raise exception 'Er zijn minimaal twee unieke spelers nodig om een LAN te starten';
  end if;

  insert into public.r6_sessions (name, started_at, status)
  values (
    coalesce(nullif(trim(p_name), ''), 'Operation LANstorm'),
    coalesce(p_started_at, now()),
    'live'
  )
  returning id into v_session_id;

  for v_name in select distinct trim(n) from unnest(p_player_names) as n where trim(n) <> '' loop
    insert into public.r6_players (name)
    values (v_name)
    on conflict ((lower(name))) do update set name = public.r6_players.name
    returning id into v_player_id;

    v_player_ids := array_append(v_player_ids, v_player_id);

    insert into public.r6_session_players (session_id, player_id)
    values (v_session_id, v_player_id)
    on conflict (session_id, player_id) do nothing;
  end loop;

  return jsonb_build_object('session_id', v_session_id, 'player_ids', to_jsonb(v_player_ids));
end;
$$;

-- Slaat één match + de bijbehorende per-speler rijen in één transactie op.
-- p_players is een jsonb-array met objecten in de vorm:
-- { "player_id", "result", "operator_attacker_id", "operator_defender_id",
--   "operator_single_id", "kills", "deaths", "assists", "revives",
--   "headshots", "mvp", "clutch", "ace" }
-- match_number wordt door de trigger op r6_matches gezet, niet hier.
create or replace function public.create_r6_match(
  p_session_id uuid,
  p_map_id text,
  p_players jsonb,
  p_challenge_id text default null,
  p_challenge_completed boolean default false,
  p_chaos_rule text default null,
  p_funniest_moment text default null,
  p_notes text default null
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
begin
  if p_session_id is null then
    raise exception 'session_id is verplicht';
  end if;
  if p_players is null or jsonb_array_length(p_players) = 0 then
    raise exception 'Minimaal één speler is verplicht per match';
  end if;

  insert into public.r6_matches (
    session_id, map_id, challenge_id, challenge_completed, chaos_rule, funniest_moment, notes
  ) values (
    p_session_id, p_map_id, p_challenge_id, coalesce(p_challenge_completed, false),
    p_chaos_rule, p_funniest_moment, p_notes
  )
  returning id into v_match_id;

  insert into public.r6_match_players (
    match_id, player_id, result,
    operator_attacker_id, operator_defender_id, operator_single_id,
    kills, deaths, assists, revives, headshots, mvp, clutch, ace
  )
  select
    v_match_id,
    (p->>'player_id')::uuid,
    p->>'result',
    p->>'operator_attacker_id',
    p->>'operator_defender_id',
    p->>'operator_single_id',
    coalesce((p->>'kills')::int, 0),
    coalesce((p->>'deaths')::int, 0),
    coalesce((p->>'assists')::int, 0),
    coalesce((p->>'revives')::int, 0),
    coalesce((p->>'headshots')::int, 0),
    coalesce((p->>'mvp')::boolean, false),
    coalesce((p->>'clutch')::boolean, false),
    coalesce((p->>'ace')::boolean, false)
  from jsonb_array_elements(p_players) as p;

  return v_match_id;
end;
$$;

revoke execute on function public.create_r6_session from public, anon;
grant  execute on function public.create_r6_session to authenticated;

revoke execute on function public.create_r6_match from public, anon;
grant  execute on function public.create_r6_match to authenticated;
