-- Cocktail Bar — testdata: 3 cocktails, elk met een echte alcoholische én
-- alcoholvrije variant (eigen ingrediënten/bereiding/ABV/scores, gedeelde
-- naam/tagline/verhaal/foto op de cocktails-rij — zie 20260818020000).
-- Cocktails/variants gebruiken vaste uuid's zodat dit bestand veilig opnieuw
-- gedraaid kan worden (on conflict do nothing); ingrediënten/garnering zijn
-- organisch groeiende catalogi en worden op naam opgezocht.

insert into public.cocktail_ingredients (name, default_unit) values
  ('Witte rum', 'ml'),
  ('Verse munt', 'blaadjes'),
  ('Limoensap', 'ml'),
  ('Rietsuiker', 'tl'),
  ('Sodawater', 'ml'),
  ('IJsblokjes', 'g'),
  ('Suikersiroop', 'ml'),
  ('Vodka', 'ml'),
  ('Koffielikeur', 'ml'),
  ('Verse espresso', 'ml'),
  ('Sterke koude espresso', 'ml'),
  ('Kokosroom', 'ml'),
  ('Bourbon whisky', 'ml'),
  ('Rietsuikerklontje', 'stuk'),
  -- Standaard Angostura bitters bevat technisch gezien sporen alcohol
  -- (~44,7% bij 2 dashes ≈ 0,6ml) — de alcoholvrije variant hieronder
  -- gebruikt daarom bewust het breed verkrijgbare alcoholvrije alternatief,
  -- niet "gewone" Angostura met een asterisk.
  ('Angostura bitters', 'dash'),
  ('Alcoholvrije bitters', 'dash'),
  ('Water', 'ml'),
  ('IJsblok', 'stuk'),
  ('Alcoholvrij whisky-alternatief', 'ml')
on conflict (lower(name)) do nothing;

insert into public.cocktail_garnishes (name) values
  ('Muntblaadje en limoenschijfje'),
  ('Koffiebonen (3 stuks)'),
  ('Sinaasappelschil')
on conflict (lower(name)) do nothing;

insert into public.cocktails (id, name, tagline, backstory, is_published) values
  ('c0000000-0000-4000-8000-000000000001', 'Mojito',
   'Fris, kruidig en verfrissend — witte rum met munt, limoen en een vleugje suiker.',
   'De Mojito komt oorspronkelijk uit Cuba en werd populair in de bars van Havana, waar rietsuiker en verse munt letterlijk voor het oprapen lagen.',
   true),
  ('c0000000-0000-4000-8000-000000000002', 'Espresso Martini',
   'Romig, sterk en licht bitter — vodka, koffielikeur en verse espresso, geschud tot een goudbruine schuimlaag.',
   'Bedacht in Londen in de jaren 80 toen een gast aan de bar vroeg om iets dat haar "wakker zou maken, en dan dronken" — en dat is precies wat deze cocktail doet.',
   true),
  ('c0000000-0000-4000-8000-000000000003', 'Old Fashioned',
   'Puur en stoer — bourbon whisky, een klontje suiker en Angostura bitters, kort geroerd over ijs.',
   'Een van de oudste cocktails die we kennen: whisky, suiker, bitters en water — verder niets, en dat is precies het punt.',
   true)
on conflict (id) do nothing;

insert into public.cocktail_variants (
  id, cocktail_id, variant_type, glass_type_id, spirit_id, garnish_id, abv_percent, preparation_steps
) values
  ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'alcoholic',
   'highball', 'rum',
   (select id from public.cocktail_garnishes where lower(name) = lower('Muntblaadje en limoenschijfje')),
   12.5,
   'Kneed de munt losjes met de rietsuiker en limoensap in het glas. Vul met ijsblokjes, voeg de rum toe en top af met sodawater. Roer kort.'),
  ('c1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'alcohol_free',
   'highball', null,
   (select id from public.cocktail_garnishes where lower(name) = lower('Muntblaadje en limoenschijfje')),
   0,
   'Kneed de munt losjes met de rietsuiker en limoensap in het glas. Vul met ijsblokjes, voeg de suikersiroop toe en top af met sodawater. Roer kort.'),
  ('c1000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'alcoholic',
   'coupe', 'vodka',
   (select id from public.cocktail_garnishes where lower(name) = lower('Koffiebonen (3 stuks)')),
   18,
   'Schud vodka, koffielikeur en verse espresso krachtig met veel ijs tot een dikke schuimlaag ontstaat. Dubbel zeven in een gekoeld coupeglas.'),
  ('c1000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'alcohol_free',
   'coupe', null,
   (select id from public.cocktail_garnishes where lower(name) = lower('Koffiebonen (3 stuks)')),
   0,
   'Schud de koude espresso, suikersiroop en kokosroom krachtig met veel ijs tot een dikke schuimlaag ontstaat. Dubbel zeven in een gekoeld coupeglas.'),
  ('c1000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003', 'alcoholic',
   'rocks', 'whisky',
   (select id from public.cocktail_garnishes where lower(name) = lower('Sinaasappelschil')),
   32,
   'Laat het suikerklontje met de bitters en water oplossen op de bodem van het glas. Vul met ijs, voeg de bourbon toe en roer kort. Garneer met sinaasappelschil.'),
  ('c1000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000003', 'alcohol_free',
   'rocks', null,
   (select id from public.cocktail_garnishes where lower(name) = lower('Sinaasappelschil')),
   0,
   'Laat het suikerklontje met de alcoholvrije bitters en water oplossen op de bodem van het glas. Vul met ijs, voeg het alcoholvrije whisky-alternatief toe en roer kort. Garneer met sinaasappelschil.')
