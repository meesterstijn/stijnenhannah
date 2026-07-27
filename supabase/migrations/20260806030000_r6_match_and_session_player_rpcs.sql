-- Rainbow Six Siege LAN Companion — fase 2.1, deel 4: RPC's.
--
-- CORRECTIE (fase 2.2 SQL-audit): PostgreSQL identificeert een functie op
-- naam ÉN argumenttypen samen. `CREATE OR REPLACE FUNCTION` vervangt een
-- bestaande functie alléén wanneer die combinatie exact overeenkomt. Het
-- hieronder toevoegen van `p_result` verandert de argumentenlijst van
-- create_r6_match (8 -> 9 parameters) t.o.v. de versie uit
-- 20260805020000_r6_session_rpcs.sql — zonder de expliciete DROP FUNCTION
-- hieronder zou dit een TWEEDE, aparte overload aanmaken naast de oude
-- 8-parameterversie, die dan ook nog steeds zou blijven bestaan (en zonder
-- kolommen die inmiddels zijn verwijderd/gewijzigd, dus stuk). De DROP
-- FUNCTION met de exacte oude signature verwijdert die oude overload eerst,
-- zodat er na deze migratie precies één create_r6_match overblijft.
drop function if exists public.create_r6_match(uuid, text, jsonb, text, boolean, text, text, text);

-- 2. Drie nieuwe RPC's: update_r6_match, add_r6_session_player,
--    remove_r6_session_player. Zelfde patroon als de bestaande RPC's:
--    SECURITY INVOKER (default), alles in één transactie, expliciete
--    validatie mét duidelijke foutmelding vóórdat de onderliggende
--    RLS-policies (20260806020000) sowieso al hetzelfde zouden afdwingen —
--    dit geeft de gebruiker een leesbare foutmelding i.p.v. een kale
--    RLS-weigering, met de RLS-laag als ongewijzigde, database-brede
--    achtervang. Deze drie zijn hier voor het eerst gedefinieerd (geen
--    eerdere overload om mee te verwarren).

