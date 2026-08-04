import{s as i}from"./index-DceXsfBV.js";const s="id, name, tagline, backstory, photo_storage_path, is_published, created_by, created_at, updated_at",o=`
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
`;function n(e){return{...e,variants:e.variants.map(t=>({...t,flavour_profile:t.flavour_profile??null,ingredients:t.ingredients.map(a=>({...a,ingredient_name:a.ingredient?.name??""})).sort((a,r)=>a.sort_order-r.sort_order),spirit:t.spirit??null,glass_type:t.glass_type??null,garnish:t.garnish??null}))}}async function l(){const{data:e,error:t}=await i.from("cocktails").select(s).order("name",{ascending:!0});if(t)throw t;return e??[]}async function d(e){const{data:t,error:a}=await i.from("cocktails").select(o).eq("id",e).maybeSingle();if(a)throw a;return t?n(t):null}async function p(){const{data:e,error:t}=await i.from("cocktails").select(o).eq("is_published",!0).order("name",{ascending:!0});if(t)throw t;return(e??[]).map(n)}async function f(e){const{data:t,error:a}=await i.from("cocktails").insert({name:e.name,tagline:e.tagline,backstory:e.backstory,is_published:!1}).select(s).single();if(a)throw a;return t}async function c(e,t){const{error:a}=await i.from("cocktails").update(t).eq("id",e);if(a)throw a}async function g(e,t){await c(e,{is_published:t})}async function u(e){const{error:t}=await i.from("cocktails").delete().eq("id",e);if(t)throw t.code==="23503"?new Error("Deze cocktail is al besteld of heeft nog gekoppelde gegevens en kan niet verwijderd worden. Zet 'm op concept in plaats daarvan."):t}async function h(e){const{data:t,error:a}=await i.rpc("save_cocktail_variant",{p_cocktail_id:e.cocktailId,p_variant_type:e.variantType,p_glass_type_id:e.glassTypeId,p_spirit_id:e.spiritId,p_garnish_id:e.garnishId,p_abv_percent:e.abvPercent,p_preparation_steps:e.preparationSteps,p_photo_storage_path:e.photoStoragePath,p_sweet_score:e.sweetScore,p_sour_score:e.sourScore,p_bitter_score:e.bitterScore,p_fresh_score:e.freshScore,p_strong_score:e.strongScore,p_ingredients:e.ingredients.map(r=>({ingredient_id:r.ingredientId,amount:r.amount,unit:r.unit,note:r.note,sort_order:r.sortOrder}))});if(a)throw a;return t}function k(e){return e.variants.find(t=>t.variant_type==="alcoholic")??e.variants.find(t=>t.variant_type==="alcohol_free")??null}export{h as a,d as b,f as c,u as d,p as e,l as f,k as g,g as s,c as u};
