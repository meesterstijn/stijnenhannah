-- Game Night V2.4 — QR join-tokens. Additief op 20260912170000.
--
-- ── Plaintext vs. hash (sectie 9 van de opdracht — onderzocht) ───────────
-- Het token wordt in PLAINTEKST opgeslagen, bewust: de enige realistische
-- dreiging is "kan iemand anders dan de owner de tabel rechtstreeks
-- uitlezen en zo het token stelen zonder de QR te scannen" — en dat wordt
-- hieronder al volledig afgedekt door RLS (uitsluitend een owner-only
-- SELECT-policy, GEEN insert/update/delete-policy voor wie dan ook: elke
-- schrijfactie loopt uitsluitend via de SECURITY DEFINER-RPC's hieronder,
-- hetzelfde patroon als set_profile_role). Hashen zou alleen extra
-- bescherming bieden tegen een rechtstreekse databasedump/backup-lek — een
-- dreiging die nergens anders in dit project apart wordt afgedekt (geen
-- enkele andere tabel hasht z'n inhoud), dus geen inconsistente
-- uitzondering hier.
--
-- ── Geen aparte "hash-tabel" i.p.v. een echte kolom nodig — het token zelf
-- is al willekeurig/ondoorzichtig (128 bits entropie, zie de generatie-RPC),
-- nooit de sessie-UUID of iets voorspelbaars.

create table public.game_night_join_tokens (
  id uuid primary key default gen_random_uuid(),
  game_night_session_id uuid not null references public.game_night_sessions(id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create unique index game_night_join_tokens_token_idx
  on public.game_night_join_tokens (token);
create index game_night_join_tokens_session_idx
  on public.game_night_join_tokens (game_night_session_id);
-- "Is er nu een geldig token voor deze avond" — de query die de QR-paneel-UI
-- bij het openen doet om te beslissen of hij een bestaand token hergebruikt
-- i.p.v. meteen te regenereren (sectie 10: niet single-use, wel vernieuwbaar).
create index game_night_join_tokens_active_idx
  on public.game_night_join_tokens (game_night_session_id, expires_at)
  where revoked_at is null;

alter table public.game_night_join_tokens enable row level security;

-- Uitsluitend owner mag de tabel rechtstreeks LEZEN (voor de QR-paneel-UI
-- hierboven). Bewust GEEN insert/update/delete-policy — zonder policy voor
-- die commando's is RLS-gedrag "niemand, nooit", dus elke schrijfactie
-- moet via een SECURITY DEFINER-RPC met een expliciete eigen controle.
create policy "game_night_join_tokens: owner select" on public.game_night_join_tokens
  for select to authenticated
  using (private.is_owner());

revoke all on public.game_night_join_tokens from anon;

-- ── Genereren/vernieuwen (owner-only, sectie 10) ──────────────────────────
-- Trekt eerst elk nog geldig token voor deze avond in ("QR vernieuwen maakt
-- oude token ongeldig") en maakt daarna precies één nieuw token — nooit
-- twee tegelijk geldige tokens voor dezelfde Game Night. Multi-use: geen
-- markering na één join, blijft geldig tot expiry/revoke/afsluiten.
create or replace function public.game_night_generate_join_token(
  p_game_night_session_id uuid
)
returns public.game_night_join_tokens
language plpgsql
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

  -- 256 bits entropie uit twee gen_random_uuid()-aanroepen (dezelfde,
  -- altijd-beschikbare bron als elke id in dit project — geen afhankelijkheid
  -- van de pgcrypto-extensie, die niet gegarandeerd aanwezig is).
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

-- Handmatig intrekken (owner sluit de QR, of wil 'm eerder ongeldig maken
-- dan de expiry).
create or replace function public.game_night_revoke_join_token(
  p_token_id uuid
)
returns void
language plpgsql
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

-- ── Publieke validatie (sectie 11) ────────────────────────────────────────
-- De ENE functie die zonder login aanroepbaar is — expliciet gegrant aan
-- `anon`. SECURITY DEFINER zodat hij de tabellen kan lezen ondanks dat anon
-- zelf nul tabelrechten heeft; geeft bewust alleen het strikt minimale
-- terug (geldig/naam/starttijd) — nooit deelnemers, player-ids of stats.
create or replace function public.game_night_validate_join_token(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_row public.game_night_join_tokens;
  v_session public.game_night_sessions;
begin
  select * into v_token_row
  from public.game_night_join_tokens
  where token = p_token;

  if not found or v_token_row.revoked_at is not null or v_token_row.expires_at <= now() then
    return jsonb_build_object('valid', false);
  end if;

  select * into v_session
  from public.game_night_sessions
  where id = v_token_row.game_night_session_id;

  if not found or v_session.status = 'completed' then
    return jsonb_build_object('valid', false);
  end if;

  return jsonb_build_object(
    'valid', true,
    'game_night_name', v_session.name,
    'started_at', v_session.started_at
  );
end;
$$;

revoke execute on function public.game_night_validate_join_token(text) from public;
grant execute on function public.game_night_validate_join_token(text) to anon, authenticated;
