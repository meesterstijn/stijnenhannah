-- Game Night V2.9E — laat een lid zijn EIGEN lichaamsbouw ("Lichaamsbouw":
-- Klein/Gemiddeld/Groot, alleen betekenisvol bij een female base) instellen
-- via dezelfde self-service-RPC als nickname/kleur/character
-- (public.game_night_update_my_profile), exact volgens hetzelfde patroon
-- als 20260913000010_game_night_character_rpc.sql toen character_id werd
-- toegevoegd: Postgres staat geen CREATE OR REPLACE toe dat de
-- parameterlijst wijzigt, dus eerst de bestaande 3-parameter-functie
-- droppen en opnieuw aanmaken met een vierde, optionele parameter.
-- p_body_shape heeft een default van null zodat een nog-niet-vernieuwde
-- frontend-bundle (cache) de aanroep zonder dit argument nog steeds kan
-- doen zonder te breken.
--
-- Validatie: body_shape wordt hier NIET nogmaals tegen de allowlist
-- gecontroleerd — de CHECK-constraint
-- game_night_players_body_shape_check (20260915000000) is de enige plek
-- die dat afdwingt, zelfde afweging als character_id hierboven.

drop function if exists public.game_night_update_my_profile(text, uuid, text);

create function public.game_night_update_my_profile(
  p_nickname text,
  p_color_id uuid,
  p_character_id text default null,
  p_body_shape text default null
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
      character_id = p_character_id,
      body_shape = p_body_shape
  where id = v_player.id
  returning * into v_player;

  return v_player;
end;
$$;

revoke execute on function public.game_night_update_my_profile(text, uuid, text, text)
  from public, anon;
grant execute on function public.game_night_update_my_profile(text, uuid, text, text)
  to authenticated;
