-- Game Night V2.3 — nieuwe app_role `game_night_member` + de smalle,
-- expliciet gecontroleerde RPC's die erbij horen (account-koppeling,
-- eigen-profiel-update). Additief op de zeventien bestaande Game
-- Night-migraties + de site-brede rollenmigraties
-- (20260816000000_app_roles_and_profiles.sql,
-- 20260818000000_cocktail_bar_role.sql). Volgt exact hetzelfde patroon als
-- die twee: check-constraint uitbreiden, een `private`-helperfunctie,
-- `set_profile_role` herdefiniëren met de nieuwe rol op de allow-list.
--
-- BELANGRIJK: dit bestand verandert NERGENS de standaardrol voor nieuwe
-- accounts — `handle_new_user()` blijft ongewijzigd altijd 'r6_player'
-- toekennen. Een account wordt pas 'game_night_member' via een expliciete
-- owneractie (game_night_link_player_account hieronder), nooit automatisch.
--
-- CORRECTIE (vóór eerste uitvoering, na review): naast 'game_night_member'
-- voegt dit bestand ook 'no_access' toe — de veilige rol waar een account
-- naartoe gaat zodra een owner de Game Night-koppeling verbreekt (zie
-- game_night_unlink_player_account hieronder). Zonder deze rol bleef een
-- ontkoppeld account stilzwijgend 'game_night_member' en dus nog gewoon
-- Game Night-data kunnen lezen — 'no_access' is bewust GEEN 'r6_player'
-- (dat zou onbedoeld Rainbow Six-toegang geven) en geen enkele bestaande
-- rol: het is een rol die door GEEN ENKELE `is_*_or_owner()`-helper in de
-- hele site wordt herkend, dus faalt automatisch overal dicht zonder ook
-- maar één bestaande RLS-policy te hoeven aanpassen.

-- ── Rollen toevoegen ────────────────────────────────────────────────────────
alter table public.profiles drop constraint profiles_app_role_check;
alter table public.profiles add constraint profiles_app_role_check
  check (app_role in ('owner', 'r6_player', 'cocktail_guest', 'game_night_member', 'no_access'));

-- "Mag Game Night gebruiken" — owner (volledige toegang) of game_night_member
-- (beperkte, member-scoped toegang; zie de RLS-migratie hierna). Zelfde vorm
-- als private.is_r6_or_owner()/private.can_access_cocktail_bar().
create or replace function private.is_game_night_member_or_owner()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select private.current_app_role() in ('owner', 'game_night_member');
$$;

revoke execute on function private.is_game_night_member_or_owner() from public, anon;
grant execute on function private.is_game_night_member_or_owner() to authenticated;

-- set_profile_role opnieuw definiëren met dezelfde signatuur/bewaking als
-- de twee eerdere versies, alleen met 'game_night_member' toegevoegd.
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
  if p_role not in ('owner', 'r6_player', 'cocktail_guest', 'game_night_member', 'no_access') then
    raise exception 'Ongeldige rol: %', p_role;
  end if;

  update public.profiles set app_role = p_role where id = p_user_id;

  if not found then
    raise exception 'Profiel voor gebruiker % bestaat niet', p_user_id;
  end if;
end;
$$;

