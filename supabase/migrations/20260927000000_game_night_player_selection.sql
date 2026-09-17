-- Guests may freely choose an existing player after scanning a valid QR.
-- A device credential never grants account rights or access to nights merely
-- because the chosen player attended them on a different device.
begin;

alter table private.game_night_guests drop constraint game_night_guests_player_id_key;
create index game_night_guests_player_idx on private.game_night_guests(player_id);

create table private.game_night_guest_sessions (
  token_hash text not null references private.game_night_guests(token_hash) on delete cascade,
  session_id uuid not null references public.game_night_sessions(id) on delete cascade,
  primary key (token_hash, session_id)
);
alter table private.game_night_guest_sessions enable row level security;
revoke all on private.game_night_guest_sessions from public, anon, authenticated;
-- Preserve existing devices' access when upgrading from the first guest flow.
insert into private.game_night_guest_sessions(token_hash, session_id)
select g.token_hash, a.session_id from private.game_night_guests g
join public.game_night_session_players a on a.player_id = g.player_id;

create function private.game_night_guest_has_session(p_guest_token text, p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.game_night_guest_sessions
    where token_hash = encode(sha256(convert_to(p_guest_token, 'UTF8')), 'hex')
      and session_id = p_session_id
  );
$$;
revoke all on function private.game_night_guest_has_session(text, uuid) from public, anon, authenticated;

