-- Game Night V2.4 — de join/provisioning-RPC zelf, in een eigen bestand
-- (sectie 39 van de opdracht: "aparte signup/provisioning-migratie als
-- security-review daar baat bij heeft") — dit is de enige plek waar een
-- authenticated (niet noodzakelijk owner) account zichzelf een rol/speler/
-- tafelplek kan toekennen, dus verdient een geïsoleerd, makkelijk te
-- reviewen bestand.
--
-- ── CORRECTIE (vóór eerste uitvoering, na review) ─────────────────────────
-- Twee dingen zijn hier aangepast t.o.v. de eerste versie:
--
-- 1. Het "r6_player-tussenstap"-risico uit de eerste versie (een gloednieuw
--    account had tot deze RPC draaide technisch even echte R6-rechten,
--    via de site-brede default) is nu STRUCTUREEL gesloten, niet alleen
--    "praktisch onexploiteerbaar" — zie 20260912165000_auth_default_no_access.sql,
--    die de default voor ELK nieuw account naar 'no_access' zet. Een
--    gloednieuw account heeft vanaf nu op geen enkel moment enige
--    featuretoegang totdat deze RPC (of een owneractie) 'm expliciet
--    toekent.
--
-- 2. Nieuwe parameter `p_confirm_role_replacement` (single-role,
--    sectie 3/4/32): joinen via een geldig token kent het account de rol
--    'game_night_member' toe, BEHALVE als het al 'owner' is (nooit
--    gedegradeerd). Voor 'no_access' en 'game_night_member' zelf gebeurt
--    dat altijd (dat IS het punt van joinen/reactiveren). Maar een account
--    dat al 'r6_player'/'cocktail_guest' was, verliest die rol pas na
--    EXPLICIETE bevestiging — de RPC weigert nu server-side als die
--    bevestiging ontbreekt, dit is niet langer alleen een UI-waarschuwing.
--    De frontend (GameNightJoin.tsx) toont eerst de waarschuwing en roept
--    deze RPC pas met `p_confirm_role_replacement = true` aan nadat de
--    gebruiker bewust op "Doorgaan" heeft getikt.

create or replace function public.game_night_join_via_token(
  p_token text,
  p_new_player_name text default null,
  p_new_player_nickname text default null,
  p_new_player_color_id uuid default null,
  p_confirm_role_replacement boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_row public.game_night_join_tokens;
  v_session public.game_night_sessions;
  v_caller_role text;
  v_player public.game_night_players;
  v_nickname text;
  v_next_seat integer;
begin
  if auth.uid() is null then
    raise exception 'Inloggen vereist' using errcode = '42501';
  end if;

  -- Token/sessie opnieuw volledig valideren — nooit vertrouwen op een
  -- eerdere game_night_validate_join_token-aanroep, state kan sindsdien
  -- gewijzigd zijn. Rijlocks voorkomen races met een gelijktijdige
  -- QR-vernieuwing of party-mutatie.
  select * into v_token_row
  from public.game_night_join_tokens
  where token = p_token
  for update;

  if not found or v_token_row.revoked_at is not null or v_token_row.expires_at <= now() then
    raise exception 'Deze uitnodiging is niet meer geldig' using errcode = '22023';
  end if;

  select * into v_session
  from public.game_night_sessions
  where id = v_token_row.game_night_session_id
  for update;

  if not found or v_session.status = 'completed' then
    raise exception 'Deze Game Night is niet meer actief' using errcode = '22023';
  end if;

  -- Sectie 25: geen mid-game party-wijzigingen — inclusief nieuwe joins.
  if exists (
    select 1 from public.game_night_game_sessions
    where game_night_session_id = v_session.id and status <> 'completed'
  ) then
    raise exception 'Er wordt nu gespeeld — probeer het zo weer' using errcode = '22023';
  end if;

  select app_role into v_caller_role
  from public.profiles
  where id = auth.uid();

  if v_caller_role is null then
    raise exception 'Geen profiel gevonden voor dit account' using errcode = '22023';
  end if;

  -- Server-side confirm-gate (correctie punt 6): alleen r6_player/
  -- cocktail_guest hebben al een ECHTE, betekenisvolle rol om te
  -- verliezen — no_access/game_night_member/owner hebben deze gate niet
  -- nodig (reactiveren/idempotent/nooit gedegradeerd).
  if v_caller_role in ('r6_player', 'cocktail_guest') and not p_confirm_role_replacement then
    raise exception 'Dit account heeft al een andere rol — bevestig expliciet om door te gaan'
      using errcode = '22023';
  end if;

  -- Rol toekennen/reactiveren (sectie 14/31/32) — nooit owner degraderen.
  -- Werkt voor gloednieuwe accounts (nu altijd no_access, zie hierboven),
  -- eerder ontkoppelde accounts (no_access via V2.3-unlink), en — na de
  -- confirm-gate hierboven — ook voor bestaande r6_player/cocktail_guest.
  if v_caller_role <> 'owner' and v_caller_role <> 'game_night_member' then
    update public.profiles
    set app_role = 'game_night_member'
    where id = auth.uid();
  end if;

  -- Bestaande gekoppelde speler zoeken; anders een nieuwe aanmaken. Een
  -- eerder ontkoppeld (V2.3 unlink) account heeft GEEN gekoppelde speler
  -- meer (auth_user_id stond op null) — dat account krijgt hier dus bewust
  -- een NIEUW spelersprofiel, nooit een gok welke oude, losgekoppelde
  -- speler "waarschijnlijk" van hem was (sectie 16: geen stille name-match).
  -- De owner kan achteraf via de bestaande V2.3 koppel-UI zelf een keuze
  -- maken als hij de oude historielijn liever wil herstellen.
  select * into v_player
  from public.game_night_players
  where auth_user_id = auth.uid();

  if not found then
    if p_new_player_name is null or trim(p_new_player_name) = '' then
      raise exception 'Naam is verplicht voor een nieuw profiel' using errcode = '22023';
    end if;
    if length(trim(p_new_player_name)) > 60 then
      raise exception 'Naam is te lang (maximaal 60 tekens)' using errcode = '22023';
    end if;

    v_nickname := coalesce(nullif(trim(p_new_player_nickname), ''), trim(p_new_player_name));
    if length(v_nickname) > 40 then
      raise exception 'Nickname is te lang (maximaal 40 tekens)' using errcode = '22023';
    end if;

    if p_new_player_color_id is not null and not exists (
      select 1 from public.game_night_color_palette
      where id = p_new_player_color_id and active = true
    ) then
      raise exception 'Ongeldige of niet-actieve kleur' using errcode = '22023';
    end if;

    insert into public.game_night_players (name, nickname, color_id, auth_user_id)
    values (trim(p_new_player_name), v_nickname, p_new_player_color_id, auth.uid())
    returning * into v_player;
  end if;

  -- Aan de party toevoegen/reactiveren — idempotent (sectie 17/34):
  -- dezelfde speler die vandaag al eerder joinde/eruit gesleept is krijgt
  -- gewoon dezelfde rij terug, geen tweede attendance-rij, geen dubbele
  -- join. seat_index-toewijzing race-vrij dankzij de rijlock op v_session
  -- hierboven (en structureel geborgd door de partial unique index in
  -- 20260912170000).
  select coalesce(max(seat_index), -1) + 1 into v_next_seat
  from public.game_night_session_players
  where session_id = v_session.id and active_at_table = true;

  insert into public.game_night_session_players (
    session_id, player_id, active_at_table, source, seat_index
  )
  values (v_session.id, v_player.id, true, 'qr_join', v_next_seat)
  on conflict (session_id, player_id) do update
    set active_at_table = true,
        left_at = null,
        source = 'qr_join',
        seat_index = v_next_seat;

  return jsonb_build_object(
    'player_id', v_player.id,
    'name', v_player.name,
    'nickname', v_player.nickname,
    'game_night_session_id', v_session.id,
    'game_night_name', v_session.name
  );
end;
$$;

revoke execute on function public.game_night_join_via_token(text, text, text, uuid, boolean)
  from public, anon;
grant execute on function public.game_night_join_via_token(text, text, text, uuid, boolean)
  to authenticated;

-- ── Kleurpalet zichtbaar tijdens signup, vóór provisioning ────────────────
-- De bestaande V2.3-policy "game_night_color_palette: member select active"
-- vereist private.is_game_night_member_or_owner() — een gloednieuw account
-- staat op dat moment op 'no_access' (zie 20260912165000; vóór die
-- correctie was dat 'r6_player', de reden waarom deze aanvullende policy
-- er sowieso al moest komen), dus zou de kleurkeuze in het signup-
-- formulier leeg zien. Kleuren zijn geen gevoelige data (alleen hex +
-- label) — deze aanvullende, bredere policy (voegt toe, vervangt niets —
-- RLS-policies zijn OR'd) maakt actieve kleuren zichtbaar voor ELK
-- authenticated account, ongeacht rol, precies genoeg om het signup-
-- formulier te laten werken. Geen bredere toegang tot spelers of andere
-- Game Night-data — uitsluitend deze ene tabel, uitsluitend `active`-rijen.
create policy "game_night_color_palette: any authenticated select active"
  on public.game_night_color_palette
  for select to authenticated
  using (active);
