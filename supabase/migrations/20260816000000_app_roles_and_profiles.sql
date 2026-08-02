-- Gebruikersrollen, deel 1: profielentabel + rolbepaling.
--
-- Tot nu toe was elk ingelogd account (via `authenticated`) impliciet
-- vertrouwd met volledige toegang tot de hele app — RLS-policies checkten
-- overal alleen "ben je ingelogd", nooit "als wie". Deze migratie voegt de
-- databasegestuurde bron van waarheid toe voor twee applicatierollen
-- (`owner`, `r6_player`); de daadwerkelijke toegangsbeperking per tabel volgt
-- in de vervolgmigraties (20260816010000/20260816020000).
--
-- `private`-schema: NIET opgenomen in `api.schemas` (zie supabase/config.toml
-- — alleen `public`/`graphql_public` zijn blootgesteld), dus alles hierin is
-- structureel onbereikbaar via de Data API/PostgREST, ongeacht grants. Dat is
-- precies waarom de rol-helperfuncties hier staan: ze mogen nooit als losse
-- RPC aanroepbaar zijn, alleen intern door RLS-policies gebruikt worden.

create schema if not exists private;

-- Alleen `authenticated` (en impliciet `postgres`/de functie-eigenaar) heeft
-- iets aan dit schema — geen enkele reden om het voor `anon`/`public`
-- bruikbaar te maken, ook al is het via de API toch al onbereikbaar.
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ── profiles ─────────────────────────────────────────────────────────────
-- Eén rij per auth.users-account. `app_role` is de ENIGE bron van waarheid
-- voor autorisatie — nooit `raw_user_meta_data`/`user_metadata`, want dat is
-- vanaf de client zelf aan te passen via `supabase.auth.updateUser()` en dus
-- geen veilige plek om een rol in op te slaan.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  app_role text not null default 'r6_player',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_app_role_check check (app_role in ('owner', 'r6_player'))
);

create or replace function public.profiles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.profiles_set_updated_at();

-- ── Rolhelpers (private schema, SECURITY DEFINER) ───────────────────────
-- SECURITY DEFINER + `set search_path = ''` + volledig schema-gekwalificeerd
-- (`public.profiles`, nooit kaal `profiles`) — voorkomt zowel het klassieke
-- search_path-hijack-lek (iemand die een eigen `profiles`-object ergens
-- eerder in het search_path zet) als RLS-recursie: een SECURITY DEFINER-
-- functie draait met de rechten van de functie-eigenaar (de rol die deze
-- migratie uitvoert, doorgaans de tabel-eigenaar), en RLS is per definitie
-- niet van toepassing op de tabel-eigenaar — dus deze SELECT op
-- public.profiles evalueert nooit de RLS-policies van public.profiles zelf
-- (die hieronder juist wél `private.current_app_role()` aanroepen), en kan
-- dus nooit in een oneindige recursielus terechtkomen.
--
-- `stable` (niet `volatile`) — de rol van de huidige sessie verandert niet
-- binnen één statement, dus de planner mag dit per statement cachen i.p.v.
-- per rij opnieuw te evalueren in een RLS-policy die over meerdere rijen
-- loopt.
create or replace function private.current_app_role()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select app_role from public.profiles where id = auth.uid();
$$;

create or replace function private.is_owner()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select private.current_app_role() = 'owner';
$$;

-- "Heeft een geldig profiel met een van de twee toegestane rollen" — in de
-- praktijk elke ingelogde gebruiker MET profiel, dus zowel owner als
-- r6_player; een account zonder profielrij (zou niet moeten voorkomen dankzij
-- de trigger hieronder, maar defensief) geeft hier bewust `false` terug, niet
-- `true` — fail closed.
create or replace function private.is_r6_or_owner()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select private.current_app_role() in ('owner', 'r6_player');
$$;

revoke execute on function private.current_app_role() from public, anon;
revoke execute on function private.is_owner() from public, anon;
revoke execute on function private.is_r6_or_owner() from public, anon;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_owner() to authenticated;
grant execute on function private.is_r6_or_owner() to authenticated;

