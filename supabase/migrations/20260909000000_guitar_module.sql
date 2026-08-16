-- Gitaar / Akkoorden — kernmodel: albums + songs. Owner-only privémodule,
-- zelfde rechtenpatroon als de andere privémodules in owner_only_lockdown.sql
-- (private.is_owner()) — geen r6_player/cocktail_guest heeft hier iets te
-- zoeken, dus één brede "for all"-policy per tabel volstaat, net als bij die
-- lijst i.p.v. losse SELECT/INSERT/UPDATE/DELETE-policies.
--
-- `guitar_` prefix volgt de bestaande per-featureprefix-conventie (r6_*,
-- cocktail_*, plant_*).

create table public.guitar_albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  -- Storage-pad i.p.v. volledige publieke URL, zelfde keuze als recent
  -- cocktails.photo_storage_path (20260818020000) — de publieke URL wordt
  -- client-side afgeleid via getPublicUrl(), nooit apart opgeslagen/
  -- gedupliceerd.
  cover_storage_path text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_guitar_albums_updated_at
  before update on public.guitar_albums
  for each row execute function public.set_updated_at();

create table public.guitar_songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  album_id uuid references public.guitar_albums(id) on delete set null,
  -- Grondtoon-notatie (bv. "F#", "Bb", "Em") — dezelfde chordsyntax als
  -- akkoorden in `content`, zodat de centrale transpose-utility (frontend)
  -- deze zonder aparte parsing kan hergebruiken.
  original_key text not null,
  bpm integer check (bpm is null or bpm between 20 and 400),
  -- Originele songdata (secties + akkoorden inline gekoppeld aan tekst,
  -- zie chordSheet.ts). Transpose/capo zijn ALTIJD read-only weergave-
  -- berekeningen op deze tekst — nooit destructief teruggeschreven.
  content text not null default '',
  source_url text,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guitar_songs_album_id_idx on public.guitar_songs (album_id);
create index guitar_songs_favorite_idx on public.guitar_songs (favorite) where favorite;

create trigger set_guitar_songs_updated_at
  before update on public.guitar_songs
  for each row execute function public.set_updated_at();

alter table public.guitar_albums enable row level security;
alter table public.guitar_songs enable row level security;

create policy "guitar_albums: owner only" on public.guitar_albums
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

create policy "guitar_songs: owner only" on public.guitar_songs
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.guitar_albums from anon;
revoke all on public.guitar_songs from anon;

-- ── Storage: albumcovers ─────────────────────────────────────────────────
-- Zelfde patroon als cocktail-photos (20260818040000): publiek leesbaar (pad
-- zelf niet geheim), schrijven owner-only en padgebonden aan een bestaande
-- guitar_albums-rij via private.storage_first_segment_uuid(). Pad:
-- <album_id>/<uuid>.<ext>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guitar-album-covers', 'guitar-album-covers', true, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "guitar-album-covers: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'guitar-album-covers');

create policy "guitar-album-covers: owner upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'guitar-album-covers'
    and private.is_owner()
    and exists (select 1 from public.guitar_albums a where a.id = private.storage_first_segment_uuid(objects.name))
  );

create policy "guitar-album-covers: owner update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'guitar-album-covers' and private.is_owner());

create policy "guitar-album-covers: owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'guitar-album-covers' and private.is_owner());
