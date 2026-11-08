-- Eigen oefeningen delen na goedkeuring.
--
-- Eigen oefeningen (training_exercises) blijven privé: de RLS daar eist
-- user_id = auth.uid(), ook voor de owner. Dat blijft zo, anders zou de
-- sync van de owner ieders oefeningen binnenhalen.
--
-- Nieuw:
--   * training_shared_exercises: de goedgekeurde (of afgewezen) kopieën. Het
--     id is dat van de ingediende oefening, dus één beoordeling per oefening.
--     Iedereen met Training leest de goedgekeurde; de owner leest alles.
--     Schrijven alleen via de functies hieronder.
--   * training_exercise_submissions(): de owner ziet de eigen oefeningen van
--     anderen, met de beoordeling als die er is (null = wacht).
--   * training_review_exercise(id, approve, name): goedkeuren (kopie van naam
--     en gegevens op dat moment) of afwijzen/intrekken.

begin;

create table if not exists public.training_shared_exercises (
  id uuid primary key,
  source_user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 65536),
  status text not null check (status in ('approved', 'rejected')),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.training_shared_exercises enable row level security;

revoke all on public.training_shared_exercises from anon, authenticated;
grant select on public.training_shared_exercises to authenticated;

drop policy if exists "Gedeelde oefeningen lezen" on public.training_shared_exercises;
create policy "Gedeelde oefeningen lezen" on public.training_shared_exercises
  for select to authenticated
  using (
    (status = 'approved' and private.can_use_training())
    or private.is_owner()
  );

create or replace function public.training_exercise_submissions()
returns table (
  id uuid,
  user_id uuid,
  email text,
  name text,
  data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  status text,
  shared_name text,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag oefeningen beoordelen' using errcode = '42501';
  end if;
  return query
    select e.id, e.user_id, u.email::text, e.name, e.data, e.created_at,
           e.updated_at, s.status, s.name, s.reviewed_at
      from public.training_exercises e
      left join auth.users u on u.id = e.user_id
      left join public.training_shared_exercises s on s.id = e.id
     where e.user_id <> auth.uid()
       and e.deleted_at is null
       and (e.archived_at is null or s.id is not null)
     order by e.created_at desc;
end;
$$;

revoke execute on function public.training_exercise_submissions() from public, anon;
grant execute on function public.training_exercise_submissions() to authenticated;

create or replace function public.training_review_exercise(
  p_id uuid,
  p_approve boolean,
  p_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source public.training_exercises%rowtype;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag oefeningen beoordelen' using errcode = '42501';
  end if;

  select * into source from public.training_exercises
   where id = p_id and deleted_at is null;

  if not found then
    -- Bron verwijderd: alleen een bestaande deling nog intrekken.
    if not p_approve then
      update public.training_shared_exercises
         set status = 'rejected', reviewed_at = now()
       where id = p_id;
      if found then return; end if;
    end if;
    raise exception 'Oefening % bestaat niet', p_id;
  end if;

  insert into public.training_shared_exercises as s
    (id, source_user_id, name, data, status)
  values (
    source.id,
    source.user_id,
    coalesce(nullif(btrim(p_name), ''), source.name),
    source.data,
    case when p_approve then 'approved' else 'rejected' end
  )
  on conflict (id) do update
    set status = excluded.status,
        reviewed_at = now(),
        -- Bij goedkeuren de actuele versie; bij intrekken de kopie laten.
        name = case when p_approve then excluded.name else s.name end,
        data = case when p_approve then excluded.data else s.data end;
end;
$$;

revoke execute on function public.training_review_exercise(uuid, boolean, text) from public, anon;
grant execute on function public.training_review_exercise(uuid, boolean, text) to authenticated;

commit;
