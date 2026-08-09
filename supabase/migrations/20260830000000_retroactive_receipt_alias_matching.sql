-- Retroactieve exacte alias-matching: als een winkel-specifieke alias net
-- handmatig bevestigd is (zie confirm_receipt_item_match_v1), mag de
-- gebruiker EXPLICIET kiezen om diezelfde alias ook toe te passen op andere,
-- nog onbekende regels van dezelfde winkel met exact dezelfde (genormali-
-- seerde) omschrijving. Nooit automatisch, nooit zonder bevestiging.
--
-- Deze migratie wijzigt geen bestaand migratiebestand — de twee reeds
-- uitgevoerde RPC's (confirm_receipt_item_match_v1,
-- apply_exact_store_alias_matches_v1 uit 20260829000000) worden hier alleen
-- met `create or replace function` op hetzelfde signatuur herdefinieerd, om
-- ze op één centrale normalisatiefunctie te laten steunen i.p.v. de
-- trim/lowercase/whitespace-regex drie keer los te dupliceren. Dat is de
-- veiligste manier om "geen tweede afwijkende normalisatie-implementatie" af
-- te dwingen: er is nu maar één plek waar normalisatie gedefinieerd is.

create or replace function private.normalize_receipt_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(trim(p_text), '\s+', ' ', 'g'));
$$;

revoke execute on function private.normalize_receipt_text(text) from public, anon;
grant execute on function private.normalize_receipt_text(text) to authenticated;

