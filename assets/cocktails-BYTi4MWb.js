import{s as a}from"./index-BTlQnRQx.js";const s="id, name, tagline, backstory, photo_storage_path, is_published, created_by, created_at, updated_at",o=`
  ${s},
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
`;function n(t){return{...t,variants:t.variants.map(r=>({...r,flavour_profile:r.flavour_profile??null,ingredients:r.ingredients.map(e=>({...e,ingredient_name:e.ingredient?.name??""})).sort((e,i)=>e.sort_order-i.sort_order),spirit:r.spirit??null,glass_type:r.glass_type??null,garnish:r.garnish??null}))}}async function l(){const{data:t,error:r}=await a.from("cocktails").select(s).order("name",{ascending:!0});if(r)throw r;return t??[]}async function d(t){const{data:r,error:e}=await a.from("cocktails").select(o).eq("id",t).maybeSingle();if(e)throw e;return r?n(r):null}async function p(){const{data:t,error:r}=await a.from("cocktails").select(o).eq("is_published",!0).order("name",{ascending:!0});if(r)throw r;return(t??[]).map(n)}async function f(t){const{data:r,error:e}=await a.from("cocktails").insert({name:t.name,tagline:t.tagline,backstory:t.backstory,is_published:!1}).select(s).single();if(e)throw e;return r}async function c(t,r){const{error:e}=await a.from("cocktails").update(r).eq("id",t);if(e)throw e}async function g(t,r){await c(t,{is_published:r})}async function u(t){const{error:r}=await a.from("cocktail_orders").delete().eq("cocktail_id",t);if(r)throw r;const{error:e}=await a.from("cocktails").delete().eq("id",t);if(e)throw e}async function h(t){const{data:r,error:e}=await a.rpc("save_cocktail_variant",{p_cocktail_id:t.cocktailId,p_variant_type:t.variantType,p_glass_type_id:t.glassTypeId,p_spirit_id:t.spiritId,p_garnish_id:t.garnishId,p_abv_percent:t.abvPercent,p_preparation_steps:t.preparationSteps,p_photo_storage_path:t.photoStoragePath,p_sweet_score:t.sweetScore,p_sour_score:t.sourScore,p_bitter_score:t.bitterScore,p_fresh_score:t.freshScore,p_strong_score:t.strongScore,p_ingredients:t.ingredients.map(i=>({ingredient_id:i.ingredientId,amount:i.amount,unit:i.unit,note:i.note,sort_order:i.sortOrder}))});if(e)throw e;return r}function m(t){return t.variants.find(r=>r.variant_type==="alcoholic")??t.variants.find(r=>r.variant_type==="alcohol_free")??null}export{h as a,d as b,f as c,u as d,p as e,l as f,m as g,g as s,c as u};
