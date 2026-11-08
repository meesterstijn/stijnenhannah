-- Feedback uit Training tijdens de testfase: een vaste knop op elke
-- trainingspagina stuurt een korte opmerking mee met de pagina waar de
-- gebruiker op dat moment was.
--
-- Toegang:
--   * Toevoegen: iedereen die Training mag gebruiken (owner, training_user),
--     alleen als zichzelf en nooit al afgehandeld.
--   * Lezen: je eigen feedback; de owner ziet alles (overzicht in Training →
--     Meer → Feedback).
--   * Afhandelen en verwijderen: alleen de owner.
--
-- `id` wordt door de app zelf gemaakt, zodat een offline wachtrij veilig
-- opnieuw kan versturen: een tweede insert met hetzelfde id faalt op de
-- primary key en telt in de app als "al verstuurd".

begin;

create table if not exists public.training_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'opmerking'
    check (kind in ('fout', 'idee', 'onduidelijk', 'opmerking')),
  message text not null
    check (char_length(btrim(message)) between 1 and 4000),
  page_path text not null check (char_length(page_path) <= 500),
  page_label text check (char_length(page_label) <= 200),
  context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 8192),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists training_feedback_created_at_idx
  on public.training_feedback (created_at desc);

alter table public.training_feedback enable row level security;

revoke all on public.training_feedback from anon;
grant select, insert, update, delete on public.training_feedback to authenticated;

drop policy if exists "Feedback toevoegen" on public.training_feedback;
create policy "Feedback toevoegen" on public.training_feedback
  for insert to authenticated
  with check (
    private.can_use_training()
    and user_id = auth.uid()
    and resolved_at is null
  );

drop policy if exists "Feedback lezen" on public.training_feedback;
create policy "Feedback lezen" on public.training_feedback
  for select to authenticated
  using (user_id = auth.uid() or private.is_owner());

drop policy if exists "Owner handelt feedback af" on public.training_feedback;
create policy "Owner handelt feedback af" on public.training_feedback
  for update to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "Owner verwijdert feedback" on public.training_feedback;
create policy "Owner verwijdert feedback" on public.training_feedback
  for delete to authenticated
  using (private.is_owner());

commit;
