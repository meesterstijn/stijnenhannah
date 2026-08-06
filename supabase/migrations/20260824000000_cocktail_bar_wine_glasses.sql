-- Cocktail Bar — drie nieuwe glastypes: Wijnglas, Groot wijnglas, Klein
-- wijnglas. sort_order vervolgt de bestaande reeks (na 'copper-mug', 6).
insert into public.cocktail_glass_types (id, name, sort_order) values
  ('wine', 'Wijnglas', 7),
  ('wine-large', 'Groot wijnglas', 8),
  ('wine-small', 'Klein wijnglas', 9);
