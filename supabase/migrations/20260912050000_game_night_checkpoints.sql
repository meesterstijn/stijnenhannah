-- Game Night — checkpoints ("spelstanden") en hun foto's (sectie 14-16).
-- Fundament nu; de daadwerkelijke camera/checkpoint-UI volgt later (sectie
-- 34 NU-nog-niet-lijst) — hier gaat het om een datamodel/storage-opzet die
-- die UI straks zonder migratiewijziging kan gebruiken.

create table public.game_night_checkpoints (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_night_game_sessions(id) on delete cascade,
  title text,
  notes text,
  created_at timestamptz not null default now(),
  -- Wie 'm maakte (owner-account) — set null i.p.v. cascade: het account
  -- zelf verdwijnt in de praktijk nooit, maar mocht dat ooit gebeuren dan
  -- blijft de checkpoint (en de bijbehorende foto's) gewoon bestaan.
  created_by uuid references auth.users(id) on delete set null
);

create index game_night_checkpoints_session_idx
  on public.game_night_checkpoints (game_session_id);

alter table public.game_night_checkpoints enable row level security;

create policy "game_night_checkpoints: owner only" on public.game_night_checkpoints
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_checkpoints from anon;

-- ── Foto's per checkpoint — bewust ONBEPERKT en meerdere per type ────────
-- Geen unique-constraint op (checkpoint_id, photo_type): sectie 15 is
-- expliciet dat bv. twee bordfoto's of drie kaartfoto's naast elkaar
-- moeten kunnen bestaan. sort_order bepaalt alleen de weergavevolgorde.
create table public.game_night_checkpoint_photos (
  id uuid primary key default gen_random_uuid(),
  checkpoint_id uuid not null references public.game_night_checkpoints(id) on delete cascade,
  storage_path text not null,
  photo_type text not null default 'other'
    check (photo_type in ('board', 'cards', 'player', 'supply', 'score', 'other')),
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index game_night_checkpoint_photos_checkpoint_idx
  on public.game_night_checkpoint_photos (checkpoint_id, sort_order);

alter table public.game_night_checkpoint_photos enable row level security;

create policy "game_night_checkpoint_photos: owner only" on public.game_night_checkpoint_photos
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_checkpoint_photos from anon;

-- ── Storage: checkpointfoto's ─────────────────────────────────────────────
-- Pad: <checkpoint_id>/<uuid>.<ext> — bewust plat onder de checkpoint i.p.v.
-- de diepe sessionId/gameSessionId/checkpointId-nesting: elke checkpoint-
-- rij verwijst zelf al naar zijn game_session (en die weer naar zijn Game
-- Night), dus die keten is altijd via een join terug te vinden. Een platte
-- structuur laat private.storage_first_segment_uuid() (zelfde helper als
-- guitar-album-covers/game-night-covers) het pad rechtstreeks aan een
-- bestaande checkpointrij toetsen, zonder een aangepaste variant nodig te
-- hebben die met meerdere padsegmenten moet omgaan.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-night-checkpoints', 'game-night-checkpoints', true, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "game-night-checkpoints: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'game-night-checkpoints');

create policy "game-night-checkpoints: owner upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'game-night-checkpoints'
    and private.is_owner()
    and exists (
      select 1 from public.game_night_checkpoints c
      where c.id = private.storage_first_segment_uuid(objects.name)
    )
  );

create policy "game-night-checkpoints: owner update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'game-night-checkpoints' and private.is_owner());

create policy "game-night-checkpoints: owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'game-night-checkpoints' and private.is_owner());
