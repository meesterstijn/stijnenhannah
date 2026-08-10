-- Bestaande productkoppeling bewerken v1 — twee nieuwe, owner-only RPC's.
--
-- Waarom NIET confirm_receipt_item_match_v1 hergebruiken (zie 20260829000000/
-- 20260830000000): die functie schrijft ONVOORWAARDELIJK naar product_aliases
-- (insert-of-update) en gooit een exception zodra de bestaande alias al naar
-- iets anders wijst. Voor de bewerkflow moet de gebruiker expliciet kunnen
-- kiezen tussen "alias ook bijwerken" en "alleen deze aankoop aanpassen"
-- (nooit een stille alias-wijziging, nooit een harde crash bij een
-- afwijkende alias) — dat is een fundamenteel ander contract, dus een eigen
-- RPC in plaats van de bestaande functie uit te breiden/overbelasten.
--
-- 1. find_existing_alias_for_receipt_item_v1 — puur lezend: bestaat er een
--    winkel-specifieke alias voor de (raw_name, store_id) van dit regel?
--    De client gebruikt dit om de alias-keuze-UI alleen te tonen als er
--    daadwerkelijk iets te kiezen is (exact hetzelfde patroon als
--    find_historical_alias_match_count_v1 hierboven in de historie).
-- 2. edit_receipt_item_match_v1 — de daadwerkelijke correctie: werkt ALTIJD
--    de kassabonregel bij (product_id/product_variant_id/matching_status=
--    'matched_confirmed'/matching_confidence=null/match_method='manual'),
--    en werkt de bestaande alias ALLEEN bij als p_update_alias = true. Bij
--    p_update_alias = false blijft de alias-rij volledig ongewijzigd — de
--    functie maakt in de bewerkflow ook NOOIT een nieuwe alias aan (dat
--    blijft voorbehouden aan de eerste-koppel-flow via
--    confirm_receipt_item_match_v1); ontbreekt de alias, dan is er simpelweg
--    niets om bij te werken.
--
-- Raw-garantie: geen van beide functies wijzigt ooit raw_name of een ander
-- raw_*/regular_*/paid_*-veld.
--
-- Store-vereiste is BEWUST losser dan bij de eerste-koppel-flow: het
-- bewerken van een productkoppeling mag niet blokkeren op een nog
-- onopgeloste winkel (shopping_receipts.store_id is nullable en wordt niet
-- door elke importstap gevuld, zie de store_id-nullability-analyse uit de
-- vorige stap "Goedkoopste winkel & prijsvergelijking per product") —
-- alleen het optionele alias-onderdeel heeft een winkel nodig, dus dat wordt
-- simpelweg overgeslagen als store_id null is.

create or replace function public.find_existing_alias_for_receipt_item_v1(
  p_receipt_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_normalized text;
  v_exists boolean;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag matching bekijken' using errcode = '42501';
  end if;

  select r.store_id, private.normalize_receipt_text(i.raw_name)
    into v_store_id, v_normalized
  from public.shopping_receipt_items i
  join public.shopping_receipts r on r.id = i.receipt_id
  where i.id = p_receipt_item_id;

  if v_store_id is null or v_normalized is null then
    return false;
  end if;

  select exists (
    select 1 from public.product_aliases
    where normalized_alias = v_normalized and store_id = v_store_id
  ) into v_exists;

  return v_exists;
end;
$$;

revoke execute on function public.find_existing_alias_for_receipt_item_v1(uuid) from public, anon;
grant execute on function public.find_existing_alias_for_receipt_item_v1(uuid) to authenticated;

create or replace function public.edit_receipt_item_match_v1(
  p_receipt_item_id uuid,
  p_product_id uuid,
  p_product_variant_id uuid,
  p_update_alias boolean
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
  v_existing_alias_id uuid;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag kassabonregels bewerken' using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'Kies een product.';
  end if;

  -- Zelfde cross-tabel-integriteitscheck als confirm_receipt_item_match_v1:
  -- een variant van een ANDER product mag nooit gekoppeld worden.
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
  where i.id = p_receipt_item_id
    and i.line_type = 'product';

  if v_raw_name is null then
    raise exception 'Kassabonregel niet gevonden';
  end if;

  -- De kern van de correctie: dit is de enige onvoorwaardelijke wijziging.
  -- raw_name/raw_brand/quantity/weight/regular_*/paid_*/promotion_*/
  -- source_json worden hier nergens aangeraakt.
  update public.shopping_receipt_items
  set product_id = p_product_id,
      product_variant_id = p_product_variant_id,
      matching_status = 'matched_confirmed',
      matching_confidence = null,
      match_method = 'manual'
  where id = p_receipt_item_id;

  if p_update_alias and v_store_id is not null then
    v_normalized := private.normalize_receipt_text(v_raw_name);

    select id into v_existing_alias_id
    from public.product_aliases
    where normalized_alias = v_normalized and store_id = v_store_id;

    if v_existing_alias_id is not null then
      -- Update van de bestaande rij op zijn eigen primary key — de unieke
      -- (normalized_alias, store_id)-sleutel verandert niet, dus dit kan
      -- nooit botsen met de unique index. De bestaande
      -- trg_product_aliases_variant_matches_product-trigger controleert
      -- opnieuw dat product_variant_id bij product_id hoort.
      update public.product_aliases
      set product_id = p_product_id,
          product_variant_id = p_product_variant_id
      where id = v_existing_alias_id;
    end if;
    -- Geen alias gevonden: niets om bij te werken. Deze functie maakt hier
    -- bewust GEEN nieuwe alias aan.
  end if;
end;
$$;

revoke execute on function public.edit_receipt_item_match_v1(uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.edit_receipt_item_match_v1(uuid, uuid, uuid, boolean) to authenticated;
