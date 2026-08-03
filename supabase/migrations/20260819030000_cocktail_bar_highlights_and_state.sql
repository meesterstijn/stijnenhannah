-- Cocktail Bar — persoonlijke cocktailpresentaties ("highlight" = functioneel
-- een door de owner vooraf geschreven, persoonlijke presentatie per gast).
-- Eén tabel, geen tweede concurrerende structuur. cocktailnaam/foto/
-- smaakomschrijving staan hier NERGENS gedupliceerd — altijd opgehaald via
-- cocktail_id -> cocktails/cocktail_variants.
create table public.cocktail_highlights (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  cocktail_id uuid references public.cocktails(id) on delete set null,
  order_id uuid references public.cocktail_orders(id) on delete set null,
  title text not null,
  subtitle text,
  story text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cocktail_highlights_order_id_idx on public.cocktail_highlights (order_id);
create index cocktail_highlights_display_order_idx on public.cocktail_highlights (display_order);

create trigger set_cocktail_highlights_updated_at
  before update on public.cocktail_highlights
  for each row execute function public.set_updated_at();
-- order_id -> on delete set null: het verwijderen van een bestelling mag de
-- presentatie nooit meenemen (expliciete eis) — de presentatie blijft
-- herbruikbaar voor een volgende cocktailavond, alleen de koppeling verdwijnt.

alter table public.cocktail_highlights enable row level security;

create policy "cocktail_bar: owner manages highlights" on public.cocktail_highlights
  for all to authenticated
  using (private.is_owner()) with check (private.is_owner());

revoke all on public.cocktail_highlights from anon;

-- Singleton "wat toont Big Screen nu" pointer — standaard Postgres-
-- singletontrick: een boolean-PK die alleen 'true' kan zijn, dus max 1 rij.
create table public.cocktail_bar_state (
  id boolean primary key default true check (id),
  active_highlight_id uuid references public.cocktail_highlights(id) on delete set null,
  active_highlight_started_at timestamptz,
  -- Owner-override voor het klaar-scherm: laat het Big Screen een specifieke,
  -- al-'ready' bestelling vroegtijdig negeren zonder de orderstatus zelf te
  -- wijzigen (die blijft correct 'ready' in Bereiden/geschiedenis). De
  -- watcher-hook negeert dit veld zodra een NIEUWE bestelling in_progress/
  -- ready wordt, zodat het nooit toekomstige orders onderdrukt.
  dismissed_ready_order_id uuid references public.cocktail_orders(id) on delete set null,
  -- Standaard 20s, door owner later aanpasbaar zonder code-redeploy — bewust
  -- een datakolom i.p.v. een hardcoded constante.
  ready_display_seconds integer not null default 20 check (ready_display_seconds > 0),
  updated_at timestamptz not null default now()
);
insert into public.cocktail_bar_state (id) values (true);

create trigger set_cocktail_bar_state_updated_at
  before update on public.cocktail_bar_state
  for each row execute function public.set_updated_at();

alter table public.cocktail_bar_state enable row level security;

create policy "cocktail_bar: owner manages bar state" on public.cocktail_bar_state
  for all to authenticated
  using (private.is_owner()) with check (private.is_owner());

revoke all on public.cocktail_bar_state from anon;