create function private.game_night_guest_join_session(p_join_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invite public.game_night_join_tokens; v_session public.game_night_sessions;
begin
  select * into v_invite from public.game_night_join_tokens where token = p_join_token for update;
  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'Deze uitnodiging is verlopen. Vraag de host om een nieuwe QR-code.' using errcode = '22023';
  end if;
  select * into v_session from public.game_night_sessions where id = v_invite.game_night_session_id for update;
  if not found or v_session.status = 'completed' then
    raise exception 'Deze Game Night is afgelopen.' using errcode = '22023';
  end if;
  return v_session.id;
end;
$$;
revoke all on function private.game_night_guest_join_session(text) from public, anon, authenticated;

-- Caller holds the session lock. Existing attendance is never reordered or
-- reactivated; a second phone selecting the same player gets the same seat.
create function private.game_night_seat_guest(p_session_id uuid, p_player_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_seat integer;
begin
  if exists (select 1 from public.game_night_session_players where session_id = p_session_id and player_id = p_player_id) then
    return;
  end if;
  if exists (select 1 from public.game_night_game_sessions where game_night_session_id = p_session_id and status <> 'completed') then
    raise exception 'Er wordt nu gespeeld. Je kunt aansluiten zodra dit spel klaar is.' using errcode = '22023';
  end if;
  if (select count(*) from public.game_night_session_players where session_id = p_session_id) >= 64 then
    raise exception 'Deze Game Night zit vol. Vraag de host om hulp.' using errcode = '22023';
  end if;
  select coalesce(max(seat_index), -1) + 1 into v_seat
    from public.game_night_session_players where session_id = p_session_id and active_at_table;
  insert into public.game_night_session_players(session_id, player_id, active_at_table, source, seat_index)
    values (p_session_id, p_player_id, true, 'qr_join', v_seat);
end;
$$;
revoke all on function private.game_night_seat_guest(uuid, uuid) from public, anon, authenticated;

create or replace function public.game_night_join_as_guest(
  p_join_token text, p_guest_token text, p_name text,
  p_color_id uuid default null, p_base_part_id uuid default null, p_guest_face text default 'smile'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session_id uuid; v_player_id uuid; v_hash text;
begin
  if p_guest_token is null or p_guest_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Ongeldige gastcode. Open de uitnodiging opnieuw.' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(p_guest_token, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(v_hash, 0));
  v_session_id := private.game_night_guest_join_session(p_join_token);
  v_player_id := private.game_night_guest_player(p_guest_token);
  if v_player_id is null then
    if exists (select 1 from private.game_night_guests where token_hash = v_hash) then
      raise exception 'Deze gasttoegang is niet meer actief. Kies je speler opnieuw.' using errcode = '42501';
    end if;
    if p_name is null or length(btrim(p_name)) not between 1 and 40 then
      raise exception 'Vul een naam in van maximaal 40 tekens.' using errcode = '22023';
    end if;
    insert into public.game_night_players(name) values (btrim(p_name)) returning id into v_player_id;
    insert into private.game_night_guests(token_hash, player_id) values (v_hash, v_player_id);
    perform private.game_night_save_guest_avatar(v_player_id, p_name, p_color_id, p_base_part_id, p_guest_face);
  end if;
  -- Rejoining preserves the stored name, avatar, color and equipment exactly.
  perform private.game_night_seat_guest(v_session_id, v_player_id);
  insert into private.game_night_guest_sessions(token_hash, session_id) values (v_hash, v_session_id) on conflict do nothing;
  update private.game_night_guests set expires_at = now() + interval '180 days' where token_hash = v_hash;
  return jsonb_build_object('session_id', v_session_id, 'player_id', v_player_id);
end;
$$;
revoke all on function public.game_night_join_as_guest(text, text, text, uuid, uuid, text) from public;
grant execute on function public.game_night_join_as_guest(text, text, text, uuid, uuid, text) to anon, authenticated;

create function public.game_night_guest_players(p_join_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.game_night_validate_join_token(p_join_token)->>'valid')::boolean then
    return jsonb_build_object('valid', false);
  end if;
  return jsonb_build_object('valid', true, 'players', (
    select coalesce(jsonb_agg(private.game_night_guest_player_view(p.id) order by lower(coalesce(p.nickname, p.name)), p.id), '[]'::jsonb)
    from public.game_night_players p where p.archived_at is null
  ));
end;
$$;
revoke all on function public.game_night_guest_players(text) from public;
grant execute on function public.game_night_guest_players(text) to anon, authenticated;

create function public.game_night_choose_guest_player(p_join_token text, p_guest_token text, p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session_id uuid; v_hash text; v_credential private.game_night_guests;
begin
  if p_guest_token is null or p_guest_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Ongeldige gastcode. Open de uitnodiging opnieuw.' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(p_guest_token, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(v_hash, 0));
  v_session_id := private.game_night_guest_join_session(p_join_token);
  perform 1 from public.game_night_players where id = p_player_id and archived_at is null for update;
  if not found then
    raise exception 'Deze speler is niet meer beschikbaar. Kies een andere speler.' using errcode = '22023';
  end if;
  select * into v_credential from private.game_night_guests where token_hash = v_hash;
  if found and (v_credential.player_id <> p_player_id or v_credential.revoked_at is not null or v_credential.expires_at <= now()) then
    raise exception 'Kies je speler opnieuw met een nieuwe gastcode.' using errcode = '42501';
  end if;
  perform private.game_night_seat_guest(v_session_id, p_player_id);
  insert into private.game_night_guests(token_hash, player_id) values (v_hash, p_player_id)
    on conflict (token_hash) do update set expires_at = now() + interval '180 days';
  insert into private.game_night_guest_sessions(token_hash, session_id) values (v_hash, v_session_id) on conflict do nothing;
  return jsonb_build_object('session_id', v_session_id, 'player_id', p_player_id);
end;
$$;
revoke all on function public.game_night_choose_guest_player(text, text, uuid) from public;
grant execute on function public.game_night_choose_guest_player(text, text, uuid) to anon, authenticated;

create or replace function public.game_night_guest_state(
  p_guest_token text, p_session_id uuid default null, p_join_token text default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_player_id uuid := private.game_night_guest_player(p_guest_token);
  v_session public.game_night_sessions;
  v_attendance public.game_night_session_players;
begin
  if v_player_id is null then return jsonb_build_object('valid', false); end if;
  if p_session_id is null then
    select game_night_session_id into p_session_id from public.game_night_join_tokens where token = p_join_token;
  end if;
  if not private.game_night_guest_has_session(p_guest_token, p_session_id) then
    return jsonb_build_object('valid', false);
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

create or replace function public.game_night_update_guest(
  p_guest_token text, p_session_id uuid, p_name text,
  p_color_id uuid default null, p_base_part_id uuid default null, p_guest_face text default 'smile'
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_player_id uuid; v_session public.game_night_sessions;
begin
  select * into v_session from public.game_night_sessions where id = p_session_id for update;
  v_player_id := private.game_night_guest_player(p_guest_token);
  if v_player_id is null or v_session.id is null or v_session.status = 'completed'
     or not private.game_night_guest_has_session(p_guest_token, p_session_id) or not exists (
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
