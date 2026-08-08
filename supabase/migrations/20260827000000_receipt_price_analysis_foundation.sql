-- Kassabonnen v1 -> fundament voor prijsanalyse (winkels/filialen, producten/
-- varianten, aliases, btw-regels) op basis van de eerder afgestemde
-- functionele en technische ontwerpstappen. Deze migratie legt ALLEEN het
-- databasefundament neer — geen parser/API/UI-wijzigingen, geen matching-
-- logica, geen dummydata.
--
-- BACKWARDS COMPATIBILITY (belangrijkste ontwerpbeslissing van dit bestand):
-- de bestaande receipts-flow (src/features/receipts/lib/receiptsApi.ts) doet
-- expliciete kolomselecties/inserts op `store`, `total`, `name`, `brand`,
-- `unit_price`, `line_total`, `discount`, `unit`, `category` — dus RENAMEN
-- van die kolommen zou de huidige, werkende import per direct breken totdat
-- de frontend is aangepast (een latere, losse stap). Daarom: alleen ADDITIEVE
-- kolommen, bestaande kolommen blijven ongewijzigd bestaan en beschrijfbaar.
-- Waar een nieuwe kolom een 1-op-1 hernoemde betekenis heeft van een
-- bestaande kolom (store->raw_store_name, total->total_paid, name->raw_name,
-- brand->raw_brand, unit_price->regular_unit_price, line_total->
-- paid_line_total, discount->discount_amount) wordt die nieuwe kolom
-- eenmalig gebackfilld vanuit de oude, zodat historische rijen ook meteen
-- onder het nieuwe model leesbaar zijn. Nieuwe imports via de OUDE
-- receiptsApi.ts vullen na deze migratie alleen de oude kolommen — de nieuwe
-- kolommen krijgen pas waarde zodra de API-laag in een volgende stap wordt
-- aangepast; dat is bewust buiten scope van deze migratie.
--
-- RAW-KORTINGSMODEL (belangrijke correctie t.o.v. het eerdere ontwerp): een
-- productregel mag NOOIT een bedrag krijgen dat al een niet-op-diezelfde-
-- regel-gedrukte korting heeft verrekend. Bijv. "AH BIMI 2x2.99=5.98" met een
-- losse "BONUS -0.99"-regel: de Bimi-regel houdt paid_line_total = 5.98
-- (exact zoals gedrukt), de Bonus wordt een eigen regel met line_type =
-- 'discount'. Om zo'n losse discount/deposit-regel natuurlijk te laten
-- optellen tot het bontotaal, mogen financiele regelbedragen van NIET-
-- productregels signed zijn (discount negatief, deposit/product positief) —
-- vandaar dat er GEEN algemene "paid_line_total >= 0"-constraint op
-- shopping_receipt_items staat. discount_amount OP een productregel (dus een
-- korting die wel letterlijk op diezelfde regel staat) blijft wel altijd een
-- positief bedrag; die kolom heeft daarom wel een >= 0-check.
--
-- ENUM-STIJL: dit project gebruikt overal `text not null check (col in
-- (...))` in plaats van natives Postgres `create type ... as enum` (zie
-- o.a. cocktail_variants.variant_type, cocktail_orders.status,
-- profiles.app_role) — diezelfde stijl wordt hier consequent doorgezet, o.a.
-- omdat een check-constraint later zonder ALTER TYPE-gedoe uit te breiden is.
--
-- FK-VERWIJDERSTRATEGIE: structurele catalogusrelaties met een verplichte
-- ouder (store_branches.store_id, product_variants.product_id,
-- product_aliases.product_id) gebruiken ON DELETE RESTRICT — je kunt een
-- winkel/product dus niet verwijderen zolang er nog filialen/varianten/
-- aliases naar verwijzen; dat dwingt bewuste opschoning af i.p.v. een
-- ongemerkte cascade. Nullable verwijzingen VANUIT transactie-/matchdata
-- terug naar de catalogus (shopping_receipts.store_id/branch_id,
-- shopping_receipt_items.product_id/product_variant_id,
-- product_aliases.product_variant_id/store_id, product_variants.store_id)
-- gebruiken ON DELETE SET NULL — het opschonen van de catalogus mag nooit een
-- kassabon of regel zelf vernietigen, de raw-kolommen blijven dan intact en
-- de rij valt terug naar "nog niet gekoppeld". receipt_tax_lines.receipt_id
-- blijft CASCADE, exact zoals shopping_receipt_items.receipt_id al deed —
-- een btw-regel heeft geen bestaansrecht los van zijn bon.