-- ── Account ↔ speler-koppeling (owner-only) ───────────────────────────────
-- V2.1 (20260912130000) voegde game_night_players.auth_user_id +
-- `unique (auth_user_id) where auth_user_id is not null` al toe — die
-- constraint dekt "één account hoogstens één speler" en "één speler
-- hoogstens één account" volledig (een unique index op een kolom afwaakt
-- per definitie ook de omgekeerde richting: player.id is de primary key,
-- dus er kan sowieso nooit twee keer dezelfde player_id met een ander
-- auth_user_id bestaan). Geen aanvullende constraint nodig.
--
-- Er bestaat NERGENS in de app een manier om bestaande auth-accounts op te
-- sommen (geen "browse profiles"-UI, `auth`-schema niet via de API
-- bereikbaar) — de owner haalt het account-UUID zelf op via het Supabase
-- Dashboard (Authentication → Users) en plakt dat hier. V2.3 bouwt bewust
-- geen self-service signup/account-browser (dat is V2.4).
--
-- SECURITY DEFINER is hier vereist om dezelfde reden als set_profile_role:
-- `app_role` wijzigen kan niet via een gewone RLS-policy + kolom-grant
-- (die kolom is bewust NIET breed schrijfbaar, zie
-- 20260816000000_app_roles_and_profiles.sql) — alleen een functie die als
-- eigenaar draait kan dat, met de owner-check hieronder als enige, altijd
-- actieve bewaking.
--
-- BELANGRIJKE, BEWUSTE BEPERKING — single-role systeem (review-sectie 3/4):
-- `profiles.app_role` is en blijft in V2.3 één enkele waarde, geen set. Een
-- account kan dus op elk moment maar precies één van owner/r6_player/
-- cocktail_guest/game_night_member/no_access zijn. Koppelen aan een Game
-- Night-speler ZET de rol van het doelaccount naar 'game_night_member' —
-- als dat account op dat moment al 'r6_player' of 'cocktail_guest' was,
-- verliest het die toegang stilzwijgend (behalve 'owner', die wordt hier
-- nooit gedegradeerd). Dit is een expliciet geaccepteerde beperking voor
-- deze fase, GEEN bug: een echte multi-role-architectuur (bv. een aparte
-- `profile_roles`-tabel) is een grotere, eigen te ontwerpen auth-migratie
-- (zie het opleverrapport) — niet iets om hier terloops te bouwen. De
-- frontend (GameNightPlayerProfile.tsx) toont de owner daarom vóór het
-- koppelen expliciet de HUIDIGE rol van het doelaccount, zodat dit nooit
-- een stille verrassing is.
create or replace function public.game_night_link_player_account(
  p_player_id uuid,
  p_auth_user_id uuid
)
returns public.game_night_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.game_night_players;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag accounts koppelen' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.game_night_players where id = p_player_id
  ) then
    raise exception 'Speler % niet gevonden', p_player_id;
  end if;
  if not exists (
    select 1 from public.profiles where id = p_auth_user_id
  ) then
    raise exception 'Geen profiel gevonden voor account-id %', p_auth_user_id
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.game_night_players
    where auth_user_id = p_auth_user_id and id <> p_player_id
  ) then
    raise exception 'Dit account is al gekoppeld aan een andere speler'
      using errcode = '23505';
  end if;

  -- Koppelen kent het account automatisch de game_night_member-rol toe —
  -- BEHALVE als het al owner is, die rol wordt hier nooit gedegradeerd.
  update public.profiles
  set app_role = 'game_night_member'
  where id = p_auth_user_id and app_role <> 'owner';

  update public.game_night_players
  set auth_user_id = p_auth_user_id
  where id = p_player_id
  returning * into v_player;

  return v_player;
end;
$$;

revoke execute on function public.game_night_link_player_account(uuid, uuid)
  from public, anon;
grant execute on function public.game_night_link_player_account(uuid, uuid)
  to authenticated;

