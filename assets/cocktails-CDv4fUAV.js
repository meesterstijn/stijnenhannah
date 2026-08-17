import{s as r}from"./index-CmrHNj62.js";const i="id, name, tagline, backstory, photo_storage_path, is_published, created_by, created_at, updated_at",o=`
  ${i},
  variants:cocktail_variants(
    id, cocktail_id, variant_type, glass_type_id, glass_note, glass_type_id_2, glass_note_2,
    shake_with_ice, dry_shake_first, build_in_glass,
    spirit_id, garnish_id,
    abv_percent, preparation_steps, photo_storage_path, created_at, updated_at,
    flavour_profile:cocktail_flavour_profiles(variant_id, sweet_score, sour_score, bitter_score, fresh_score, strong_score, updated_at),
    ingredients:cocktail_variant_ingredients(
      id, variant_id, ingredient_id, amount, unit, note, sort_order,
      ingredient:cocktail_ingredients(name)
    ),
    spirit:cocktail_spirits(id, name, sort_order, active),
    glass_type:cocktail_glass_types!cocktail_variants_glass_type_id_fkey(id, name, sort_order, active),
    glass_type_2:cocktail_glass_types!cocktail_variants_glass_type_id_2_fkey(id, name, sort_order, active),
    garnish:cocktail_garnishes(id, name, created_at)
  )
`;function _(a){return{...a,variants:a.variants.map(e=>({...e,flavour_profile:e.flavour_profile??null,ingredients:e.ingredients.map(t=>({...t,ingredient_name:t.ingredient?.name??""})).sort((t,s)=>t.sort_order-s.sort_order),spirit:e.spirit??null,glass_type:e.glass_type??null,glass_type_2:e.glass_type_2??null,garnish:e.garnish??null}))}}async function l(){const{data:a,error:e}=await r.from("cocktails").select(i).order("name",{ascending:!0});if(e)throw e;return a??[]}async function d(a){const{data:e,error:t}=await r.from("cocktails").select(o).eq("id",a).maybeSingle();if(t)throw t;return e?_(e):null}async function p(){const{data:a,error:e}=await r.from("cocktails").select(o).eq("is_published",!0).order("name",{ascending:!0});if(e)throw e;return(a??[]).map(_)}async function g(a){const{data:e,error:t}=await r.from("cocktails").insert({name:a.name,tagline:a.tagline,backstory:a.backstory,is_published:!1}).select(i).single();if(t)throw t;return e}async function n(a,e){const{error:t}=await r.from("cocktails").update(e).eq("id",a);if(t)throw t}async function f(a,e){await n(a,{is_published:e})}async function h(a){const{error:e}=await r.from("cocktail_orders").delete().eq("cocktail_id",a);if(e)throw e;const{error:t}=await r.from("cocktails").delete().eq("id",a);if(t)throw t}async function y(a){const{data:e,error:t}=await r.rpc("save_cocktail_variant",{p_cocktail_id:a.cocktailId,p_variant_type:a.variantType,p_glass_type_id:a.glassTypeId,p_glass_note:a.glassNote,p_glass_type_id_2:a.glassTypeId2,p_glass_note_2:a.glassNote2,p_shake_with_ice:a.shakeWithIce,p_dry_shake_first:a.dryShakeFirst,p_build_in_glass:a.buildInGlass,p_spirit_id:a.spiritId,p_garnish_id:a.garnishId,p_abv_percent:a.abvPercent,p_preparation_steps:a.preparationSteps,p_photo_storage_path:a.photoStoragePath,p_sweet_score:a.sweetScore,p_sour_score:a.sourScore,p_bitter_score:a.bitterScore,p_fresh_score:a.freshScore,p_strong_score:a.strongScore,p_ingredients:a.ingredients.map(s=>({ingredient_id:s.ingredientId,amount:s.amount,unit:s.unit,note:s.note,sort_order:s.sortOrder}))});if(t)throw t;return e}function k(a){return a.variants.find(e=>e.variant_type==="alcoholic")??a.variants.find(e=>e.variant_type==="alcoholic_variant")??a.variants.find(e=>e.variant_type==="alcohol_free")??null}export{y as a,d as b,g as c,h as d,p as e,l as f,k as g,f as s,n as u};