-- ─── stores ──────────────────────────────────────────────────────────────
-- Eén canonieke rij per winkelketen. Bewust GEEN aparte store_aliases-tabel:
-- het aantal ketens is klein en groeit traag, spellingvarianten (AH/A.H./
-- Albert Heijn) worden opgevangen via handmatige correctie bij import, niet
-- via aliasinfrastructuur die op deze schaal overkill is. raw_store_name op
-- de bon blijft altijd het brondbewijs, ongeacht hoe stores wordt opgeschoond.
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (length(trim(canonical_name)) > 0),
  created_at timestamptz not null default now()
);
create unique index stores_canonical_name_lower_key on public.stores (lower(canonical_name));

-- ─── store_branches ──────────────────────────────────────────────────────
create table public.store_branches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  branch_name text,
  store_number text,
  city text,
  created_at timestamptz not null default now()
);
create index store_branches_store_id_idx on public.store_branches (store_id);
-- store_number is alleen betekenisvol binnen de eigen keten-nummering, dus
-- uniek per (store_id, store_number) i.p.v. globaal — en alleen afgedwongen
-- wanneer een nummer daadwerkelijk bekend is.
create unique index store_branches_store_number_key
  on public.store_branches (store_id, store_number)
  where store_number is not null;

-- ─── products ────────────────────────────────────────────────────────────
-- category_id verwijst naar de BESTAANDE product_categories (id is text,
-- zie 20260716080000_category_sort_order.sql) — geen nieuwe categorietabel,
-- zie het datamodel-rapport (Stap 2, hfst. 13).
create table public.products (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (length(trim(canonical_name)) > 0),
  category_id text references public.product_categories(id) on delete set null,
  comparison_unit text not null default 'piece'
    check (comparison_unit in ('kg', 'liter', 'piece', 'none')),
  created_at timestamptz not null default now()
);
-- Case-insensitieve uniciteit voorkomt "Mozzarella" en "mozzarella" als twee
-- losse producten (zelfde precedent als cocktail_garnishes_name_lower_key).
create unique index products_canonical_name_lower_key on public.products (lower(canonical_name));
create index products_category_id_idx on public.products (category_id);

-- ─── product_variants ────────────────────────────────────────────────────
-- store_id is UITSLUITEND voor huismerk-binding (deze variant is exclusief
-- van die keten) — null betekent generiek/A-merk, één rij ongeacht bij welke
-- winkel ooit gekocht (dat "waar gekocht"-feit staat op de kassabonregel,
-- niet op de variant). variant_name hoeft niet uniek te zijn: twee producten
-- kunnen toevallig dezelfde weergavenaam hebben zonder dat dat een probleem is.
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  brand text,
  variant_name text not null check (length(trim(variant_name)) > 0),
  store_id uuid references public.stores(id) on delete set null,
  package_size numeric check (package_size is null or package_size > 0),
  package_unit text check (package_unit in ('kg', 'g', 'l', 'ml', 'piece')),
  barcode text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index product_variants_product_id_idx on public.product_variants (product_id);

