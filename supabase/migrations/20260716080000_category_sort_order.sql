-- Explicit, reorderable sort order for product categories, instead of relying
-- on created_at (which is identical for every row inserted by saveCategories()
-- in one batch, making the display order an accident of physical row storage).

alter table public.product_categories
  add column if not exists sort_order integer;

update public.product_categories pc
set sort_order = sub.rn
from (
  select id, row_number() over (order by created_at asc) as rn
  from public.product_categories
) sub
where pc.id = sub.id and pc.sort_order is null;

alter table public.product_categories
  alter column sort_order set default 0,
  alter column sort_order set not null;
