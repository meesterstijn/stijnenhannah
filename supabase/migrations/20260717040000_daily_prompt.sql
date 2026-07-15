-- A single configurable daily prompt (sent to Gemini once a day) and a log of
-- past runs so long answers stay readable in the app after the push notification.

create table if not exists public.daily_prompt (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  hour smallint not null default 8 check (hour between 0 and 23),
  minute smallint not null default 0 check (minute between 0 and 59),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_prompt_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null unique,
  prompt text not null,
  response text not null,
  created_at timestamptz not null default now()
);

alter table public.daily_prompt enable row level security;
alter table public.daily_prompt_runs enable row level security;

-- RLS is enabled AND a policy is added in the same migration this time —
-- see the weekplan incident: RLS-on-with-zero-policies silently blocks everything.
create policy "Authenticated users can do everything" on public.daily_prompt
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything" on public.daily_prompt_runs
  for all to authenticated using (true) with check (true);
