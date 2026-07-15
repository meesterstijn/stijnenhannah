-- Tracks whether today's 9:00 to-do reminder has already been sent, so the
-- 10-minute cron check doesn't send it more than once per day.

create table if not exists public.todo_reminder_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null unique,
  created_at timestamptz not null default now()
);

alter table public.todo_reminder_runs enable row level security;

create policy "Authenticated users can do everything" on public.todo_reminder_runs
  for all to authenticated using (true) with check (true);
