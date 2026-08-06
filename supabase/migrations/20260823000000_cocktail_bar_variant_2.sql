-- Cocktail Bar — een derde, optioneel variant-slot per cocktail:
-- 'alcoholic_variant' ("Variant" in het detailvenster, naast "Origineel" en
-- "Alcoholvrije variant"). Dit is een volledige tweede alcoholische variant
-- (eigen basisdrank/glas/ABV/ingrediënten/bereiding/smaakprofiel/foto), geen
-- vrije/oneindige lijst — precies zoals alcohol_free al een vast tweede slot
-- was. unique (cocktail_id, variant_type) staat al op de tabel en dekt dit
-- derde type automatisch mee (max. 1 rij per type per cocktail).
alter table public.cocktail_variants drop constraint cocktail_variants_variant_type_check;
alter table public.cocktail_variants add constraint cocktail_variants_variant_type_check
  check (variant_type in ('alcoholic', 'alcohol_free', 'alcoholic_variant'));

-- Alleen alcohol_free mag nooit een basisdrank hebben; beide alcoholische
-- slots (alcoholic/alcoholic_variant) mogen een basisdrank hebben — en sinds
-- 20260821000000 mag die ook (nog) leeg zijn, dus deze regel wordt hier
-- verder vereenvoudigd tot die ene richting.
alter table public.cocktail_variants drop constraint cocktail_variants_spirit_matches_type;
alter table public.cocktail_variants add constraint cocktail_variants_spirit_matches_type
  check (variant_type <> 'alcohol_free' or spirit_id is null);
