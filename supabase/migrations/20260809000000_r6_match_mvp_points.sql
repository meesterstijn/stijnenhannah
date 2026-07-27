-- Rainbow Six Siege LAN Companion — MVP-punten per match aanpasbaar maken.
--
-- Tot nu toe was de puntenwaarde van een MVP-toekenning altijd de actuele,
-- globale waarde van de "mvp"-regel in r6_score_rules (zie
-- computeScoreboard in lib/scoring.ts). Bij "Game afronden" wil de
-- gebruiker incidenteel een andere waarde kunnen meegeven voor precies déze
-- game (bv. een extra bijzondere MVP-prestatie belonen), zonder de globale
-- tegelwaarde permanent aan te passen voor alle toekomstige games.
--
-- Vandaar een nullable override-kolom: null = gebruik de actuele globale
-- mvp-regel (ongewijzigd gedrag t.o.v. voorheen, blijft meebewegen als die
-- regel later wordt aangepast), een concreet getal = bevroren, bewuste
-- uitzondering voor precies deze match. Alleen zinvol in combinatie met een
-- daadwerkelijke mvp_player_id — de check-constraint hieronder dwingt dat
-- af (een gewone, niet-uitgestelde constraint volstaat hier, want beide
-- kolommen staan al op dezelfde rij — in tegenstelling tot de
-- deelnemerscontrole in validate_r6_match_mvp, die wél op nog-niet-bestaande
-- sibling-rijen moest wachten).
alter table public.r6_matches
  add column if not exists mvp_points integer,
  add constraint r6_matches_mvp_points_requires_mvp check (mvp_points is null or mvp_player_id is not null);

-- CORRECTIE-PATROON (ongewijzigd t.o.v. eerdere migraties in dit schema):
-- CREATE OR REPLACE vervangt een functie alleen bij een exacte match van
-- naam + argumenttypen. Het toevoegen van p_mvp_points hieronder verandert
-- de argumentenlijst (11 -> 12 parameters) t.o.v. de versie uit
-- 20260807030000_r6_mvp_restructure.sql — zonder de expliciete DROP
-- FUNCTION hieronder zou dit een tweede, overbodige overload aanmaken.
drop function if exists public.create_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text, uuid, text);
drop function if exists public.update_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text, uuid, text);

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
  p_mvp_reason text default null,
  p_mvp_points integer default null
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
  if p_mvp_points is not null and p_mvp_player_id is null then
    raise exception 'mvp_points kan alleen gezet worden samen met een mvp_player_id';
  end if;

  insert into public.r6_matches (
    session_id, map_id, result, challenge_id, challenge_completed, chaos_rule, funniest_moment, notes,
    mvp_player_id, mvp_reason, mvp_points
  ) values (
    p_session_id, p_map_id, coalesce(p_result, 'unknown'), p_challenge_id, coalesce(p_challenge_completed, false),
    p_chaos_rule, p_funniest_moment, p_notes,
    p_mvp_player_id, p_mvp_reason, p_mvp_points
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
  p_mvp_reason text default null,
  p_mvp_points integer default null
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
  if p_mvp_points is not null and p_mvp_player_id is null then
    raise exception 'mvp_points kan alleen gezet worden samen met een mvp_player_id';
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
    mvp_reason = p_mvp_reason,
    mvp_points = p_mvp_points
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
revoke execute on function public.create_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text, uuid, text, integer) from public, anon;
grant  execute on function public.create_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text, uuid, text, integer) to authenticated;

revoke execute on function public.update_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text, uuid, text, integer) from public, anon;
grant  execute on function public.update_r6_match(uuid, text, jsonb, text, boolean, text, text, text, text, uuid, text, integer) to authenticated;
