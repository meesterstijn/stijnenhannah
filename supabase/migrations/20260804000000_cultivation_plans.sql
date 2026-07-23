-- Teeltplanner: planning tables for future growing seasons.
-- Deliberately separate from plant_instances — a plan item is a FUTURE
-- intention, not a real planted specimen. "Plant nu" bridges the two.
--
-- cultivation_plans: one plan per season (multiple allowed per year).
-- cultivation_plan_items: one row per species within a plan.
-- The set_updated_at() trigger function already exists from
-- 20260802010000_plant_instances_and_growing_seasons.sql.

-- ─── cultivation_plans ───────────────────────────────────────────────────────

create table if not exists public.cultivation_plans (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  plan_year   integer     not null,
  status      text        not null default 'draft'
    check (status in ('draft', 'active', 'completed', 'archived')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists cultivation_plans_plan_year_idx
  on public.cultivation_plans (plan_year);
create index if not exists cultivation_plans_status_idx
  on public.cultivation_plans (status);

drop trigger if exists set_cultivation_plans_updated_at on public.cultivation_plans;
create trigger set_cultivation_plans_updated_at
  before update on public.cultivation_plans
  for each row execute function public.set_updated_at();

-- ─── cultivation_plan_items ──────────────────────────────────────────────────

create table if not exists public.cultivation_plan_items (
  id                    uuid      primary key default gen_random_uuid(),

  cultivation_plan_id   uuid      not null
    references public.cultivation_plans(id) on delete cascade,

  species_id            uuid      not null
    references public.plants(id) on delete restrict,

  planned_quantity      integer   not null default 1
    check (planned_quantity >= 1),

  planted_quantity      integer   not null default 0
    check (planted_quantity >= 0),

  -- planted_quantity may never exceed planned_quantity
  constraint cultivation_plan_items_planted_le_planned
    check (planted_quantity <= planned_quantity),

  planned_location      text,
  notes                 text,

  -- Optional per-item override for pot volume (liters per plant).
  -- Falls back to species.pot_recommended_liters → species.pot_min_liters.
  pot_liters_override   numeric,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One species per plan (avoid duplicate rows; raise quantity instead)
create unique index if not exists cultivation_plan_items_plan_species_uidx
  on public.cultivation_plan_items (cultivation_plan_id, species_id);

create index if not exists cultivation_plan_items_plan_id_idx
  on public.cultivation_plan_items (cultivation_plan_id);
create index if not exists cultivation_plan_items_species_id_idx
  on public.cultivation_plan_items (species_id);

drop trigger if exists set_cultivation_plan_items_updated_at on public.cultivation_plan_items;
create trigger set_cultivation_plan_items_updated_at
  before update on public.cultivation_plan_items
  for each row execute function public.set_updated_at();

-- ─── RLS — identical pattern to plant_instances / growing_seasons ─────────────

alter table public.cultivation_plans      enable row level security;
alter table public.cultivation_plan_items enable row level security;

drop policy if exists "Authenticated users can do everything" on public.cultivation_plans;
create policy "Authenticated users can do everything" on public.cultivation_plans
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can do everything" on public.cultivation_plan_items;
create policy "Authenticated users can do everything" on public.cultivation_plan_items
  for all to authenticated using (true) with check (true);
