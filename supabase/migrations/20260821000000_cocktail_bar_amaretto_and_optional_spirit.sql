-- Cocktail Bar — nieuwe basisdrank Amaretto, en de basisdrank van een
-- alcoholische variant mag voortaan leeg blijven ("later toevoegen").
-- cocktail_variants_spirit_matches_type verplichtte tot nu toe een spirit_id
-- voor elke alcoholische variant; de owner wil een nieuwe cocktail kunnen
-- aanmaken en later pas de basisdrank kiezen (bv. als de gewenste drank nog
-- niet in de catalogus staat). Een alcoholvrije variant mag nog steeds NOOIT
-- een spirit_id hebben — die kant van de regel blijft gehandhaafd.
insert into public.cocktail_spirits (id, name, sort_order) values
  ('amaretto', 'Amaretto', 6);

alter table public.cocktail_variants drop constraint cocktail_variants_spirit_matches_type;
alter table public.cocktail_variants add constraint cocktail_variants_spirit_matches_type
  check (variant_type = 'alcoholic' or spirit_id is null);
