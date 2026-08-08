-- Atomische opslag voor kassabon-JSON schema_version 1.0 (bon + regels +
-- btw-regels in één transactie). De bestaande saveReceipt()-flow deed twee
-- losse inserts (bon, dan regels) met een compenserende delete als de
-- tweede faalde (zie oude receiptsApi.ts) — met nu een DERDE tabel
-- (receipt_tax_lines) erbij zou dat compensatiepatroon moeten uitgroeien tot
-- geneste opruimlogica (regels-insert faalt -> bon weg; tax_lines-insert
-- faalt -> regels EN bon weg), met een reëel gat tussen insert en
-- compenserende delete (bv. een afgebroken verbinding) waarin een half
-- geïmporteerde bon kan blijven staan. Eén RPC in een echte transactie sluit
-- dat gat volledig, en volgt exact het bestaande patroon van
-- save_cocktail_variant (20260818030000_cocktail_bar_save_variant_rpc.sql):
-- security definer, expliciete is_owner()-guard, jsonb-arrays voor de
-- sub-rijen.
--
-- BELANGRIJK — raw data blijft leidend: deze functie herschrijft, "verbetert"
-- of herberekent NOOIT een bedrag. Wat de caller als p_items/p_tax_lines
-- meegeeft, wordt letterlijk opgeslagen. Productmatching gebeurt hier niet:
-- product_id/product_variant_id worden altijd null, matching_status altijd
-- 'unmatched' — dat is bewust nog geen onderdeel van deze stap.
--
-- Legacy kolommen (store, total, name, brand, unit_price, line_total,
-- category, discount, unit) worden hier ook gevuld, voor backwards
-- compatibility met code die nog niet is overgezet op de nieuwe kolommen
-- (zie 20260827000000_receipt_price_analysis_foundation.sql).

create or replace function public.save_receipt_v1(
  p_user_id uuid,
  p_store_name text,
  p_branch_name text,
  p_store_number text,
  p_purchase_date date,
  p_purchase_time time,
  p_currency text,
  p_subtotal numeric,
  p_discount_total numeric,
  p_deposit_total numeric,
  p_total_paid numeric,
  p_fingerprint text,
  p_source_json jsonb,
  -- [{ line_type, raw_name, raw_brand, quantity, weight, weight_unit,
  --    regular_unit_price, regular_line_total, discount_amount,
  --    paid_line_total, promotion_type, promotion_text, package_size_hint,
  --    package_unit_hint, hint_category }, ...]
  p_items jsonb,
  -- [{ rate, taxable_amount, tax_amount }, ...]
  p_tax_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt_id uuid;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag kassabonnen importeren' using errcode = '42501';
  end if;

  insert into public.shopping_receipts (
    user_id,
    store, total,
    raw_store_name, raw_branch_name, store_number,
    purchase_date, purchase_time, currency,
    subtotal, discount_total, deposit_total, total_paid,
    fingerprint, source_json
  ) values (
    p_user_id,
    p_store_name, p_total_paid,
    p_store_name, p_branch_name, p_store_number,
    p_purchase_date, p_purchase_time, p_currency,
    p_subtotal, p_discount_total, p_deposit_total, p_total_paid,
    p_fingerprint, p_source_json
  )
  returning id into v_receipt_id;

  insert into public.shopping_receipt_items (
    receipt_id,
    -- legacy kolommen
    name, brand, unit_price, line_total, category, discount, unit,
    -- nieuwe kolommen
    line_type, raw_name, raw_brand, quantity, weight, weight_unit,
    regular_unit_price, regular_line_total, discount_amount, paid_line_total,
    promotion_type, promotion_text, package_size_hint, package_unit_hint,
    product_id, product_variant_id, matching_status, matching_confidence, match_method
  )
  select
    v_receipt_id,
    item->>'raw_name',
    item->>'raw_brand',
    (item->>'regular_unit_price')::numeric,
    (item->>'paid_line_total')::numeric,
    item->>'hint_category',
    (item->>'discount_amount')::numeric,
    item->>'weight_unit',
    item->>'line_type',
    item->>'raw_name',
    item->>'raw_brand',
    (item->>'quantity')::numeric,
    (item->>'weight')::numeric,
    item->>'weight_unit',
    (item->>'regular_unit_price')::numeric,
    (item->>'regular_line_total')::numeric,
    (item->>'discount_amount')::numeric,
    (item->>'paid_line_total')::numeric,
    item->>'promotion_type',
    item->>'promotion_text',
    (item->>'package_size_hint')::numeric,
    item->>'package_unit_hint',
    null, null, 'unmatched', null, null
  from jsonb_array_elements(p_items) as item;

  insert into public.receipt_tax_lines (receipt_id, rate, taxable_amount, tax_amount)
  select
    v_receipt_id,
    (tl->>'rate')::numeric,
    (tl->>'taxable_amount')::numeric,
    (tl->>'tax_amount')::numeric
  from jsonb_array_elements(p_tax_lines) as tl;

  return v_receipt_id;
end;
$$;

revoke execute on function public.save_receipt_v1(
  uuid, text, text, text, date, time, text, numeric, numeric, numeric, numeric, text, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.save_receipt_v1(
  uuid, text, text, text, date, time, text, numeric, numeric, numeric, numeric, text, jsonb, jsonb, jsonb
) to authenticated;