-- ─── product_aliases ─────────────────────────────────────────────────────
-- De matching-motor: raw kassabontekst -> product (+ evt. specifieke
-- variant), standaard winkel-specifiek (store_id gevuld), met een globale
-- alias als bewuste uitzondering (store_id null). source legt vast HOE de
-- koppeling ontstond (handmatig bevestigd, of automatisch bij hoge
-- zekerheid) — een los "confirmed"-veld zou dat dupliceren, dus die is er
-- bewust niet: een alias-rij bestaat per definitie alleen ná bevestiging.
create table public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  raw_alias text not null check (length(trim(raw_alias)) > 0),
  normalized_alias text not null check (length(trim(normalized_alias)) > 0),
  product_id uuid not null references public.products(id) on delete restrict,
  product_variant_id uuid references public.product_variants(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  source text not null check (source in ('user_confirmed', 'system_auto')),
  usage_count integer not null default 0 check (usage_count >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index product_aliases_product_id_idx on public.product_aliases (product_id);
-- Winkel-specifieke alias: uniek per (normalized_alias, store_id).
create unique index product_aliases_store_scoped_key
  on public.product_aliases (normalized_alias, store_id)
  where store_id is not null;
-- Globale alias (store_id is null): NULL-waarden zijn in een gewone unique
-- constraint onderling nooit gelijk aan elkaar, dus zonder deze aparte
-- partial index zouden er meerdere globale rijen met dezelfde
-- normalized_alias kunnen ontstaan. Deze index dwingt "maximaal één globale
-- rij per normalized_alias" wel af.
create unique index product_aliases_global_key
  on public.product_aliases (normalized_alias)
  where store_id is null;

-- Cross-tabel-integriteit ("als product_variant_id gevuld is, moet die
-- variant echt bij product_id horen") kan een CHECK-constraint niet
-- afdwingen (Postgres laat geen subqueries in CHECK toe) — dit is de ENE
-- bewuste uitzondering op "geen triggers": een kleine, op zichzelf staande
-- trigger, geen alternatief voor de gewone FK's hierboven.
create or replace function public.product_aliases_variant_matches_product()
returns trigger
language plpgsql
as $$
begin
  if new.product_variant_id is not null then
    if not exists (
      select 1 from public.product_variants v
      where v.id = new.product_variant_id and v.product_id = new.product_id
    ) then
      raise exception 'product_variant_id hoort niet bij het opgegeven product_id'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_product_aliases_variant_matches_product
  before insert or update on public.product_aliases
  for each row execute function public.product_aliases_variant_matches_product();

-- ─── receipt_tax_lines ───────────────────────────────────────────────────
create table public.receipt_tax_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.shopping_receipts(id) on delete cascade,
  rate numeric(5, 2) not null check (rate >= 0),
  taxable_amount numeric(10, 2) not null check (taxable_amount >= 0),
  tax_amount numeric(10, 2) not null check (tax_amount >= 0),
  created_at timestamptz not null default now()
);
create index receipt_tax_lines_receipt_id_idx on public.receipt_tax_lines (receipt_id);

-- ─── shopping_receipts uitbreiden (additief, zie backwards-compat-comment) ─
alter table public.shopping_receipts
  add column store_id uuid references public.stores(id) on delete set null,
  add column branch_id uuid references public.store_branches(id) on delete set null,
  add column raw_store_name text,
  add column raw_branch_name text,
  add column store_number text,
  add column purchase_time time,
  add column subtotal numeric(10, 2) check (subtotal is null or subtotal >= 0),
  add column discount_total numeric(10, 2) check (discount_total is null or discount_total >= 0),
  add column deposit_total numeric(10, 2) check (deposit_total is null or deposit_total >= 0),
  add column total_paid numeric(10, 2) check (total_paid is null or total_paid >= 0),
  add column fingerprint text;

-- Eenmalige backfill van bestaande rijen — store/total zijn al exact wat
-- raw_store_name/total_paid betekenen, dus dit is een zuivere, betrouwbare
-- 1-op-1 kopie, geen interpretatie. Branch/store_id/subtotal/etc. blijven
-- null: die informatie bestond simpelweg nog niet in de oude rijen.
update public.shopping_receipts
set raw_store_name = store,
    total_paid = total
where raw_store_name is null;

create index shopping_receipts_store_id_idx on public.shopping_receipts (store_id);
create index shopping_receipts_branch_id_idx on public.shopping_receipts (branch_id);
create index shopping_receipts_fingerprint_idx on public.shopping_receipts (fingerprint);

-- Filiaal-consistentie ("branch_id moet bij store_id horen") wordt in v1
-- BEWUST niet met een trigger afgedwongen — anders dan de product_aliases-
-- check hierboven is dit geen zuiver op-zichzelf-staande regel die matching
-- kan corrumperen, en een trigger alleen hiervoor zou de eenvoud van deze
-- migratie niet in verhouding staan tot het risico. Dit blijft voorlopig
-- applicatielaag-validatie bij het schrijven van store_id/branch_id.

-- ─── shopping_receipt_items uitbreiden (additief) ───────────────────────
alter table public.shopping_receipt_items
  add column line_type text not null default 'product'
    check (line_type in ('product', 'discount', 'deposit', 'service_or_other')),
  add column raw_name text,
  add column raw_brand text,
  add column weight numeric check (weight is null or weight > 0),
  add column weight_unit text check (weight_unit in ('kg', 'g', 'l', 'ml', 'piece')),
  add column regular_unit_price numeric(10, 2),
  add column regular_line_total numeric(10, 2),
  add column discount_amount numeric(10, 2) check (discount_amount is null or discount_amount >= 0),
  add column paid_line_total numeric(10, 2),
  add column promotion_type text
    check (promotion_type in ('bonus', '1_plus_1', 'percentage_discount', 'fixed_discount', 'multi_buy', 'other')),
  add column promotion_text text,
  add column product_id uuid references public.products(id) on delete set null,
  add column product_variant_id uuid references public.product_variants(id) on delete set null,
  add column matching_status text not null default 'unmatched'
    check (matching_status in ('matched_auto', 'matched_confirmed', 'needs_review', 'unmatched')),
  add column matching_confidence numeric(3, 2)
    check (matching_confidence is null or (matching_confidence >= 0 and matching_confidence <= 1)),
  add column match_method text
    check (match_method in ('exact_store_alias', 'exact_global_alias', 'normalized_match', 'manual', 'new_product', 'new_variant', 'unmatched')),
  add column package_size_hint numeric check (package_size_hint is null or package_size_hint > 0),
  add column package_unit_hint text check (package_unit_hint in ('kg', 'g', 'l', 'ml', 'piece')),
  add constraint shopping_receipt_items_variant_needs_product
    check (product_variant_id is null or product_id is not null);

-- Zuivere 1-op-1 backfill vanuit de oude kolommen (zelfde redenering als
-- shopping_receipts hierboven). regular_line_total wordt NIET gebackfilld:
-- het oude model kende geen vóór-korting-bedrag, dat zomaar invullen zou een
-- feit verzinnen dat niet bekend is — blijft terecht null voor oude rijen.
update public.shopping_receipt_items
set raw_name = name,
    raw_brand = brand,
    regular_unit_price = unit_price,
    paid_line_total = line_total,
    discount_amount = discount
where raw_name is null;

create index shopping_receipt_items_product_id_idx on public.shopping_receipt_items (product_id);
create index shopping_receipt_items_product_variant_id_idx on public.shopping_receipt_items (product_variant_id);
create index shopping_receipt_items_matching_status_idx on public.shopping_receipt_items (matching_status);

-- ─── RLS: zelfde owner-only conventie als elke andere huishoudtabel ─────
alter table public.stores enable row level security;
alter table public.store_branches enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_aliases enable row level security;
alter table public.receipt_tax_lines enable row level security;

drop policy if exists "stores: owner only" on public.stores;
create policy "stores: owner only" on public.stores
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "store_branches: owner only" on public.store_branches;
create policy "store_branches: owner only" on public.store_branches
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "products: owner only" on public.products;
create policy "products: owner only" on public.products
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "product_variants: owner only" on public.product_variants;
create policy "product_variants: owner only" on public.product_variants
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "product_aliases: owner only" on public.product_aliases;
create policy "product_aliases: owner only" on public.product_aliases
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "receipt_tax_lines: owner only" on public.receipt_tax_lines;
create policy "receipt_tax_lines: owner only" on public.receipt_tax_lines
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.stores from anon;
revoke all on public.store_branches from anon;
revoke all on public.products from anon;
revoke all on public.product_variants from anon;
revoke all on public.product_aliases from anon;
revoke all on public.receipt_tax_lines from anon;
