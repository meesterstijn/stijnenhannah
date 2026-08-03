-- Cocktail Bar — atomaire opslag van één variant + zijn 1:1 smaakprofiel +
-- volledige ingrediëntenlijst. De wizard stuurt bij elke opslag altijd de
-- COMPLETE actuele ingrediëntenlijst mee, dus delete-then-insert is hier
-- simpeler en veiliger dan diffen voor zo'n kleine lijst per variant.
create or replace function public.save_cocktail_variant(
  p_cocktail_id uuid,
  p_variant_type text,
  p_glass_type_id text,
  p_spirit_id text,
  p_garnish_id uuid,
  p_abv_percent numeric,
  p_preparation_steps text,
  p_photo_storage_path text default null,
  p_sweet_score smallint default 0,
  p_sour_score smallint default 0,
  p_bitter_score smallint default 0,
  p_fresh_score smallint default 0,
  p_strong_score smallint default 0,
  -- [{ "ingredient_id": "...", "amount": 50, "unit": "ml", "note": null, "sort_order": 0 }, ...]
  p_ingredients jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant_id uuid;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag cocktails beheren' using errcode = '42501';
  end if;

  insert into public.cocktail_variants (
    cocktail_id, variant_type, glass_type_id, spirit_id, garnish_id,
    abv_percent, preparation_steps, photo_storage_path
  ) values (
    p_cocktail_id, p_variant_type, p_glass_type_id, p_spirit_id, p_garnish_id,
    p_abv_percent, p_preparation_steps, p_photo_storage_path
  )
  on conflict (cocktail_id, variant_type) do update set
    glass_type_id = excluded.glass_type_id,
    spirit_id = excluded.spirit_id,
    garnish_id = excluded.garnish_id,
    abv_percent = excluded.abv_percent,
    preparation_steps = excluded.preparation_steps,
    photo_storage_path = excluded.photo_storage_path
  returning id into v_variant_id;

  insert into public.cocktail_flavour_profiles (
    variant_id, sweet_score, sour_score, bitter_score, fresh_score, strong_score
  ) values (
    v_variant_id, p_sweet_score, p_sour_score, p_bitter_score, p_fresh_score, p_strong_score
  )
  on conflict (variant_id) do update set
    sweet_score = excluded.sweet_score,
    sour_score = excluded.sour_score,
    bitter_score = excluded.bitter_score,
    fresh_score = excluded.fresh_score,
    strong_score = excluded.strong_score;

  delete from public.cocktail_variant_ingredients where variant_id = v_variant_id;
  insert into public.cocktail_variant_ingredients (variant_id, ingredient_id, amount, unit, note, sort_order)
  select
    v_variant_id,
    (item->>'ingredient_id')::uuid,
    (item->>'amount')::numeric,
    item->>'unit',
    item->>'note',
    coalesce((item->>'sort_order')::integer, 0)
  from jsonb_array_elements(p_ingredients) as item;

  return v_variant_id;
end;
$$;

revoke execute on function public.save_cocktail_variant(
  uuid, text, text, text, uuid, numeric, text, text, smallint, smallint, smallint, smallint, smallint, jsonb
) from public, anon;
grant execute on function public.save_cocktail_variant(
  uuid, text, text, text, uuid, numeric, text, text, smallint, smallint, smallint, smallint, smallint, jsonb
) to authenticated;
