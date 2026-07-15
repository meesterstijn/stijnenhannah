-- notes, todos and birthdays had RLS disabled and no policies, so anyone with the
-- public anon key could read/write them without logging in. Bring them in line
-- with the rest of the app's "authenticated users can do everything" pattern
-- (see groceries / recipes policies).

alter table public.notes enable row level security;
alter table public.todos enable row level security;
alter table public.birthdays enable row level security;

create policy "Authenticated users can do everything" on public.notes
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything" on public.todos
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything" on public.birthdays
  for all to authenticated using (true) with check (true);
