-- Cocktail Bar — derde app_role, naast owner/r6_player. cocktail_guest is een
-- gedeeld tablet-account (geen los profiel per gast — zie het Cocktail
-- Bar-implementatieplan) dat uitsluitend cocktails mag bekijken/bestellen.
-- Volgt exact het patroon uit 20260816000000_app_roles_and_profiles.sql.

alter table public.profiles drop constraint profiles_app_role_check;
alter table public.profiles add constraint profiles_app_role_check
  check (app_role in ('owner', 'r6_player', 'cocktail_guest'));

create or replace function private.is_cocktail_guest()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select private.current_app_role() = 'cocktail_guest';
$$;

-- "Mag de Cocktail Bar-catalogus/tablet gebruiken" — owner (volledige
-- beheertoegang) of cocktail_guest (alleen bekijken/bestellen, zie RLS per
-- tabel in de volgende migraties).
create or replace function private.can_access_cocktail_bar()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select private.current_app_role() in ('owner', 'cocktail_guest');
$$;

revoke execute on function private.is_cocktail_guest() from public, anon;
revoke execute on function private.can_access_cocktail_bar() from public, anon;
grant execute on function private.is_cocktail_guest() to authenticated;
grant execute on function private.can_access_cocktail_bar() to authenticated;

-- set_profile_role opnieuw definiëren met dezelfde signatuur/bewaking als
-- 20260816000000_app_roles_and_profiles.sql, alleen met 'cocktail_guest'
-- toegevoegd aan de toegestane rollenlijst.
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
  if p_role not in ('owner', 'r6_player', 'cocktail_guest') then
    raise exception 'Ongeldige rol: %', p_role;
  end if;

  update public.profiles set app_role = p_role where id = p_user_id;

  if not found then
    raise exception 'Profiel voor gebruiker % bestaat niet', p_user_id;
  end if;
end;
$$;
