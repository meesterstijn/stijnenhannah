-- Guest selfie editor: keep originals and derived faces in the PRIVATE bucket.
-- Run after 20260926000000 and 20260927000000. Also deploy the accompanying
-- game-night-guest-faces Edge Function (see docs/game-night-guests.md).
begin;

alter table public.game_night_players
  add column if not exists face_original_path text,
  add column if not exists face_asset_path text,
  add column if not exists face_crop jsonb;

-- NULL means no emoji. Keep accepting old values for already-open clients.
create or replace function private.game_night_save_guest_avatar(
  p_player_id uuid, p_name text, p_color_id uuid, p_base_part_id uuid, p_guest_face text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_name is null or length(btrim(p_name)) not between 1 and 40 then
    raise exception 'Vul een naam in van maximaal 40 tekens.' using errcode = '22023';
  end if;
  if p_guest_face is not null and p_guest_face not in ('smile', 'cool', 'robot', 'fox', 'cat', 'alien', 'bear', 'panda') then
    raise exception 'Kies een geldig gezicht.' using errcode = '22023';
  end if;
  if p_color_id is not null and not exists (
    select 1 from public.game_night_color_palette where id = p_color_id and active
  ) then
    raise exception 'Deze kleur is niet meer beschikbaar.' using errcode = '22023';
  end if;
  if p_base_part_id is not null and not exists (
    select 1 from public.game_night_character_parts
    where id = p_base_part_id and active and is_starter and slot = 'base'
  ) then
    raise exception 'Deze outfit is niet meer beschikbaar.' using errcode = '22023';
  end if;
  update public.game_night_players set name = btrim(p_name), nickname = btrim(p_name),
    color_id = p_color_id, guest_face = p_guest_face where id = p_player_id;
  if p_base_part_id is null then
    delete from public.game_night_player_character_equipment where player_id = p_player_id and slot = 'base';
  else
    insert into public.game_night_player_character_equipment(player_id, slot, part_id)
    values (p_player_id, 'base', p_base_part_id)
    on conflict (player_id, slot) do update set part_id = excluded.part_id, equipped_at = now();
  end if;
end;
$$;
revoke all on function private.game_night_save_guest_avatar(uuid, text, uuid, uuid, text) from public, anon, authenticated;

-- Only the derived avatar path and its revision go to guests; never the
-- original selfie, full crop metadata, auth ID or device credentials.
create or replace function private.game_night_guest_player_view(p_player_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'name', coalesce(p.nickname, p.name),
    'face_asset_path', p.face_asset_path, 'face_revision', p.face_crop ->> 'processedAt',
    'guest_face', p.guest_face, 'color_id', p.color_id, 'color', coalesce(c.hex, p.color),
    'body', (select to_jsonb(part) from public.game_night_player_character_equipment e
      join public.game_night_character_parts part on part.id = e.part_id
      where e.player_id = p.id and e.slot = 'base' and part.active))
  from public.game_night_players p left join public.game_night_color_palette c on c.id = p.color_id
  where p.id = p_player_id;
$$;
revoke all on function private.game_night_guest_player_view(uuid) from public, anon, authenticated;

create or replace function private.game_night_guest_face_writer(p_guest_token text, p_session_id uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_player_id uuid := private.game_night_guest_player(p_guest_token);
begin
  if v_player_id is null or not private.game_night_guest_has_session(p_guest_token, p_session_id)
    or not exists (
      select 1 from public.game_night_session_players a
      join public.game_night_sessions s on s.id = a.session_id
      where a.player_id = v_player_id and a.session_id = p_session_id
        and a.active_at_table and s.status <> 'completed'
    ) then
    raise exception 'Je kunt je foto alleen aanpassen als je aan tafel zit.' using errcode = '42501';
  end if;
  return v_player_id;
end;
$$;
revoke all on function private.game_night_guest_face_writer(text, uuid) from public, anon, authenticated;

-- The Edge Function uses this RPC before signing a private Storage URL. Even
-- with a service key the function never chooses its own authorization rules.
create or replace function public.game_night_guest_face_access(
  p_action text, p_guest_token text default null, p_session_id uuid default null,
  p_join_token text default null, p_asset_path text default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_viewer uuid; v_target uuid;
begin
  if p_action = 'write' then
    return jsonb_build_object('player_id', private.game_night_guest_face_writer(p_guest_token, p_session_id));
  end if;
  if p_action is distinct from 'read' then
    raise exception 'Ongeldige fotoactie.' using errcode = '22023';
  end if;
  select id into v_target from public.game_night_players
    where face_asset_path = p_asset_path and archived_at is null limit 1;
  if v_target is null then
    raise exception 'Geen toegang tot deze gezichtsfoto.' using errcode = '42501';
  end if;
  -- A valid QR permits the existing-player picker, as explicitly requested.
  if exists (
    select 1 from public.game_night_join_tokens t
    join public.game_night_sessions s on s.id = t.game_night_session_id
    where t.token = p_join_token and t.revoked_at is null and t.expires_at > now()
      and s.status <> 'completed'
  ) then
    return jsonb_build_object('asset_path', p_asset_path);
  end if;
  v_viewer := private.game_night_guest_player(p_guest_token);
  if v_viewer is not null and private.game_night_guest_has_session(p_guest_token, p_session_id)
    and exists (
      select 1 from public.game_night_session_players a
      where a.player_id = v_viewer and a.session_id = p_session_id
        and (v_viewer = v_target or (a.active_at_table and exists (
          select 1 from public.game_night_session_players other
          where other.player_id = v_target and other.session_id = p_session_id and other.active_at_table
        )))
    ) then
    return jsonb_build_object('asset_path', p_asset_path);
  end if;
  raise exception 'Geen toegang tot deze gezichtsfoto.' using errcode = '42501';
end;
$$;
revoke all on function public.game_night_guest_face_access(text, text, uuid, text, text) from public;
grant execute on function public.game_night_guest_face_access(text, text, uuid, text, text) to anon, authenticated, service_role;

create or replace function public.game_night_update_guest_face(
  p_guest_token text, p_session_id uuid, p_face_original_path text,
  p_face_asset_path text, p_face_crop jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_player_id uuid; v_directory text;
begin
  -- Same session lock order as joining/profile edits/host table changes.
  perform 1 from public.game_night_sessions where id = p_session_id for update;
  v_player_id := private.game_night_guest_face_writer(p_guest_token, p_session_id);
  perform 1 from public.game_night_players where id = v_player_id for update;
  if p_face_asset_path is null or p_face_original_path is null
    or p_face_asset_path !~ ('^' || v_player_id::text || '/[0-9a-f-]{36}/face[.]png$') then
    raise exception 'Ongeldig fotopad.' using errcode = '22023';
  end if;
  v_directory := split_part(p_face_asset_path, '/', 1) || '/' || split_part(p_face_asset_path, '/', 2);
  if p_face_original_path not in (v_directory || '/original.jpg', v_directory || '/original.webp', v_directory || '/original.png') then
    raise exception 'Deze foto hoort niet bij jouw speler.' using errcode = '22023';
  end if;
  if p_face_crop is null or jsonb_typeof(p_face_crop) <> 'object' or octet_length(p_face_crop::text) > 65536 then
    raise exception 'Ongeldige uitsnede.' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'game-night-player-faces' and name = p_face_asset_path)
    or not exists (select 1 from storage.objects where bucket_id = 'game-night-player-faces' and name = p_face_original_path) then
    raise exception 'De foto is nog niet helemaal geüpload. Probeer opnieuw.' using errcode = '22023';
  end if;
  update public.game_night_players set
    face_original_path = p_face_original_path,
    face_asset_path = p_face_asset_path,
    face_crop = p_face_crop || jsonb_build_object('processedAt', clock_timestamp()),
    guest_face = null
  where id = v_player_id;
end;
$$;
revoke all on function public.game_night_update_guest_face(text, uuid, text, text, jsonb) from public;
grant execute on function public.game_night_update_guest_face(text, uuid, text, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
