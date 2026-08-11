-- Veilig product- & variantverwijderen v1 — twee nieuwe, owner-only RPC's.
--
-- WAAROM EEN RPC EN GEEN RECHTSTREEKSE CLIENT-DELETE:
-- geverifieerd tegen 20260827000000_receipt_price_analysis_foundation.sql
-- (niet aangenomen) welke foreign keys een delete daadwerkelijk blokkeren:
--
--   product_variants.product_id  references products(id) on delete restrict
--   product_aliases.product_id   references products(id) on delete restrict
--   product_aliases.product_variant_id
--                                 references product_variants(id) on delete set null
--   shopping_receipt_items.product_id
--                                 references products(id) on delete set null
--   shopping_receipt_items.product_variant_id
--                                 references product_variants(id) on delete set null
--
-- Een kale `delete from products`/`delete from product_variants` zou dus:
--   - een product met varianten of aliases WEL al blokkeren (restrict) —
--     toevallig precies goed voor die twee gevallen;
--   - een product met historische receipt_items NIET blokkeren: de FK is
--     `on delete set null`, dus de rij zou stil verwijderd worden en de
--     historische kassabonregels zouden hun product_id-koppeling stilzwijgend
--     verliezen — exact de "automatische loskoppeling"/dataverlies die
--     expliciet verboden is;
--   - een variant met receipt_items ÓF aliases NOOIT blokkeren (beide zijn
--     `on delete set null` op product_variant_id) — dezelfde stille-
--     dataverlies-fout, nu voor varianten.
-- Een rechtstreekse client-delete is dus voor GEEN van beide objecten
-- veilig genoeg als enige bescherming; deze RPC's herberekenen het gebruik
-- altijd zelf, server-side, op het moment van verwijderen.
--
-- RACE-CONDITION-BESCHERMING: elke delete hieronder is een ENKEL SQL-
-- statement met de "nog steeds ongebruikt"-voorwaarden rechtstreeks in de
-- WHERE-clausule (NOT EXISTS-subqueries), i.p.v. een losse SELECT-count
-- gevolgd door een losse DELETE. Dat sluit de race conditie die de opdracht
-- benoemt structureel uit: Postgres evalueert de WHERE-clausule van één
-- statement atomair, en de foreign-key-constraints hierboven zorgen ervoor
-- dat een gelijktijdig aangemaakte koppeling naar dit object ofwel al
-- zichtbaar is in onze NOT EXISTS-check (delete slaat dan vanzelf over),
-- ofwel pas ná onze delete proberen te committen en dan zelf faalt op de
-- foreign key naar een inmiddels verwijderde rij. Er kan dus nooit een
-- toestand ontstaan waarin zowel de delete slaagt als de nieuwe koppeling
-- bestaat.
--
-- GEEN CASCADE: geen van beide functies zet ooit een receipt-item- of
-- alias-kolom op null, en geen van beide verwijdert ooit gerelateerde rijen
-- automatisch (bv. product -> varianten). Bij gebruik wordt uitsluitend
-- geblokkeerd, nooit stilzwijgend opgeruimd.

create or replace function public.delete_unused_product_variant_v1(
  p_variant_id uuid
)
returns table (
  deleted boolean,
  receipt_item_count integer,
  alias_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count integer;
  v_receipt_item_count integer := 0;
  v_alias_count integer := 0;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag catalogusobjecten verwijderen' using errcode = '42501';
  end if;

  if not exists (select 1 from public.product_variants where id = p_variant_id) then
    raise exception 'Variant niet gevonden' using errcode = 'P0002';
  end if;

  delete from public.product_variants
  where id = p_variant_id
    and not exists (
      select 1 from public.shopping_receipt_items
      where product_variant_id = p_variant_id
    )
    and not exists (
      select 1 from public.product_aliases
      where product_variant_id = p_variant_id
    );

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    select count(*) into v_receipt_item_count
    from public.shopping_receipt_items
    where product_variant_id = p_variant_id;

    select count(*) into v_alias_count
    from public.product_aliases
    where product_variant_id = p_variant_id;

    return query select false, v_receipt_item_count, v_alias_count;
  else
    return query select true, 0, 0;
  end if;
end;
$$;

revoke execute on function public.delete_unused_product_variant_v1(uuid) from public, anon;
grant execute on function public.delete_unused_product_variant_v1(uuid) to authenticated;

create or replace function public.delete_unused_product_v1(
  p_product_id uuid
)
returns table (
  deleted boolean,
  receipt_item_count integer,
  alias_count integer,
  variant_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count integer;
  v_receipt_item_count integer := 0;
  v_alias_count integer := 0;
  v_variant_count integer := 0;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag catalogusobjecten verwijderen' using errcode = '42501';
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Product niet gevonden' using errcode = 'P0002';
  end if;

  -- Geen categorielogica nodig: category_id staat op products zelf en
  -- verdwijnt gewoon mee met de rij, zonder enige aparte opruiming.
  delete from public.products
  where id = p_product_id
    and not exists (
      select 1 from public.shopping_receipt_items
      where product_id = p_product_id
    )
    and not exists (
      select 1 from public.product_aliases
      where product_id = p_product_id
    )
    and not exists (
      select 1 from public.product_variants
      where product_id = p_product_id
    );

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    select count(*) into v_receipt_item_count
    from public.shopping_receipt_items
    where product_id = p_product_id;

    select count(*) into v_alias_count
    from public.product_aliases
    where product_id = p_product_id;

    select count(*) into v_variant_count
    from public.product_variants
    where product_id = p_product_id;

    return query select false, v_receipt_item_count, v_alias_count, v_variant_count;
  else
    return query select true, 0, 0, 0;
  end if;
end;
$$;

revoke execute on function public.delete_unused_product_v1(uuid) from public, anon;
grant execute on function public.delete_unused_product_v1(uuid) to authenticated;