create or replace function public.create_r6_match(
  p_session_id uuid,
  p_map_id text,
  p_players jsonb,
  p_challenge_id text default null,
  p_challenge_completed boolean default false,
  p_chaos_rule text default null,
  p_funniest_moment text default null,
  p_notes text default null,
  p_result text default 'unknown'
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

  insert into public.r6_matches (
    session_id, map_id, result, challenge_id, challenge_completed, chaos_rule, funniest_moment, notes
  ) values (
    p_session_id, p_map_id, coalesce(p_result, 'unknown'), p_challenge_id, coalesce(p_challenge_completed, false),
    p_chaos_rule, p_funniest_moment, p_notes
  )
  returning id into v_match_id;

  insert into public.r6_match_players (
    match_id, player_id,
    operator_attacker_id, operator_defender_id, operator_single_id,
    kills, deaths, assists, revives, headshots, mvp, clutch, ace
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
    coalesce((p->>'mvp')::boolean, false),
    coalesce((p->>'clutch')::boolean, false),
    coalesce((p->>'ace')::boolean, false)
  from jsonb_array_elements(p_players) as p;

  return v_match_id;
end;
$$;

-- Werkt een bestaande match + al zijn per-speler rijen atomisch bij.
-- match_number, session_id en played_at blijven onaangeroerd — dit is een
-- correctie van bestaande data, geen nieuwe match. Bestaande
-- r6_match_players-rijen voor deze match worden vervangen (delete + insert)
-- in plaats van los te diffen: eenvoudiger en even correct, want de hele set
-- komt telkens compleet van het formulier mee.
create or replace function public.update_r6_match(
  p_match_id uuid,
  p_map_id text,
  p_players jsonb,
  p_challenge_id text default null,
  p_challenge_completed boolean default false,
  p_chaos_rule text default null,
  p_funniest_moment text default null,
  p_notes text default null,
  p_result text default 'unknown'
)
returns void
language plpgsql
as $$
declare
  v_status text;
begin
  if p_match_id is null then
    raise exception 'match_id is verplicht';
  end if;
  if p_players is null or jsonb_array_length(p_players) = 0 then
    raise exception 'Minimaal één speler is verplicht per match';
  end if;

  select s.status into v_status
  from public.r6_matches m
  join public.r6_sessions s on s.id = m.session_id
  where m.id = p_match_id;

  if v_status is null then
    raise exception 'Match niet gevonden';
  end if;
  if v_status <> 'live' then
    raise exception 'Deze LAN is afgerond — heropen de LAN om deze match te bewerken';
  end if;

  update public.r6_matches
  set
    map_id = p_map_id,
    result = coalesce(p_result, 'unknown'),
    challenge_id = p_challenge_id,
    challenge_completed = coalesce(p_challenge_completed, false),
    chaos_rule = p_chaos_rule,
    funniest_moment = p_funniest_moment,
    notes = p_notes
  where id = p_match_id;

  delete from public.r6_match_players where match_id = p_match_id;

  insert into public.r6_match_players (
    match_id, player_id,
    operator_attacker_id, operator_defender_id, operator_single_id,
    kills, deaths, assists, revives, headshots, mvp, clutch, ace
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
    coalesce((p->>'mvp')::boolean, false),
    coalesce((p->>'clutch')::boolean, false),
    coalesce((p->>'ace')::boolean, false)
  from jsonb_array_elements(p_players) as p;
end;
$$;

-- Voegt een speler (op naam, upsert net als create_r6_session) toe aan een
-- lopende sessie. Alleen mogelijk terwijl de LAN live is.
create or replace function public.add_r6_session_player(
  p_session_id uuid,
  p_player_name text
)
returns uuid
language plpgsql
as $$
declare
  v_status    text;
  v_name      text := trim(p_player_name);
  v_player_id uuid;
begin
  if v_name = '' then
    raise exception 'Spelernaam mag niet leeg zijn';
  end if;

  select status into v_status from public.r6_sessions where id = p_session_id;
  if v_status is null then
    raise exception 'Sessie niet gevonden';
  end if;
  if v_status <> 'live' then
    raise exception 'Deze LAN is afgerond — heropen de LAN om spelers toe te voegen';
  end if;

  insert into public.r6_players (name)
  values (v_name)
  on conflict ((lower(name))) do update set name = public.r6_players.name
  returning id into v_player_id;

  insert into public.r6_session_players (session_id, player_id)
  values (p_session_id, v_player_id)
  on conflict (session_id, player_id) do nothing;

  return v_player_id;
end;
$$;

-- Verwijdert een speler uit een lopende sessie — alleen wanneer die speler
-- nog geen enkele match in déze sessie heeft gespeeld (integriteit: we gaan
-- nooit stilzwijgend statistieken "kwijtraken" van een speler die al
-- meedeed) en er minimaal twee spelers overblijven.
create or replace function public.remove_r6_session_player(
  p_session_id uuid,
  p_player_id uuid
)
returns void
language plpgsql
as $$
declare
  v_status        text;
  v_has_matches   boolean;
  v_player_count  integer;
begin
  select status into v_status from public.r6_sessions where id = p_session_id;
  if v_status is null then
    raise exception 'Sessie niet gevonden';
  end if;
  if v_status <> 'live' then
    raise exception 'Deze LAN is afgerond — heropen de LAN om spelers te verwijderen';
  end if;

  select exists (
    select 1
    from public.r6_match_players mp
    join public.r6_matches m on m.id = mp.match_id
    where m.session_id = p_session_id and mp.player_id = p_player_id
  ) into v_has_matches;

  if v_has_matches then
    raise exception 'Deze speler heeft al matchgegevens in deze LAN en kan niet verwijderd worden';
  end if;

  select count(*) into v_player_count
  from public.r6_session_players
  where session_id = p_session_id;

  if v_player_count <= 2 then
    raise exception 'Een LAN heeft minimaal twee spelers nodig — verwijder deze speler niet';
  end if;

  delete from public.r6_session_players
  where session_id = p_session_id and player_id = p_player_id;
end;
$$;

-- Expliciet met volledige signature (i.p.v. kale naam): na de DROP+CREATE
-- hierboven is dit een vers functie-object zonder overgeërfde grants —
-- PostgreSQL kent EXECUTE op nieuwe functies standaard aan PUBLIC toe, dus
-- zonder deze regels zou ook een niet-ingelogde aanroeper (anon) deze
-- overload kunnen aanroepen.
revoke execute on function public.create_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text) from public, anon;
grant  execute on function public.create_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text) to authenticated;

revoke execute on function public.update_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text) from public, anon;
grant  execute on function public.update_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text) to authenticated;

revoke execute on function public.add_r6_session_player(uuid, text) from public, anon;
grant  execute on function public.add_r6_session_player(uuid, text) to authenticated;

revoke execute on function public.remove_r6_session_player(uuid, uuid) from public, anon;
grant  execute on function public.remove_r6_session_player(uuid, uuid) to authenticated;
