-- Cocktail Bar — favorieten, per profiel (owner) i.p.v. globaal. Er is geen
-- los gastprofiel (cocktail_guest is één gedeeld tablet-account, zie het
-- implementatieplan), dus favorieten zijn in de praktijk vandaag "owner's
-- favorieten" — de tabelvorm schaalt wel netjes door mocht dat ooit wijzigen.
create table public.cocktail_favorites (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cocktail_id uuid not null references public.cocktails(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, cocktail_id)
);

alter table public.cocktail_favorites enable row level security;

create policy "cocktail_bar: manage own favorites" on public.cocktail_favorites
  for all to authenticated
  using (profile_id = auth.uid() and private.is_owner())
  with check (profile_id = auth.uid() and private.is_owner());

revoke all on public.cocktail_favorites from anon;
