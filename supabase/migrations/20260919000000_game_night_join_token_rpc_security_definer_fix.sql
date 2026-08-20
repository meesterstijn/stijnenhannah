-- Game Night — bugfix: de join-QR bleef leeg omdat het genereren van een
-- join-token altijd faalde. Root cause, gevonden bij inspectie van
-- 20260912180000_game_night_join_tokens.sql (bestaande, al uitgevoerde
-- migratie — hier NIET gewijzigd, zie hieronder):
--
-- `public.game_night_generate_join_token` en `public.game_night_
-- revoke_join_token` missen de `security definer`-clausule, terwijl
-- diezelfde migratie's eigen commentaar expliciet zegt dat dat nodig is
-- ("Bewust GEEN insert/update/delete-policy ... dus elke schrijfactie moet
-- via een SECURITY DEFINER-RPC") en `game_night_join_tokens` inderdaad
-- GEEN insert/update-policy heeft voor welke rol dan ook (alleen een
-- owner-only SELECT-policy). Zonder `security definer` draait de RPC met
-- de rechten van de AANROEPER (ook als die owner is) — en zonder
-- insert-policy is RLS-gedrag voor INSERT altijd "geen enkele rij toegestaan",
-- dus de `insert into game_night_join_tokens (...)` in
-- game_night_generate_join_token gooide gegarandeerd
-- "new row violates row-level security policy for table
-- game_night_join_tokens". Die Postgres-fout kwam terug als
-- `generate.isError` in useGenerateJoinToken (useGameNightJoinTokens.ts),
-- maar JoinPartySheet.tsx toonde die fout nergens — het token bleef dus
-- permanent null, `joinUrl` bleef null, en QrCodeDisplay's eigen render-
-- effect (`if (!container || !data) return;`) deed daardoor letterlijk
-- niets: een leeg wit vlak, geen enkele render-/stylingbug in de
-- QR-component zelf.
--
-- `game_night_validate_join_token` (dezelfde migratie, verderop) had dit
-- WEL correct (het is de enige RPC die anon-aanroepbaar moet zijn, dus die
-- kreeg terecht speciale aandacht) — dit bevestigt dat het hier om een
-- vergeten clausule bij de andere twee RPC's gaat, niet om een bewuste
-- architectuurkeuze.
--
-- Fix: uitsluitend `security definer set search_path = ''` toevoegen aan
-- exact dezelfde twee functies, functionaliteit/signature/body ongewijzigd
-- (`create or replace function` met identieke parameterlijst vervangt
-- veilig in-place, geen drop nodig). De reeds uitgevoerde
-- 20260912180000-migratie zelf blijft volledig ongewijzigd — dit is een
-- nieuw, additief bestand.

create or replace function public.game_night_generate_join_token(
  p_game_night_session_id uuid
)
returns public.game_night_join_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.game_night_sessions;
  v_token text;
  v_row public.game_night_join_tokens;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag een join-QR genereren' using errcode = '42501';
  end if;

  select * into v_session
  from public.game_night_sessions
  where id = p_game_night_session_id;

  if not found then
    raise exception 'Game Night % niet gevonden', p_game_night_session_id;
  end if;
  if v_session.status = 'completed' then
    raise exception 'Deze Game Night is al afgesloten' using errcode = '22023';
  end if;

  update public.game_night_join_tokens
  set revoked_at = now()
  where game_night_session_id = p_game_night_session_id
    and revoked_at is null;

  -- 256 bits entropie uit twee gen_random_uuid()-aanroepen (ongewijzigd
  -- t.o.v. 20260912180000).
  v_token := replace(gen_random_uuid()::text, '-', '')
    || replace(gen_random_uuid()::text, '-', '');

  insert into public.game_night_join_tokens (
    game_night_session_id, token, expires_at, created_by
  )
  values (
    p_game_night_session_id, v_token, now() + interval '12 hours', auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.game_night_generate_join_token(uuid) from public, anon;
grant execute on function public.game_night_generate_join_token(uuid) to authenticated;

create or replace function public.game_night_revoke_join_token(
  p_token_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag een join-token intrekken' using errcode = '42501';
  end if;

  update public.game_night_join_tokens
  set revoked_at = now()
  where id = p_token_id and revoked_at is null;
end;
$$;

revoke execute on function public.game_night_revoke_join_token(uuid) from public, anon;
grant execute on function public.game_night_revoke_join_token(uuid) to authenticated;

-- Handmatige controle na het draaien van deze migratie:
--
-- select proname, prosecdef
-- from pg_proc
-- where proname in ('game_night_generate_join_token', 'game_night_revoke_join_token', 'game_night_validate_join_token');
-- -- verwacht: prosecdef = true voor alle drie
--
-- Als owner ingelogd, zelf aanroepen (vervang <sessie-uuid>):
-- select * from game_night_generate_join_token('<sessie-uuid>'::uuid);
-- -- verwacht: één rij terug, geen RLS-foutmelding meer.
