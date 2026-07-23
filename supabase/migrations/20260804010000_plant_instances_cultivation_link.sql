-- Nullable back-reference from plant_instance to the cultivation_plan_item
-- it was created from. ON DELETE SET NULL guarantees that deleting a plan
-- or item never cascades to real plant instances — the link simply becomes
-- null. Existing instances get null (they predate the planner).

alter table public.plant_instances
  add column if not exists cultivation_plan_item_id uuid
    references public.cultivation_plan_items(id)
    on delete set null;

create index if not exists plant_instances_cultivation_plan_item_id_idx
  on public.plant_instances (cultivation_plan_item_id);
