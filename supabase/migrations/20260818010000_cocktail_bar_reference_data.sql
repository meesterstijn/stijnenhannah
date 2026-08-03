-- Cocktail Bar — catalogustabellen (basisdrank/glas/garnering/ingrediënt).
-- text-slug PK's voor de kleine, stabiele catalogi (mirrort r6_maps/r6_operators),
-- uuid PK + CI-unique naam voor de organisch groeiende catalogi (mirrort r6_players).
-- "Alcoholvrij" is BEWUST geen rij hier — dat wordt afgeleid uit
-- cocktail_variants.variant_type (zie 20260818020000), niet gedupliceerd als
-- catalogusentry.

create table public.cocktail_spirits (
  id text primary key,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table public.cocktail_glass_types (
  id text primary key,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table public.cocktail_garnishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index cocktail_garnishes_name_lower_key on public.cocktail_garnishes (lower(name));

create table public.cocktail_ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_unit text,
  created_at timestamptz not null default now()
);
create unique index cocktail_ingredients_name_lower_key on public.cocktail_ingredients (lower(name));

alter table public.cocktail_spirits enable row level security;
alter table public.cocktail_glass_types enable row level security;
alter table public.cocktail_garnishes enable row level security;
alter table public.cocktail_ingredients enable row level security;

create policy "cocktail_bar: read spirits" on public.cocktail_spirits
  for select to authenticated using (private.can_access_cocktail_bar());
create policy "cocktail_bar: owner manages spirits" on public.cocktail_spirits
  for all to authenticated using (private.is_owner()) with check (private.is_owner());

create policy "cocktail_bar: read glass types" on public.cocktail_glass_types
  for select to authenticated using (private.can_access_cocktail_bar());
create policy "cocktail_bar: owner manages glass types" on public.cocktail_glass_types
  for all to authenticated using (private.is_owner()) with check (private.is_owner());

create policy "cocktail_bar: read garnishes" on public.cocktail_garnishes
  for select to authenticated using (private.can_access_cocktail_bar());
create policy "cocktail_bar: owner manages garnishes" on public.cocktail_garnishes
  for all to authenticated using (private.is_owner()) with check (private.is_owner());

create policy "cocktail_bar: read ingredients" on public.cocktail_ingredients
  for select to authenticated using (private.can_access_cocktail_bar());
create policy "cocktail_bar: owner manages ingredients" on public.cocktail_ingredients
  for all to authenticated using (private.is_owner()) with check (private.is_owner());

revoke all on public.cocktail_spirits from anon;
revoke all on public.cocktail_glass_types from anon;
revoke all on public.cocktail_garnishes from anon;
revoke all on public.cocktail_ingredients from anon;

insert into public.cocktail_spirits (id, name, sort_order) values
  ('rum', 'Rum', 1),
  ('gin', 'Gin', 2),
  ('vodka', 'Vodka', 3),
  ('whisky', 'Whisky', 4),
  ('tequila', 'Tequila', 5);

insert into public.cocktail_glass_types (id, name, sort_order) values
  ('highball', 'Highball-glas', 1),
  ('rocks', 'Rocks-glas', 2),
  ('coupe', 'Coupeglas', 3),
  ('martini', 'Martiniglas', 4),
  ('nick-and-nora', 'Nick & Nora-glas', 5),
  ('copper-mug', 'Koperen mok', 6);
