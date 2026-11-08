-- Game Night: the guest player picker shows who is already seated tonight,
-- so a newcomer does not pick someone else's saved player by mistake and
-- seated players can be listed after the rest. Same signature, same access
-- checks; only an extra `at_table` boolean per listed player.
begin;

create or replace function public.game_night_guest_players(p_join_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_session_id uuid;
begin
  if not (public.game_night_validate_join_token(p_join_token)->>'valid')::boolean then
    return jsonb_build_object('valid', false);
  end if;
  select game_night_session_id into v_session_id
    from public.game_night_join_tokens where token = p_join_token;
  return jsonb_build_object('valid', true, 'players', (
    select coalesce(jsonb_agg(
      private.game_night_guest_player_view(p.id) || jsonb_build_object(
        'at_table', exists (
          select 1 from public.game_night_session_players a
          where a.session_id = v_session_id and a.player_id = p.id and a.active_at_table
        )
      )
      order by lower(coalesce(p.nickname, p.name)), p.id), '[]'::jsonb)
    from public.game_night_players p where p.archived_at is null
  ));
end;
$$;
revoke all on function public.game_night_guest_players(text) from public;
grant execute on function public.game_night_guest_players(text) to anon, authenticated;

commit;
