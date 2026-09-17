-- Accountless guests. The browser keeps a random 256-bit bearer credential;
-- only its SHA-256 hash is stored, outside the exposed public schema.
-- No auth.users/profiles rows, shared account, or broader table policies.
begin;

alter table public.game_night_players add column guest_face text
  check (guest_face in ('smile', 'cool', 'robot', 'fox', 'cat', 'alien', 'bear', 'panda'));

create table private.game_night_guests (
  token_hash text primary key check (length(token_hash) = 64),
  player_id uuid not null unique references public.game_night_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days',
  revoked_at timestamptz
);
alter table private.game_night_guests enable row level security;
revoke all on private.game_night_guests from public, anon, authenticated;

create function private.game_night_guest_player(p_guest_token text)
returns uuid language sql stable security definer set search_path = '' as $$
  select g.player_id from private.game_night_guests g
  join public.game_night_players p on p.id = g.player_id
  where p_guest_token ~ '^[0-9a-f]{64}$'
    and g.token_hash = encode(sha256(convert_to(p_guest_token, 'UTF8')), 'hex')
    and g.revoked_at is null and g.expires_at > now()
    and p.archived_at is null;
$$;
revoke all on function private.game_night_guest_player(text) from public, anon, authenticated;

create function public.game_night_guest_options(
  p_join_token text default null, p_guest_token text default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_invite jsonb;
begin
  v_invite := public.game_night_validate_join_token(p_join_token);
  if not (v_invite->>'valid')::boolean
     and private.game_night_guest_player(p_guest_token) is null then
    return jsonb_build_object('valid', false);
  end if;
  return jsonb_build_object(
    'valid', true, 'invitation', v_invite,
    'me', private.game_night_guest_player_view(private.game_night_guest_player(p_guest_token)),
    'palette', (select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order), '[]'::jsonb)
      from public.game_night_color_palette c where c.active),
    'bodies', (select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order, p.key), '[]'::jsonb)
      from public.game_night_character_parts p
      where p.active and p.is_starter and p.slot = 'base')
  );
end;
$$;
revoke all on function public.game_night_guest_options(text, text) from public;
grant execute on function public.game_night_guest_options(text, text) to anon, authenticated;

