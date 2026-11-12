-- Game Night — Secret Hitler-modus.
--
-- De host houdt het fysieke spel bij op het tafelscherm: verkiezingen,
-- stemmen, wetten, claims, presidentiële machten en aan het eind de
-- rollen. Zelfde patroon als game_night_win_events en de Mario Kart-
-- punten: een append-only event-log per spelsessie, `undone_at` markeert
-- "ongedaan gemaakt". De spelstaat wordt client-side afgeleid
-- (src/features/game-night/lib/secretHitler.ts), zodat host en telefoons
-- exact dezelfde motor gebruiken.
--
-- Telefoons (gasten) zien het bord mee en kunnen in het geheim aanwijzen
-- wie zij voor Hitler houden. Na afloop krijgt elk lid van het winnende
-- team één gewone WIN (game_night_win_events), zodat Hall of Fame,
-- stand en geschiedenis gewoon blijven werken.
begin;

create table public.game_night_secret_hitler_events (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_night_game_sessions(id) on delete cascade,
  payload jsonb not null,
  event_type text generated always as (payload->>'type') stored,
  created_at timestamptz not null default clock_timestamp(),
  undone_at timestamptz,
  constraint game_night_secret_hitler_events_type_check check (
    payload->>'type' in (
      'start', 'nominate', 'vote', 'hitler_check', 'enact', 'veto', 'chaos',
      'investigate', 'peek', 'special_election', 'execute', 'quote',
      'declare_winner', 'reveal'
    )
  ),
  constraint game_night_secret_hitler_events_size_check check (
    octet_length(payload::text) <= 4000
  )
);

create index game_night_secret_hitler_events_session_idx
  on public.game_night_secret_hitler_events (game_session_id, created_at);

alter table public.game_night_secret_hitler_events enable row level security;

create policy "game_night_secret_hitler_events: owner only" on public.game_night_secret_hitler_events
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

create policy "game_night_secret_hitler_events: member select" on public.game_night_secret_hitler_events
  for select to authenticated
  using (private.is_game_night_member_or_owner());

revoke all on public.game_night_secret_hitler_events from anon;

-- Eén geheime verdenking per speler per spelsessie ("wie is Hitler?"),
-- in te stellen vanaf de eigen telefoon. Het tafelscherm toont alleen
-- het anonieme totaal; na de onthulling volgen de awards.
create table public.game_night_secret_hitler_suspicions (
  game_session_id uuid not null references public.game_night_game_sessions(id) on delete cascade,
  voter_player_id uuid not null references public.game_night_players(id) on delete cascade,
  suspect_player_id uuid not null references public.game_night_players(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (game_session_id, voter_player_id),
  constraint game_night_secret_hitler_suspicions_not_self check (voter_player_id <> suspect_player_id)
);

alter table public.game_night_secret_hitler_suspicions enable row level security;

create policy "game_night_secret_hitler_suspicions: owner only" on public.game_night_secret_hitler_suspicions
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_secret_hitler_suspicions from anon;

-- ── Hulpfunctie: is dit een lopende Secret Hitler-spelsessie? ────────────
create function private.game_night_is_secret_hitler_session(p_game_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.game_night_game_sessions s
    join public.game_night_games g on g.id = s.game_id
    where s.id = p_game_session_id and g.slug = 'secret-hitler'
  );
$$;
revoke all on function private.game_night_is_secret_hitler_session(uuid) from public, anon, authenticated;
grant execute on function private.game_night_is_secret_hitler_session(uuid) to authenticated;

-- ── Event vastleggen (owner) ─────────────────────────────────────────────
-- Geen SECURITY DEFINER: de owner heeft via de policy al toegang; dit is
-- een nette foutmelding + de controle dat de spelsessie nog loopt.
create function public.game_night_secret_hitler_record(
  p_game_session_id uuid,
  p_payload jsonb
)
returns public.game_night_secret_hitler_events
language plpgsql
as $$
declare
  v_session public.game_night_game_sessions;
  v_row public.game_night_secret_hitler_events;
begin
  if not private.is_owner() then
    raise exception 'Alleen de host mag Secret Hitler bijhouden' using errcode = '42501';
  end if;
  select * into v_session from public.game_night_game_sessions
    where id = p_game_session_id for update;
  if not found then
    raise exception 'Spelsessie % niet gevonden', p_game_session_id;
  end if;
  if v_session.status = 'completed' then
    raise exception 'Dit spel is al afgesloten' using errcode = '22023';
  end if;
  if not private.game_night_is_secret_hitler_session(p_game_session_id) then
    raise exception 'Dit is geen Secret Hitler-spel' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Ongeldig event' using errcode = '22023';
  end if;

  insert into public.game_night_secret_hitler_events (game_session_id, payload)
  values (p_game_session_id, p_payload)
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.game_night_secret_hitler_record(uuid, jsonb) from public, anon;
grant execute on function public.game_night_secret_hitler_record(uuid, jsonb) to authenticated;

-- ── Laatste stap ongedaan maken (owner) ──────────────────────────────────
create function public.game_night_secret_hitler_undo_last(p_game_session_id uuid)
returns public.game_night_secret_hitler_events
language plpgsql
as $$
declare
  v_row public.game_night_secret_hitler_events;
begin
  if not private.is_owner() then
    raise exception 'Alleen de host mag Secret Hitler bijhouden' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.game_night_game_sessions
    where id = p_game_session_id and status = 'completed'
  ) then
    raise exception 'Dit spel is al afgesloten' using errcode = '22023';
  end if;
  select * into v_row from public.game_night_secret_hitler_events
    where game_session_id = p_game_session_id and undone_at is null
    order by created_at desc, id desc
    limit 1
    for update;
  if not found then
    raise exception 'Niets om ongedaan te maken' using errcode = '22023';
  end if;
  update public.game_night_secret_hitler_events set undone_at = now()
    where id = v_row.id returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.game_night_secret_hitler_undo_last(uuid) from public, anon;
