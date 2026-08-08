-- Productmatching v1: alleen exacte, winkel-specifieke aliasmatching +
-- handmatige bevestiging (geen fuzzy/AI-matching, zie functioneel ontwerp).
-- Twee RPC's, beide owner-only, volgens de bestaande security-definer +
-- is_owner()-conventie:
--
-- 1. confirm_receipt_item_match_v1 — de handmatige "koppelen"-actie. Schrijft
--    in één transactie de product/variant-koppeling + matching-metadata op
--    de regel EN de bijbehorende winkel-specifieke alias. Dit moet atomisch
--    omdat een alias zonder bijgewerkte regel (of andersom) een inconsistente
--    staat zou zijn — vandaar een RPC i.p.v. losse Supabase-calls.
-- 2. apply_exact_store_alias_matches_v1 — de automatische matcher, uitgevoerd
--    als losse, best-effort tweede stap na een geslaagde import (nooit
--    andersom: een falende match mag een geslaagde receipt-import nooit
--    ongedaan maken, dat gebeurt hier client-side in receiptsApi.ts/
--    ReceiptImportCard.tsx, niet in deze functie). Werkt UITSLUITEND op nog
--    unmatched productregels van ÉÉN bon — nooit retroactief over eerdere
--    bonnen (dat is expliciet een latere stap).
--
-- Raw-garantie: geen van beide functies wijzigt ooit raw_name of een ander
-- raw_*/regular_*/paid_*-veld — alleen product_id, product_variant_id,
-- matching_status, matching_confidence, match_method op de regel, en de
-- aliastabel.

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

  v_normalized := lower(regexp_replace(trim(v_raw_name), '\s+', ' ', 'g'));

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

revoke execute on function public.confirm_receipt_item_match_v1(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.confirm_receipt_item_match_v1(uuid, uuid, uuid, text) to authenticated;

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
    and a.normalized_alias = lower(regexp_replace(trim(i.raw_name), '\s+', ' ', 'g'));

  get diagnostics v_matched_count = row_count;

  -- Losse tweede stap i.p.v. binnen dezelfde UPDATE: usage_count/last_used_at
  -- bijwerken voor precies de aliases die zojuist een match opleverden. Bij
  -- herhaald aanroepen op dezelfde (al gematchte) bon telt dit onschuldig
  -- opnieuw mee — geen echte bug, want deze functie is bedoeld als eenmalige
  -- stap direct na import, niet als herhaalde batchjob.
  update public.product_aliases a
  set usage_count = usage_count + 1, last_used_at = now()
  from public.shopping_receipt_items i
  where i.receipt_id = p_receipt_id
    and i.matching_status = 'matched_auto'
    and i.match_method = 'exact_store_alias'
    and a.store_id = v_store_id
    and a.normalized_alias = lower(regexp_replace(trim(i.raw_name), '\s+', ' ', 'g'));

  return v_matched_count;
end;
$$;

revoke execute on function public.apply_exact_store_alias_matches_v1(uuid) from public, anon;
grant execute on function public.apply_exact_store_alias_matches_v1(uuid) to authenticated;