on conflict (id) do nothing;

insert into public.cocktail_flavour_profiles (variant_id, sweet_score, sour_score, bitter_score, fresh_score, strong_score) values
  ('c1000000-0000-4000-8000-000000000001', 3, 4, 0, 5, 2),
  ('c1000000-0000-4000-8000-000000000002', 4, 4, 0, 5, 0),
  ('c1000000-0000-4000-8000-000000000003', 3, 1, 3, 1, 4),
  ('c1000000-0000-4000-8000-000000000004', 4, 0, 2, 1, 0),
  ('c1000000-0000-4000-8000-000000000005', 2, 0, 3, 0, 5),
  ('c1000000-0000-4000-8000-000000000006', 2, 0, 3, 0, 1)
on conflict (variant_id) do nothing;

insert into public.cocktail_variant_ingredients (variant_id, ingredient_id, amount, unit, sort_order)
select v.variant_id, i.id, v.amount, v.unit, v.sort_order
from (values
  -- Mojito (alcoholic)
  ('c1000000-0000-4000-8000-000000000001'::uuid, 'Witte rum', 50, 'ml', 1),
  ('c1000000-0000-4000-8000-000000000001'::uuid, 'Verse munt', 8, 'blaadjes', 2),
  ('c1000000-0000-4000-8000-000000000001'::uuid, 'Limoensap', 15, 'ml', 3),
  ('c1000000-0000-4000-8000-000000000001'::uuid, 'Rietsuiker', 2, 'tl', 4),
  ('c1000000-0000-4000-8000-000000000001'::uuid, 'Sodawater', 90, 'ml', 5),
  ('c1000000-0000-4000-8000-000000000001'::uuid, 'IJsblokjes', 150, 'g', 6),
  -- Virgin Mojito (alcohol_free)
  ('c1000000-0000-4000-8000-000000000002'::uuid, 'Verse munt', 8, 'blaadjes', 1),
  ('c1000000-0000-4000-8000-000000000002'::uuid, 'Limoensap', 15, 'ml', 2),
  ('c1000000-0000-4000-8000-000000000002'::uuid, 'Rietsuiker', 2, 'tl', 3),
  ('c1000000-0000-4000-8000-000000000002'::uuid, 'Sodawater', 120, 'ml', 4),
  ('c1000000-0000-4000-8000-000000000002'::uuid, 'Suikersiroop', 10, 'ml', 5),
  ('c1000000-0000-4000-8000-000000000002'::uuid, 'IJsblokjes', 150, 'g', 6),
  -- Espresso Martini (alcoholic)
  ('c1000000-0000-4000-8000-000000000003'::uuid, 'Vodka', 50, 'ml', 1),
  ('c1000000-0000-4000-8000-000000000003'::uuid, 'Koffielikeur', 30, 'ml', 2),
  ('c1000000-0000-4000-8000-000000000003'::uuid, 'Verse espresso', 30, 'ml', 3),
  ('c1000000-0000-4000-8000-000000000003'::uuid, 'IJsblokjes', 200, 'g', 4),
  -- Cold Brew Mocktail (alcohol_free)
  ('c1000000-0000-4000-8000-000000000004'::uuid, 'Sterke koude espresso', 70, 'ml', 1),
  ('c1000000-0000-4000-8000-000000000004'::uuid, 'Suikersiroop', 20, 'ml', 2),
  ('c1000000-0000-4000-8000-000000000004'::uuid, 'Kokosroom', 20, 'ml', 3),
  ('c1000000-0000-4000-8000-000000000004'::uuid, 'IJsblokjes', 200, 'g', 4),
  -- Old Fashioned (alcoholic)
  ('c1000000-0000-4000-8000-000000000005'::uuid, 'Bourbon whisky', 60, 'ml', 1),
  ('c1000000-0000-4000-8000-000000000005'::uuid, 'Rietsuikerklontje', 1, 'stuk', 2),
  ('c1000000-0000-4000-8000-000000000005'::uuid, 'Angostura bitters', 2, 'dash', 3),
  ('c1000000-0000-4000-8000-000000000005'::uuid, 'Water', 5, 'ml', 4),
  ('c1000000-0000-4000-8000-000000000005'::uuid, 'IJsblok', 1, 'stuk', 5),
  -- Old Fashioned Zero (alcohol_free)
  ('c1000000-0000-4000-8000-000000000006'::uuid, 'Alcoholvrij whisky-alternatief', 60, 'ml', 1),
  ('c1000000-0000-4000-8000-000000000006'::uuid, 'Rietsuikerklontje', 1, 'stuk', 2),
  ('c1000000-0000-4000-8000-000000000006'::uuid, 'Alcoholvrije bitters', 2, 'dash', 3),
  ('c1000000-0000-4000-8000-000000000006'::uuid, 'Water', 5, 'ml', 4),
  ('c1000000-0000-4000-8000-000000000006'::uuid, 'IJsblok', 1, 'stuk', 5)
) as v(variant_id, ingredient_name, amount, unit, sort_order)
join public.cocktail_ingredients i on lower(i.name) = lower(v.ingredient_name)
on conflict (variant_id, ingredient_id) do nothing;