grant execute on function public.game_night_secret_hitler_undo_last(uuid) to authenticated;

-- ── Afronden (owner): één WIN per winnend teamlid + spel afsluiten ──────
-- Atomisch, zodat er nooit een half geregistreerde uitslag ontstaat.
create function public.game_night_secret_hitler_finish(
  p_game_session_id uuid,
  p_winner_ids uuid[]
)
returns public.game_night_game_sessions
language plpgsql
as $$
declare
  v_session public.game_night_game_sessions;
  v_count integer;
begin
  if not private.is_owner() then
    raise exception 'Alleen de host mag Secret Hitler afronden' using errcode = '42501';
  end if;
  select * into v_session from public.game_night_game_sessions
    where id = p_game_session_id for update;
  if not found then
    raise exception 'Spelsessie % niet gevonden', p_game_session_id;
  end if;
  if v_session.status = 'completed' then
    return v_session;
  end if;
  if v_session.win_source <> 'win_events' then
    raise exception 'Deze spelsessie gebruikt geen WIN-events' using errcode = '22023';
  end if;
  if not private.game_night_is_secret_hitler_session(p_game_session_id) then
    raise exception 'Dit is geen Secret Hitler-spel' using errcode = '22023';
  end if;

  select count(*) into v_count
  from public.game_night_game_session_players
  where game_session_id = p_game_session_id
    and player_id = any(coalesce(p_winner_ids, '{}'));
  if v_count <> coalesce(array_length(p_winner_ids, 1), 0) then
    raise exception 'Alle winnaars moeten meespelen' using errcode = '22023';
  end if;

  insert into public.game_night_win_events (game_session_id, player_id)
  select p_game_session_id, pid
  from unnest(coalesce(p_winner_ids, '{}')) as pid
  where not exists (
    select 1 from public.game_night_win_events w
    where w.game_session_id = p_game_session_id
      and w.player_id = pid and w.undone_at is null
  );

  update public.game_night_game_sessions
    set status = 'completed', ended_at = now()
    where id = p_game_session_id
    returning * into v_session;
  return v_session;
end;
$$;
revoke execute on function public.game_night_secret_hitler_finish(uuid, uuid[]) from public, anon;
grant execute on function public.game_night_secret_hitler_finish(uuid, uuid[]) to authenticated;

