-- Atomic "Plant nu" helper: links a freshly created plant_instance back to
-- its source cultivation_plan_item AND increments planted_quantity in one
-- transaction. Called immediately after create_plant_instance_with_season
-- succeeds. If the increment would violate the planted_le_planned CHECK the
-- whole transaction rolls back and the instance is left without a plan link
-- (the application handles this error and informs the user).

create or replace function public.link_instance_to_plan_item(
  p_instance_id uuid,
  p_plan_item_id uuid
)
returns void
language plpgsql
security invoker
as $$
begin
  -- Tag the instance with its origin plan item
  update public.plant_instances
    set cultivation_plan_item_id = p_plan_item_id
    where id = p_instance_id;

  if not found then
    raise exception 'plant_instance % not found', p_instance_id;
  end if;

  -- Increment the counter (CHECK constraint prevents exceeding planned_quantity)
  update public.cultivation_plan_items
    set planted_quantity = planted_quantity + 1
    where id = p_plan_item_id;

  if not found then
    raise exception 'cultivation_plan_item % not found', p_plan_item_id;
  end if;
end;
$$;

revoke execute on function public.link_instance_to_plan_item from public, anon;
grant  execute on function public.link_instance_to_plan_item to authenticated;