-- Herdefinitie van de twee bestaande matching-RPC's, nu via de gedeelde
-- normalisatiefunctie. Gedrag/signatuur ongewijzigd.
create or replace function public.confirm_receipt_item_match_v1(
  p_receipt_item_id uuid,
  p_product_id uuid,
  p_product_variant_id uuid,
  p_match_method text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_raw_name text;
  v_normalized text;
  v_existing record;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag kassabonregels koppelen' using errcode = '42501';
  end if;

  if p_match_method not in ('manual', 'new_product', 'new_variant') then
    raise exception 'Ongeldige match_method: %', p_match_method;
  end if;

  if p_product_variant_id is not null and not exists (
    select 1 from public.product_variants
    where id = p_product_variant_id and product_id = p_product_id
  ) then
    raise exception 'product_variant_id hoort niet bij het opgegeven product_id'
      using errcode = '23514';
  end if;

  select r.store_id, i.raw_name
    into v_store_id, v_raw_name
  from public.shopping_receipt_items i
  join public.shopping_receipts r on r.id = i.receipt_id
  where i.id = p_receipt_item_id;

  if v_raw_name is null then
    raise exception 'Kassabonregel niet gevonden';
  end if;
  if v_store_id is null then
    raise exception 'Winkel van deze kassabon is nog niet gekoppeld — koppel eerst de winkel.';
  end if;

  v_normalized := private.normalize_receipt_text(v_raw_name);

  select * into v_existing
  from public.product_aliases
  where normalized_alias = v_normalized and store_id = v_store_id;

  if found then
    if v_existing.product_id <> p_product_id
       or coalesce(v_existing.product_variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
          <> coalesce(p_product_variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    then
      raise exception 'Deze bonomschrijving is al gekoppeld aan een ander product.'
        using errcode = '23505';
    end if;
    update public.product_aliases
    set usage_count = usage_count + 1, last_used_at = now()
    where id = v_existing.id;
  else
    insert into public.product_aliases (
      raw_alias, normalized_alias, product_id, product_variant_id, store_id, source, usage_count, last_used_at
    ) values (
      v_raw_name, v_normalized, p_product_id, p_product_variant_id, v_store_id, 'user_confirmed', 1, now()
    );
  end if;

  update public.shopping_receipt_items
  set product_id = p_product_id,
      product_variant_id = p_product_variant_id,
      matching_status = 'matched_confirmed',
      matching_confidence = null,
      match_method = p_match_method
  where id = p_receipt_item_id;
end;
$$;

create or replace function public.apply_exact_store_alias_matches_v1(p_receipt_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_matched_count integer := 0;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag matching uitvoeren' using errcode = '42501';
  end if;

  select store_id into v_store_id from public.shopping_receipts where id = p_receipt_id;
  if v_store_id is null then
    return 0;
  end if;

  update public.shopping_receipt_items i
  set product_id = a.product_id,
      product_variant_id = a.product_variant_id,
      matching_status = 'matched_auto',
      matching_confidence = 1.00,
      match_method = 'exact_store_alias'
  from public.product_aliases a
  where i.receipt_id = p_receipt_id
    and i.line_type = 'product'
    and i.matching_status = 'unmatched'
    and a.store_id = v_store_id
    and a.normalized_alias = private.normalize_receipt_text(i.raw_name);

  get diagnostics v_matched_count = row_count;

  update public.product_aliases a
  set usage_count = usage_count + 1, last_used_at = now()
  from public.shopping_receipt_items i
  where i.receipt_id = p_receipt_id
    and i.matching_status = 'matched_auto'
    and i.match_method = 'exact_store_alias'
    and a.store_id = v_store_id
    and a.normalized_alias = private.normalize_receipt_text(i.raw_name);

  return v_matched_count;
end;
$$;

-- ─── Nieuw: retroactieve matching ───────────────────────────────────────
-- Beide functies herleiden store_id/genormaliseerde tekst/product-koppeling
-- ZELF, server-side, uitsluitend uit het al-bevestigde receipt-item
-- (p_receipt_item_id) — nooit uit een door de client meegegeven lijst van
-- regel-id's. Dat is de bescherming tegen stale/gemanipuleerde UI-state:
-- wat er ook tussen "tellen" en "toepassen" gebeurt, apply_historical_*
-- herberekent alles opnieuw op het moment van uitvoeren.

create or replace function public.find_historical_alias_match_count_v1(p_receipt_item_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_normalized text;
  v_product_id uuid;
  v_count integer;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag matching bekijken' using errcode = '42501';
  end if;

  select r.store_id, private.normalize_receipt_text(i.raw_name), i.product_id
    into v_store_id, v_normalized, v_product_id
  from public.shopping_receipt_items i
  join public.shopping_receipts r on r.id = i.receipt_id
  where i.id = p_receipt_item_id;

  if v_store_id is null or v_product_id is null then
    return 0;
  end if;

  select count(*) into v_count
  from public.shopping_receipt_items i
  join public.shopping_receipts r on r.id = i.receipt_id
  where i.id <> p_receipt_item_id
    and i.line_type = 'product'
    and i.matching_status in ('unmatched', 'needs_review')
    and r.store_id = v_store_id
    and private.normalize_receipt_text(i.raw_name) = v_normalized;

  return v_count;
end;
$$;

revoke execute on function public.find_historical_alias_match_count_v1(uuid) from public, anon;
grant execute on function public.find_historical_alias_match_count_v1(uuid) to authenticated;

create or replace function public.apply_historical_alias_matches_v1(p_receipt_item_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_normalized text;
  v_product_id uuid;
  v_product_variant_id uuid;
  v_alias_id uuid;
  v_updated_count integer := 0;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag matching toepassen' using errcode = '42501';
  end if;

  select r.store_id, private.normalize_receipt_text(i.raw_name), i.product_id, i.product_variant_id
    into v_store_id, v_normalized, v_product_id, v_product_variant_id
  from public.shopping_receipt_items i
  join public.shopping_receipts r on r.id = i.receipt_id
  where i.id = p_receipt_item_id;

  if v_store_id is null or v_product_id is null then
    return 0;
  end if;

  -- Alleen toepassen als er daadwerkelijk een bevestigde alias bestaat die
  -- precies deze (winkel, tekst, product, variant)-combinatie vastlegt —
  -- deze functie mag nooit zelf een koppeling "verzinnen" los van een
  -- eerder expliciet bevestigde alias.
  select id into v_alias_id
  from public.product_aliases
  where store_id = v_store_id
    and normalized_alias = v_normalized
    and product_id = v_product_id
    and coalesce(product_variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(v_product_variant_id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_alias_id is null then
    raise exception 'Geen bevestigde alias gevonden voor deze koppeling.';
  end if;

  -- Eén atomaire UPDATE: de WHERE-clausule herbevestigt line_type/status/
  -- store/tekst op het moment van uitvoeren, dus alle geselecteerde regels
  -- slagen samen of geen enkele — en matched_auto/matched_confirmed-regels
  -- worden nooit aangeraakt (matching_status-filter sluit ze uit).
  update public.shopping_receipt_items i
  set product_id = v_product_id,
      product_variant_id = v_product_variant_id,
      matching_status = 'matched_confirmed',
      matching_confidence = null,
      match_method = 'manual'
  from public.shopping_receipts r
  where i.receipt_id = r.id
    and i.id <> p_receipt_item_id
    and i.line_type = 'product'
    and i.matching_status in ('unmatched', 'needs_review')
    and r.store_id = v_store_id
    and private.normalize_receipt_text(i.raw_name) = v_normalized;

  get diagnostics v_updated_count = row_count;

  if v_updated_count > 0 then
    update public.product_aliases
    set usage_count = usage_count + v_updated_count, last_used_at = now()
    where id = v_alias_id;
  end if;

  return v_updated_count;
end;
$$;

revoke execute on function public.apply_historical_alias_matches_v1(uuid) from public, anon;
grant execute on function public.apply_historical_alias_matches_v1(uuid) to authenticated;
