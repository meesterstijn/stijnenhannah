-- Link a weekplan day to an actual recipe so a full week's ingredients can be
-- pulled into the shopping list in one go.

alter table public.weekplan
  add column if not exists recipe_id uuid references public.recipes(id) on delete set null;
