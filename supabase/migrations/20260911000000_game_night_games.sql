-- Game Night — spellenkast. Alleen het datamodel voor de spellenbibliotheek
-- (section 6/20 van de opdracht: geen grote uitbreiding voor toekomstige
-- features als spelers/potjes/scores/Hall of Fame — dat komt later, apart
-- geanalyseerd). Zelfde owner-only rechtenpatroon als elke andere
-- privémodule (private.is_owner(), zie owner_only_lockdown.sql), en
-- dezelfde storage-conventie als guitar-album-covers/cocktail-photos
-- (public read, owner-only write, padgebonden aan een bestaande rij).

create table public.game_night_games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Storage-pad i.p.v. volledige URL — zelfde keuze als guitar_albums.cover_storage_path;
  -- null = nog geen echte cover geüpload, de UI toont dan een ontworpen placeholder.
  cover_storage_path text,
  min_players integer,
  max_players integer,
  duration_minutes integer,
  difficulty text check (difficulty in ('licht', 'gemiddeld', 'zwaar')),
  tags text[] not null default '{}',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_game_night_games_updated_at
  before update on public.game_night_games
  for each row execute function public.set_updated_at();

alter table public.game_night_games enable row level security;

create policy "game_night_games: owner only" on public.game_night_games
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_games from anon;

-- ── Storage: covers ──────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-night-covers', 'game-night-covers', true, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "game-night-covers: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'game-night-covers');

create policy "game-night-covers: owner upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'game-night-covers'
    and private.is_owner()
    and exists (select 1 from public.game_night_games g where g.id = private.storage_first_segment_uuid(objects.name))
  );

create policy "game-night-covers: owner update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'game-night-covers' and private.is_owner());

create policy "game-night-covers: owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'game-night-covers' and private.is_owner());
