-- Cocktail Bar — kernmodel. Eén `cocktails`-rij per concept (naam/tagline/
-- achtergrondverhaal/foto/publicatiestatus, NOOIT gedupliceerd), met 1 of 2
-- rijen in `cocktail_variants` (alcoholic / alcohol_free) die elk hun eigen
-- glas/spirit/garnering/ABV/bereiding/ingrediënten/smaakscores hebben. Dit
-- modelleert een "volledige alcoholvrije variant" zonder een tweede
-- cocktailconcept aan te maken — zie het implementatieplan §1/§8.

create table public.cocktails (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text not null,
  backstory text,
  photo_storage_path text,
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cocktails_is_published_idx on public.cocktails (is_published);

create trigger set_cocktails_updated_at
  before update on public.cocktails
  for each row execute function public.set_updated_at();

create table public.cocktail_variants (
  id uuid primary key default gen_random_uuid(),
  cocktail_id uuid not null references public.cocktails(id) on delete cascade,
  variant_type text not null check (variant_type in ('alcoholic', 'alcohol_free')),
  glass_type_id text references public.cocktail_glass_types(id),
  spirit_id text references public.cocktail_spirits(id),
  garnish_id uuid references public.cocktail_garnishes(id),
  abv_percent numeric(4,1) not null default 0 check (abv_percent between 0 and 100),
  preparation_steps text not null,
  -- Optionele foto-override; null = terugval op cocktails.photo_storage_path.
  photo_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cocktail_id, variant_type),
  constraint cocktail_variants_spirit_matches_type check (
    (variant_type = 'alcohol_free' and spirit_id is null)
    or (variant_type = 'alcoholic' and spirit_id is not null)
  )
);
create index cocktail_variants_cocktail_id_idx on public.cocktail_variants (cocktail_id);

create trigger set_cocktail_variants_updated_at
  before update on public.cocktail_variants
  for each row execute function public.set_updated_at();

-- 0-5 scores ONLY. Badges (Zoet/Zuur/Bitter/Fris/Sterk) worden NOOIT hier of
-- ergens anders als tekst opgeslagen — altijd afgeleid via de
-- deriveFlavourBadges()-functie in de frontend (score >= 4).
create table public.cocktail_flavour_profiles (
  variant_id uuid primary key references public.cocktail_variants(id) on delete cascade,
  sweet_score smallint not null default 0 check (sweet_score between 0 and 5),
  sour_score smallint not null default 0 check (sour_score between 0 and 5),
  bitter_score smallint not null default 0 check (bitter_score between 0 and 5),
  fresh_score smallint not null default 0 check (fresh_score between 0 and 5),
  strong_score smallint not null default 0 check (strong_score between 0 and 5),
  updated_at timestamptz not null default now()
);

create trigger set_cocktail_flavour_profiles_updated_at
  before update on public.cocktail_flavour_profiles
  for each row execute function public.set_updated_at();

-- Hoeveelheden leven UITSLUITEND hier — nooit als vrije tekst op de cocktail
-- zelf, en de ingrediëntnaam staat maar één keer in cocktail_ingredients.
create table public.cocktail_variant_ingredients (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.cocktail_variants(id) on delete cascade,
  ingredient_id uuid not null references public.cocktail_ingredients(id) on delete restrict,
  amount numeric(8,2) not null check (amount > 0),
  unit text not null,
  note text,
  sort_order integer not null default 0,
  unique (variant_id, ingredient_id)
);
create index cocktail_variant_ingredients_variant_id_idx on public.cocktail_variant_ingredients (variant_id);

alter table public.cocktails enable row level security;
alter table public.cocktail_variants enable row level security;
alter table public.cocktail_flavour_profiles enable row level security;
alter table public.cocktail_variant_ingredients enable row level security;

create policy "cocktail_bar: read cocktails" on public.cocktails
  for select to authenticated
  using (private.is_owner() or (private.is_cocktail_guest() and is_published));
create policy "cocktail_bar: owner manages cocktails" on public.cocktails
  for all to authenticated
  using (private.is_owner()) with check (private.is_owner());

create policy "cocktail_bar: read variants" on public.cocktail_variants
  for select to authenticated
  using (
    private.is_owner()
    or (private.is_cocktail_guest()
        and exists (select 1 from public.cocktails c where c.id = cocktail_id and c.is_published))
  );
create policy "cocktail_bar: owner manages variants" on public.cocktail_variants
  for all to authenticated
  using (private.is_owner()) with check (private.is_owner());

create policy "cocktail_bar: read flavour profiles" on public.cocktail_flavour_profiles
  for select to authenticated
  using (
    private.is_owner()
    or (private.is_cocktail_guest()
        and exists (
          select 1 from public.cocktail_variants v
          join public.cocktails c on c.id = v.cocktail_id
          where v.id = variant_id and c.is_published
        ))
  );
create policy "cocktail_bar: owner manages flavour profiles" on public.cocktail_flavour_profiles
  for all to authenticated
  using (private.is_owner()) with check (private.is_owner());

create policy "cocktail_bar: read variant ingredients" on public.cocktail_variant_ingredients
  for select to authenticated
  using (
    private.is_owner()
    or (private.is_cocktail_guest()
        and exists (
          select 1 from public.cocktail_variants v
          join public.cocktails c on c.id = v.cocktail_id
          where v.id = variant_id and c.is_published
        ))
  );
create policy "cocktail_bar: owner manages variant ingredients" on public.cocktail_variant_ingredients
  for all to authenticated
  using (private.is_owner()) with check (private.is_owner());

revoke all on public.cocktails from anon;
revoke all on public.cocktail_variants from anon;
revoke all on public.cocktail_flavour_profiles from anon;
revoke all on public.cocktail_variant_ingredients from anon;