-- ── Telefoon: bord meekijken + eigen verdenking ──────────────────────────
-- Laatste spelsessie van deze avond, alleen als dat Secret Hitler is.
-- Events bevatten geen geheime informatie: rollen staan er pas in na de
-- onthulling aan het eind.
create function public.game_night_guest_secret_hitler(
  p_guest_token text,
  p_session_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_player_id uuid := private.game_night_guest_player(p_guest_token);
  v_game public.game_night_game_sessions;
begin
  if v_player_id is null
     or not private.game_night_guest_has_session(p_guest_token, p_session_id)
     or not exists (
       select 1 from public.game_night_session_players
       where session_id = p_session_id and player_id = v_player_id and active_at_table
     ) then
    return jsonb_build_object('active', false);
  end if;

  select s.* into v_game
  from public.game_night_game_sessions s
  where s.game_night_session_id = p_session_id
  order by s.started_at desc
  limit 1;
  if not found or not private.game_night_is_secret_hitler_session(v_game.id) then
    return jsonb_build_object('active', false);
  end if;

  return jsonb_build_object(
    'active', true,
    'game_session_id', v_game.id,
    'status', v_game.status,
    'me', v_player_id,
    'seats', (
      select coalesce(jsonb_agg(sp.player_id order by sp.seat_order nulls last, sp.created_at), '[]'::jsonb)
      from public.game_night_game_session_players sp
      where sp.game_session_id = v_game.id
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'created_at', e.created_at, 'payload', e.payload
      ) order by e.created_at, e.id), '[]'::jsonb)
      from public.game_night_secret_hitler_events e
      where e.game_session_id = v_game.id and e.undone_at is null
    ),
    'my_suspect', (
      select su.suspect_player_id from public.game_night_secret_hitler_suspicions su
      where su.game_session_id = v_game.id and su.voter_player_id = v_player_id
    ),
    'suspicions', case when exists (
      select 1 from public.game_night_secret_hitler_events e
      where e.game_session_id = v_game.id and e.undone_at is null and e.event_type = 'reveal'
    ) then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'voter_player_id', su.voter_player_id, 'suspect_player_id', su.suspect_player_id
      )), '[]'::jsonb)
      from public.game_night_secret_hitler_suspicions su
      where su.game_session_id = v_game.id
    ) else '[]'::jsonb end
  );
end;
$$;
revoke all on function public.game_night_guest_secret_hitler(text, uuid) from public;
grant execute on function public.game_night_guest_secret_hitler(text, uuid) to anon, authenticated;

create function public.game_night_guest_secret_hitler_suspect(
  p_guest_token text,
  p_session_id uuid,
  p_suspect_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_player_id uuid := private.game_night_guest_player(p_guest_token);
  v_game public.game_night_game_sessions;
begin
  if v_player_id is null
     or not private.game_night_guest_has_session(p_guest_token, p_session_id) then
    raise exception 'Je kunt nu niemand verdenken.' using errcode = '42501';
  end if;

  select s.* into v_game
  from public.game_night_game_sessions s
  where s.game_night_session_id = p_session_id and s.status <> 'completed'
  order by s.started_at desc
  limit 1;
  if not found or not private.game_night_is_secret_hitler_session(v_game.id) then
    raise exception 'Er loopt geen Secret Hitler-spel.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.game_night_game_session_players
    where game_session_id = v_game.id and player_id = v_player_id
  ) then
    raise exception 'Je speelt dit spel niet mee.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.game_night_secret_hitler_events e
    where e.game_session_id = v_game.id and e.undone_at is null and e.event_type = 'reveal'
  ) then
    raise exception 'De rollen zijn al onthuld.' using errcode = '22023';
  end if;

  if p_suspect_id is null then
    delete from public.game_night_secret_hitler_suspicions
      where game_session_id = v_game.id and voter_player_id = v_player_id;
    return;
  end if;
  if p_suspect_id = v_player_id or not exists (
    select 1 from public.game_night_game_session_players
    where game_session_id = v_game.id and player_id = p_suspect_id
  ) then
    raise exception 'Kies een medespeler.' using errcode = '22023';
  end if;

  insert into public.game_night_secret_hitler_suspicions
    (game_session_id, voter_player_id, suspect_player_id)
  values (v_game.id, v_player_id, p_suspect_id)
  on conflict (game_session_id, voter_player_id)
    do update set suspect_player_id = excluded.suspect_player_id, updated_at = now();
end;
$$;
revoke all on function public.game_night_guest_secret_hitler_suspect(text, uuid, uuid) from public;
grant execute on function public.game_night_guest_secret_hitler_suspect(text, uuid, uuid) to anon, authenticated;

commit;
