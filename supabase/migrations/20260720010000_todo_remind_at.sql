alter table public.todos
  add column if not exists remind_at timestamptz,
  add column if not exists reminder_sent_at timestamptz;
