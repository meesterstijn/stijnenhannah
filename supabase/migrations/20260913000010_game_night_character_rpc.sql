-- Game Night V2.8 — laat een lid zijn EIGEN character kiezen via dezelfde
-- self-service-RPC als nickname/kleur (public.game_night_update_my_profile,
-- 20260912150000_game_night_member_auth.sql), i.p.v. een tweede RPC te
-- bouwen voor dezelfde "update mijn eigen speler-rij"-behoefte.
--
-- Postgres staat geen CREATE OR REPLACE toe dat de parameterlijst wijzigt
-- (dat zou een aparte overload worden, geen vervanging) — daarom eerst de
-- bestaande 2-parameter-functie droppen en opnieuw aanmaken met een derde,
-- optionele parameter. p_character_id heeft een default van null zodat een
-- eventueel nog-niet-vernieuwde frontend-bundle (cache) de aanroep zonder
-- dit argument nog steeds kan doen zonder te breken.
--
-- Validatie: character_id wordt hier NIET nogmaals tegen de allowlist
-- gecontroleerd (geen dubbele bron van waarheid) — de CHECK-constraint uit
-- 20260913000000_game_night_player_character.sql is de enige plek die dat
-- afdwingt, voor ALLE schrijfpaden (deze RPC én een eventuele owner-only
-- directe update). Een ongeldige waarde geeft dus een Postgres-
-- constraintfout i.p.v. een custom foutmelding — zelfde afweging als
-- arena_style/arena_symbol op game_night_games, die ook geen RPC-laag
-- hebben die de allowlist dupliceert.

drop function if exists public.game_night_update_my_profile(text, uuid);

create function public.game_night_update_my_profile(
  p_nickname text,
  p_color_id uuid,
  p_character_id text default null
)
returns public.game_night_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.game_night_players;
  v_nickname text;
begin
  if not private.is_game_night_member_or_owner() then
    raise exception 'Geen toegang tot Game Night' using errcode = '42501';
  end if;

  select * into v_player
  from public.game_night_players
  where auth_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Geen gekoppeld spelersprofiel voor dit account'
      using errcode = '22023';
  end if;

  v_nickname := nullif(trim(p_nickname), '');
  if v_nickname is null then
    raise exception 'Nickname mag niet leeg zijn' using errcode = '22023';
  end if;
  if length(v_nickname) > 40 then
    raise exception 'Nickname is te lang (maximaal 40 tekens)'
      using errcode = '22023';
  end if;

  if p_color_id is not null and not exists (
    select 1 from public.game_night_color_palette
    where id = p_color_id and active = true
  ) then
    raise exception 'Ongeldige of niet-actieve kleur' using errcode = '22023';
  end if;

  update public.game_night_players
  set nickname = v_nickname,
      color_id = p_color_id,
      character_id = p_character_id
  where id = v_player.id
  returning * into v_player;

  return v_player;
end;
$$;

revoke execute on function public.game_night_update_my_profile(text, uuid, text)
  from public, anon;
grant execute on function public.game_night_update_my_profile(text, uuid, text)
  to authenticated;
