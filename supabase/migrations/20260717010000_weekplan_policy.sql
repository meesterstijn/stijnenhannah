-- weekplan had RLS enabled with zero policies, so every write (and read) from
-- the app's authenticated client was silently denied by Postgres — including
-- the recipe-link dropdown, and even plain meal text edits before it.

create policy "Authenticated users can do everything" on public.weekplan
  for all to authenticated using (true) with check (true);
