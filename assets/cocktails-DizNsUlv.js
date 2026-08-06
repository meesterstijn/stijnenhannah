import{s as r}from"./index-CkTzXfCH.js";const i="id, name, tagline, backstory, photo_storage_path, is_published, created_by, created_at, updated_at",o=`
  ${i},
  variants:cocktail_variants(
    id, cocktail_id, variant_type, glass_type_id, glass_note, glass_type_id_2, glass_note_2,
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
`;function n(a){return{...a,variants:a.variants.map(t=>({...t,flavour_profile:t.flavour_profile??null,ingredients:t.ingredients.map(e=>({...e,ingredient_name:e.ingredient?.name??""})).sort((e,s)=>e.sort_order-s.sort_order),spirit:t.spirit??null,glass_type:t.glass_type??null,glass_type_2:t.glass_type_2??null,garnish:t.garnish??null}))}}async function l(){const{data:a,error:t}=await r.from("cocktails").select(i).order("name",{ascending:!0});if(t)throw t;return a??[]}async function d(a){const{data:t,error:e}=await r.from("cocktails").select(o).eq("id",a).maybeSingle();if(e)throw e;return t?n(t):null}async function p(){const{data:a,error:t}=await r.from("cocktails").select(o).eq("is_published",!0).order("name",{ascending:!0});if(t)throw t;return(a??[]).map(n)}async function g(a){const{data:t,error:e}=await r.from("cocktails").insert({name:a.name,tagline:a.tagline,backstory:a.backstory,is_published:!1}).select(i).single();if(e)throw e;return t}async function _(a,t){const{error:e}=await r.from("cocktails").update(t).eq("id",a);if(e)throw e}async function f(a,t){await _(a,{is_published:t})}async function u(a){const{error:t}=await r.from("cocktail_orders").delete().eq("cocktail_id",a);if(t)throw t;const{error:e}=await r.from("cocktails").delete().eq("id",a);if(e)throw e}async function h(a){const{data:t,error:e}=await r.rpc("save_cocktail_variant",{p_cocktail_id:a.cocktailId,p_variant_type:a.variantType,p_glass_type_id:a.glassTypeId,p_glass_note:a.glassNote,p_glass_type_id_2:a.glassTypeId2,p_glass_note_2:a.glassNote2,p_spirit_id:a.spiritId,p_garnish_id:a.garnishId,p_abv_percent:a.abvPercent,p_preparation_steps:a.preparationSteps,p_photo_storage_path:a.photoStoragePath,p_sweet_score:a.sweetScore,p_sour_score:a.sourScore,p_bitter_score:a.bitterScore,p_fresh_score:a.freshScore,p_strong_score:a.strongScore,p_ingredients:a.ingredients.map(s=>({ingredient_id:s.ingredientId,amount:s.amount,unit:s.unit,note:s.note,sort_order:s.sortOrder}))});if(e)throw e;return t}function y(a){return a.variants.find(t=>t.variant_type==="alcoholic")??a.variants.find(t=>t.variant_type==="alcoholic_variant")??a.variants.find(t=>t.variant_type==="alcohol_free")??null}export{h as a,d as b,g as c,u as d,p as e,l as f,y as g,f as s,_ as u};
