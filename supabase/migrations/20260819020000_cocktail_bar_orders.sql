-- Cocktail Bar — bestellingen. guest_name is vrije tekst (geen guest_profiles-
-- tabel — één gedeeld tablet-account, iedere fysieke gast typt zijn/haar
-- eigen naam per bestelling). on delete restrict op cocktail/variant: een
-- bestelling bewaart nooit een naam/foto-snapshot, dus de brontabel mag niet
-- onder de bestelgeschiedenis vandaan verwijderd worden.
create table public.cocktail_orders (
  id uuid primary key default gen_random_uuid(),
  cocktail_id uuid not null references public.cocktails(id) on delete restrict,
  variant_id uuid not null references public.cocktail_variants(id) on delete restrict,
  guest_name text not null check (length(trim(guest_name)) > 0),
  note text,
  status text not null default 'ordered' check (status in ('ordered', 'in_progress', 'ready')),
  ready_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cocktail_orders_status_idx on public.cocktail_orders (status);
create index cocktail_orders_created_at_idx on public.cocktail_orders (created_at);

create trigger set_cocktail_orders_updated_at
  before update on public.cocktail_orders
  for each row execute function public.set_updated_at();

-- ready_at komt UITSLUITEND uit deze trigger, nooit uit de client — dit is
-- wat het Big Screen een reload tijdens het klaar-scherm laat overleven
-- zonder client-kloktijd te vertrouwen (zie Cocktail Bar-implementatieplan §6).
-- Let op: een expliciete UPDATE die alleen ready_at herzet terwijl de status
-- al 'ready' is (owner-actie "klaar-scherm verlengen") raakt geen van beide
-- takken hieronder, dus die waarde wordt hier niet overschreven.
create or replace function public.cocktail_orders_set_ready_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'ready' and old.status is distinct from 'ready' then
    new.ready_at := now();
  elsif new.status is distinct from 'ready' then
    new.ready_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_cocktail_orders_set_ready_at
  before update on public.cocktail_orders
  for each row execute function public.cocktail_orders_set_ready_at();

alter table public.cocktail_orders enable row level security;

-- Guest leest niets terug (least privilege) — het Big Screen toont de status
-- aan de kamer en logt zelf in als owner, dus guest heeft geen SELECT nodig.
create policy "cocktail_bar: owner reads orders" on public.cocktail_orders
  for select to authenticated using (private.is_owner());
create policy "cocktail_bar: create orders" on public.cocktail_orders
  for insert to authenticated with check (private.can_access_cocktail_bar());
create policy "cocktail_bar: owner updates orders" on public.cocktail_orders
  for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy "cocktail_bar: owner deletes orders" on public.cocktail_orders
  for delete to authenticated using (private.is_owner());

revoke all on public.cocktail_orders from anon;
