-- Rol `training_user`: een account dat UITSLUITEND Training mag gebruiken,
-- met alleen de eigen gegevens (bijvoorbeeld een testaccount voor iemand
-- buiten het huishouden).
--
-- Zelfde patroon als de eerdere rollenmigraties: check-constraint uitbreiden,
-- de toegangshelper verbreden, `set_profile_role` opnieuw definiëren met de
-- nieuwe rol op de allow-list.
--
-- Waarom dit veilig is:
--   * Geen enkele andere `is_*`/`can_*`-helper herkent 'training_user', dus
--     alle andere features blijven dicht zonder hun policies aan te raken.
--   * De trainingspolicies eisen al `user_id = auth.uid()`: ook een owner
--     ziet geen trainingsdata van een ander, en andersom.
--   * De nog openstaande oude "family access"-policies worden in de volgende
--     migratie (20261107000100) gesloten.
--
-- Toekennen (als owner, in de SQL-editor):
--   select public.set_profile_role('<account-uuid>', 'training_user');

begin;

alter table public.profiles drop constraint profiles_app_role_check;
alter table public.profiles add constraint profiles_app_role_check
  check (app_role in ('owner', 'r6_player', 'cocktail_guest', 'game_night_member', 'training_user', 'no_access'));

create or replace function private.can_use_training()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.current_app_role() in ('owner', 'training_user'), false);
$$;

revoke execute on function private.can_use_training() from public, anon;
grant execute on function private.can_use_training() to authenticated;

create or replace function public.set_profile_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag rollen beheren' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'r6_player', 'cocktail_guest', 'game_night_member', 'training_user', 'no_access') then
    raise exception 'Ongeldige rol: %', p_role;
  end if;

  update public.profiles set app_role = p_role where id = p_user_id;

  if not found then
    raise exception 'Profiel voor gebruiker % bestaat niet', p_user_id;
  end if;
end;
$$;

commit;
