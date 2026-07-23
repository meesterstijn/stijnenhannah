-- Add backup_quantity to cultivation_plan_items.
-- Tracks extra plants grown as backup in case main plants fail or don't germinate.
-- Existing rows automatically get default 0 — no breaking change.
-- Pot soil and pot counts remain calculated from planned_quantity only;
-- backup plants are typically started in seed trays or soil blocks.

alter table public.cultivation_plan_items
  add column if not exists backup_quantity integer not null default 0
    constraint cultivation_plan_items_backup_quantity_check
      check (backup_quantity >= 0);
