-- Kassabonnen v1: betrouwbaar bonnetjes + regels opslaan als basis voor
-- latere prijsinzichten (zie Boodschappen.tsx, sectie "Boodschappen
-- bijhouden" / JSON-import). Nog geen productnormalisatie, prijsvergelijking
-- of dashboards — alleen het opslagfundament waarop die later zonder
-- migratiechaos gebouwd kunnen worden (index op purchase_date/store hieronder
-- is daar al op voorbereid).
--
-- RLS volgt exact het bestaande patroon van alle andere huishoud-tabellen
-- (groceries, notes, todos, ... — zie 20260816010000_owner_only_lockdown.sql):
-- gedeeld tussen beide owner-accounts via private.is_owner(), NIET per
-- auth.uid() gesiloed. user_id staat er wél op (wie heeft deze bon
-- geïmporteerd), puur voor toekomstige inzichten/attributie — nooit als
-- RLS-scope, net als created_by op public.cocktail_orders.

create table if not exists public.shopping_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  store text not null check (length(trim(store)) > 0),
  purchase_date date not null,
  currency text not null default 'EUR',
  total numeric(10, 2),
  source_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.shopping_receipts(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  brand text,
  quantity numeric,
  unit text,
  unit_price numeric(10, 2),
  line_total numeric(10, 2),
  category text,
  discount numeric(10, 2),
  created_at timestamptz not null default now()
);

-- Voor toekomstige inzichten (uitgaven per week/maand, prijsontwikkeling per
-- product, categorie-uitgaven) — niet gebruikt door v1 zelf.
create index if not exists shopping_receipts_purchase_date_idx on public.shopping_receipts (purchase_date);
create index if not exists shopping_receipts_store_idx on public.shopping_receipts (store);
create index if not exists shopping_receipt_items_receipt_id_idx on public.shopping_receipt_items (receipt_id);
create index if not exists shopping_receipt_items_name_idx on public.shopping_receipt_items (name);

alter table public.shopping_receipts enable row level security;
alter table public.shopping_receipt_items enable row level security;

drop policy if exists "shopping_receipts: owner only" on public.shopping_receipts;
create policy "shopping_receipts: owner only" on public.shopping_receipts
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "shopping_receipt_items: owner only" on public.shopping_receipt_items;
create policy "shopping_receipt_items: owner only" on public.shopping_receipt_items
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- Least privilege, zelfde reden als de rest van de huishoudtabellen: de app
-- vereist toch al een sessie, anon heeft hier nooit iets te zoeken.
revoke all on public.shopping_receipts from anon;
revoke all on public.shopping_receipt_items from anon;