-- Only these profile fields can be changed with a guest credential. Never
-- accept a player ID, role, face URL, unlock, score or arbitrary equipment.
create function private.game_night_save_guest_avatar(
  p_player_id uuid, p_name text, p_color_id uuid, p_base_part_id uuid, p_guest_face text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_name is null or length(btrim(p_name)) not between 1 and 40 then
    raise exception 'Vul een naam in van maximaal 40 tekens.' using errcode = '22023';
  end if;
  if p_guest_face is null or p_guest_face not in ('smile', 'cool', 'robot', 'fox', 'cat', 'alien', 'bear', 'panda') then
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

create function public.game_night_join_as_guest(
  p_join_token text, p_guest_token text, p_name text,
  p_color_id uuid default null, p_base_part_id uuid default null, p_guest_face text default 'smile'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.game_night_join_tokens;
  v_session public.game_night_sessions;
  v_player_id uuid;
  v_hash text;
  v_seat integer;
begin
  if p_guest_token is null or p_guest_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Ongeldige gastcode. Open de uitnodiging opnieuw.' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(p_guest_token, 'UTF8')), 'hex');
  -- Also serialize a new device joining different nights simultaneously.
  perform pg_advisory_xact_lock(hashtextextended(v_hash, 0));
  select * into v_invite from public.game_night_join_tokens where token = p_join_token for update;
  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'Deze uitnodiging is verlopen. Vraag de host om een nieuwe QR-code.' using errcode = '22023';
  end if;
  select * into v_session from public.game_night_sessions where id = v_invite.game_night_session_id for update;
  if not found or v_session.status = 'completed' then
    raise exception 'Deze Game Night is afgelopen.' using errcode = '22023';
  end if;
  v_player_id := private.game_night_guest_player(p_guest_token);
  if v_player_id is null and exists (select 1 from private.game_night_guests where token_hash = v_hash) then
    raise exception 'Deze gasttoegang is niet meer actief. Vraag de host om hulp.' using errcode = '42501';
  end if;
  -- Retries never duplicate a player, move a seat or undo a host removal.
  if exists (select 1 from public.game_night_session_players where session_id = v_session.id and player_id = v_player_id) then
    return jsonb_build_object('session_id', v_session.id, 'player_id', v_player_id);
  end if;
  if exists (select 1 from public.game_night_game_sessions where game_night_session_id = v_session.id and status <> 'completed') then
    raise exception 'Er wordt nu gespeeld. Je kunt aansluiten zodra dit spel klaar is.' using errcode = '22023';
  end if;
  -- Bound creation through a leaked invitation; the session row lock also
  -- makes this bound and seat allocation hold for concurrent requests.
  if (select count(*) from public.game_night_session_players where session_id = v_session.id) >= 64 then
    raise exception 'Deze Game Night zit vol. Vraag de host om hulp.' using errcode = '22023';
  end if;
  if v_player_id is null then
    insert into public.game_night_players(name) values (btrim(p_name)) returning id into v_player_id;
    insert into private.game_night_guests(token_hash, player_id) values (v_hash, v_player_id);
  end if;
  perform private.game_night_save_guest_avatar(v_player_id, p_name, p_color_id, p_base_part_id, p_guest_face);
  update private.game_night_guests set expires_at = now() + interval '180 days' where token_hash = v_hash;
  select coalesce(max(seat_index), -1) + 1 into v_seat
    from public.game_night_session_players where session_id = v_session.id and active_at_table;
  insert into public.game_night_session_players(session_id, player_id, active_at_table, source, seat_index)
    values (v_session.id, v_player_id, true, 'qr_join', v_seat);
  return jsonb_build_object('session_id', v_session.id, 'player_id', v_player_id);
end;
$$;
revoke all on function public.game_night_join_as_guest(text, text, text, uuid, uuid, text) from public;
grant execute on function public.game_night_join_as_guest(text, text, text, uuid, uuid, text) to anon, authenticated;

-- Explicit projection: no auth IDs, private photo paths, invitation tokens,
-- credentials, historical nights or other site data in the guest response.
create function private.game_night_guest_player_view(p_player_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'name', coalesce(p.nickname, p.name),
    'guest_face', p.guest_face, 'color_id', p.color_id, 'color', coalesce(c.hex, p.color),
    'body', (select to_jsonb(part) from public.game_night_player_character_equipment e
      join public.game_night_character_parts part on part.id = e.part_id
      where e.player_id = p.id and e.slot = 'base' and part.active))
  from public.game_night_players p left join public.game_night_color_palette c on c.id = p.color_id
  where p.id = p_player_id;
$$;
revoke all on function private.game_night_guest_player_view(uuid) from public, anon, authenticated;

create function public.game_night_guest_state(
  p_guest_token text, p_session_id uuid default null, p_join_token text default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_player_id uuid := private.game_night_guest_player(p_guest_token);
  v_session public.game_night_sessions;
  v_attendance public.game_night_session_players;
begin
  if v_player_id is null then return jsonb_build_object('valid', false); end if;
  -- An expired/replaced QR can still recover an EXISTING membership. It
  -- never authorizes a new join. Refresh also works directly by session ID.
  if p_session_id is null then
    select game_night_session_id into p_session_id from public.game_night_join_tokens where token = p_join_token;
  end if;
  select * into v_attendance from public.game_night_session_players where session_id = p_session_id and player_id = v_player_id;
  if not found then return jsonb_build_object('valid', false); end if;
  select * into v_session from public.game_night_sessions where id = p_session_id;
  return jsonb_build_object(
    'valid', true, 'session', jsonb_build_object('id', v_session.id, 'name', v_session.name, 'status', v_session.status),
    'me', private.game_night_guest_player_view(v_player_id), 'at_table', v_attendance.active_at_table,
    'players', case when v_attendance.active_at_table then (
      select coalesce(jsonb_agg(private.game_night_guest_player_view(a.player_id) order by a.seat_index nulls last, a.joined_at), '[]'::jsonb)
      from public.game_night_session_players a join public.game_night_players p on p.id = a.player_id
      where a.session_id = p_session_id and a.active_at_table and p.archived_at is null
    ) else '[]'::jsonb end,
    'game', case when v_attendance.active_at_table then (
      select jsonb_build_object('name', g.name, 'status', s.status)
      from public.game_night_game_sessions s join public.game_night_games g on g.id = s.game_id
      where s.game_night_session_id = p_session_id and s.status <> 'completed' order by s.started_at desc limit 1
    ) else null end
  );
end;
$$;
revoke all on function public.game_night_guest_state(text, uuid, text) from public;
grant execute on function public.game_night_guest_state(text, uuid, text) to anon, authenticated;

create function public.game_night_update_guest(
  p_guest_token text, p_session_id uuid, p_name text,
  p_color_id uuid default null, p_base_part_id uuid default null, p_guest_face text default 'smile'
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_player_id uuid; v_session public.game_night_sessions;
begin
  select * into v_session from public.game_night_sessions where id = p_session_id for update;
  v_player_id := private.game_night_guest_player(p_guest_token);
  if v_player_id is null or v_session.id is null or v_session.status = 'completed' or not exists (
    select 1 from public.game_night_session_players where session_id = p_session_id and player_id = v_player_id and active_at_table
  ) then
    raise exception 'Je kunt je profiel nu niet aanpassen. Vraag de host om hulp.' using errcode = '42501';
  end if;
  perform 1 from public.game_night_players where id = v_player_id for update;
  perform private.game_night_save_guest_avatar(v_player_id, p_name, p_color_id, p_base_part_id, p_guest_face);
end;
$$;
revoke all on function public.game_night_update_guest(text, uuid, text, uuid, uuid, text) from public;
grant execute on function public.game_night_update_guest(text, uuid, text, uuid, uuid, text) to anon, authenticated;

commit;
