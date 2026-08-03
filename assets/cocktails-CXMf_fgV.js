import{s as e}from"./index-DDmVICQq.js";const i="id, name, tagline, backstory, photo_storage_path, is_published, created_by, created_at, updated_at",s=`
  ${i},
  variants:cocktail_variants(
    id, cocktail_id, variant_type, glass_type_id, spirit_id, garnish_id,
    abv_percent, preparation_steps, photo_storage_path, created_at, updated_at,
    flavour_profile:cocktail_flavour_profiles(variant_id, sweet_score, sour_score, bitter_score, fresh_score, strong_score, updated_at),
    ingredients:cocktail_variant_ingredients(
      id, variant_id, ingredient_id, amount, unit, note, sort_order,
      ingredient:cocktail_ingredients(name)
    ),
    spirit:cocktail_spirits(id, name, sort_order, active),
    glass_type:cocktail_glass_types(id, name, sort_order, active),
    garnish:cocktail_garnishes(id, name, created_at)
  )
`;function o(a){return{...a,variants:a.variants.map(t=>({...t,flavour_profile:t.flavour_profile??null,ingredients:t.ingredients.map(r=>({...r,ingredient_name:r.ingredient?.name??""})).sort((r,n)=>r.sort_order-n.sort_order),spirit:t.spirit??null,glass_type:t.glass_type??null,garnish:t.garnish??null}))}}async function c(){const{data:a,error:t}=await e.from("cocktails").select(i).order("name",{ascending:!0});if(t)throw t;return a??[]}async function l(){const{data:a,error:t}=await e.from("cocktails").select(s).eq("is_published",!0).order("name",{ascending:!0});if(t)throw t;return(a??[]).map(o)}function d(a){return a.variants.find(t=>t.variant_type==="alcoholic")??a.variants.find(t=>t.variant_type==="alcohol_free")??null}export{c as a,l as f,d as g};