-- Ontkoppelen (sectie 15, GECORRIGEERD vóór eerste uitvoering — zie review):
-- de oorspronkelijke versie zette alleen auth_user_id op null en liet
-- `profiles.app_role` ONGEMOEID op 'game_night_member' staan. Omdat elke
-- nieuwe member-RLS-policy en RequireAppAccess uitsluitend naar
-- `profiles.app_role` kijken (nooit naar game_night_players.auth_user_id
-- zelf), betekende dat een "ontkoppeld" account gewoon member-toegang
-- BLEEF houden — precies het lek dat deze correctie sluit.
--
-- Nieuwe semantiek: naast auth_user_id op null zetten, gaat de rol van het
-- (voorheen gekoppelde) account naar 'no_access' — maar ALLEEN als die rol
-- op dat moment nog letterlijk 'game_night_member' is. Dat dubbele hek is
-- bewust:
--   1. 'owner' wordt hier NOOIT aangeraakt (een owner die zichzelf ooit aan
--      een speler koppelde en later ontkoppelt, blijft gewoon owner);
--   2. een rol die deze link-flow zelf nooit gezet kan hebben (in de
--      praktijk kan dat na sectie 3/4 hierboven niet meer voorkomen, maar
--      de check kost niets en voorkomt dat een toekomstige, handmatige
--      dashboard-koppeling per ongeluk gedegradeerd wordt).
--
-- Historie/player-record/auth-account zelf blijven volledig onaangeroerd —
-- geen cascade, geen delete, alleen deze twee kolommen.
create or replace function public.game_night_unlink_player_account(
  p_player_id uuid
)
returns public.game_night_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.game_night_players;
  v_auth_user_id uuid;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag accounts ontkoppelen' using errcode = '42501';
  end if;

  select auth_user_id into v_auth_user_id
  from public.game_night_players
  where id = p_player_id;

  if not found then
    raise exception 'Speler % niet gevonden', p_player_id;
  end if;

  update public.game_night_players
  set auth_user_id = null
  where id = p_player_id
  returning * into v_player;

  if v_auth_user_id is not null then
    update public.profiles
    set app_role = 'no_access'
    where id = v_auth_user_id and app_role = 'game_night_member';
  end if;

  return v_player;
end;
$$;

revoke execute on function public.game_night_unlink_player_account(uuid)
  from public, anon;
grant execute on function public.game_night_unlink_player_account(uuid)
  to authenticated;

-- ── Eigen profiel bijwerken (member én owner-voor-zichzelf) ───────────────
-- Bewust een smalle RPC i.p.v. een brede "update eigen rij"-RLS-policy +
-- kolom-grant (zoals profiles.display_name dat doet): game_night_players
-- heeft veel meer owner-beheerde kolommen (archived_at, sort_order, name,
-- color, avatar_url, ...) dan profiles ooit had, dus een kolom-grant-
-- restrictie voor `authenticated` zou owners bestaande brede
-- beheerstoegang (archiveren, hernoemen, etc. via de bestaande hooks)
-- stukmaken — kolomrechten zijn nu eenmaal rol-breed in Postgres, niet
-- per-policy. Een SECURITY DEFINER-functie die zelf expliciet
-- `auth_user_id = auth.uid()` opzoekt (NOOIT een door de client meegegeven
-- player-id vertrouwen — geen spoofbare input) omzeilt dat probleem
-- volledig zonder de owner-ALL-policy op game_night_players aan te raken.
--
-- Echte naam (`name`) is BEWUST niet aanpasbaar via deze RPC — sectie 5 van
-- de opdracht vraagt om een risicoanalyse: `name` wordt vandaag op meerdere
-- plekken (spelerslijst, spelerprofiel-header, sorteringen) nog
-- RECHTSTREEKS getoond zonder nickname-fallback, dus zelf-service wijzigen
-- zou daar met terugwerkende kracht verwarrend kunnen doorwerken, en `name`
-- fungeert voor de owner als stabiele identiteitsanker. Nickname is en
-- blijft de primaire displaynaam voor V2 (sectie 7 van de opdracht) — de
-- speler heeft daarmee al volledige zelfexpressie zonder dat risico.
create or replace function public.game_night_update_my_profile(
  p_nickname text,
  p_color_id uuid
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
      color_id = p_color_id
  where id = v_player.id
  returning * into v_player;

  return v_player;
end;
$$;

revoke execute on function public.game_night_update_my_profile(text, uuid)
  from public, anon;
grant execute on function public.game_night_update_my_profile(text, uuid)
  to authenticated;