-- ── Automatisch profiel bij nieuwe gebruiker ────────────────────────────
-- Geen bestaande trigger op auth.users gevonden in de migratiehistorie — dit
-- is de eerste. Veilige standaardrol is altijd 'r6_player'; 'owner' wordt
-- nooit automatisch toegekend (zie sectie hieronder voor het expliciete
-- eigen-account-owner-commando).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, app_role)
  values (new.id, 'r6_player')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ── RLS op profiles ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "Owner reads all profiles" on public.profiles;
drop policy if exists "r6_player reads own profile" on public.profiles;
drop policy if exists "Users update own display name" on public.profiles;
drop policy if exists "Owner can insert profiles" on public.profiles;
drop policy if exists "Owner can delete profiles" on public.profiles;

-- SELECT: owner ziet iedereen (nodig voor eventueel gebruikersbeheer),
-- r6_player ziet uitsluitend de eigen rij.
create policy "Owner reads all profiles" on public.profiles
  for select to authenticated
  using (private.is_owner() or id = auth.uid());

-- UPDATE: BEWUST geen brede "update eigen rij"-policy — die zou impliciet
-- ook `app_role` updatebaar maken voor de rij-eigenaar zelf (RLS filtert
-- welke RIJEN je mag raken, niet welke KOLOMMEN). In plaats daarvan: de RLS-
-- policy staat een update van de eigen rij toe, maar de kolom-grant
-- hieronder beperkt dat in de praktijk tot alleen `display_name`/
-- `updated_at` — een UPDATE-statement dat ook `app_role` in de SET-lijst
-- zet wordt door Postgres' kolom-privilegecontrole geweigerd, nog vóórdat
-- RLS er iets mee doet. `app_role` wijzigen voor jezelf óf voor een ander
-- kan dus alleen via de aparte, expliciet gecontroleerde RPC hieronder
-- (set_profile_role).
create policy "Users update own display name" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;

-- INSERT: nooit vanaf de client — de trigger hierboven is de enige plek waar
-- profielrijen ontstaan. Geen INSERT-policy = geen enkele authenticated-rol
-- kan zelf een profielrij aanmaken (de trigger draait als SECURITY DEFINER
-- en is dus niet aan RLS gebonden).
--
-- DELETE: nooit vanaf de client — een profiel verdwijnt alleen via de
-- `on delete cascade` op auth.users (accountverwijdering via het Supabase
-- Dashboard/Admin-API). Geen DELETE-policy = geen toegang.

-- ── Rolbeheer-RPC (owner-only) ───────────────────────────────────────────
-- De ENE veilige manier om `app_role` van jezelf óf een ander account te
-- wijzigen. SECURITY DEFINER (bypasst de kolom-grant-beperking hierboven,
-- want die functie draait als eigenaar) — de expliciete `is_owner()`-check
-- hieronder is daardoor de ENIGE bewaking, dus die mag nooit ontbreken of
-- weggeoptimaliseerd worden.
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
  if p_role not in ('owner', 'r6_player') then
    raise exception 'Ongeldige rol: %', p_role;
  end if;

  update public.profiles set app_role = p_role where id = p_user_id;

  if not found then
    raise exception 'Profiel voor gebruiker % bestaat niet', p_user_id;
  end if;
end;
$$;

revoke execute on function public.set_profile_role(uuid, text) from public, anon;
grant execute on function public.set_profile_role(uuid, text) to authenticated;

-- ── Backfill voor reeds bestaande accounts ───────────────────────────────
-- Iedereen die al een auth.users-rij heeft maar (uiteraard, want de trigger
-- hierboven bestond nog niet) nog geen profiel — krijgt de veilige default
-- 'r6_player'. Verandert NOOIT een reeds bestaande profielrij (ON CONFLICT
-- DO NOTHING) en kent dus ook nooit met terugwerkende kracht 'owner' toe.
insert into public.profiles (id, app_role)
select u.id, 'r6_player'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
