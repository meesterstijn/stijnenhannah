-- Adds growth_log_photos: a dedicated table for Storage-backed photos linked
-- to a specific growth_log_entry. One entry can have zero, one, or multiple
-- photos. The plant_instance_id column is denormalized for fast per-instance
-- timeline queries; it must always match growth_log_entries.plant_instance_id.
--
-- The actual image files live in the 'growth-photos' Storage bucket, which
-- must be created manually via the Supabase dashboard or the companion
-- migration 20260803110000_growth_photos_storage.sql.
--
-- ON DELETE CASCADE on growth_log_entry_id ensures photo metadata is cleaned
-- up when an entry is deleted. The Storage files themselves must be removed
-- at the application level before deleting the entry (cascade cannot reach
-- Storage — see growthPhotoStorage.ts).

create table if not exists public.growth_log_photos (
  id uuid primary key default gen_random_uuid(),

  growth_log_entry_id uuid not null
    references public.growth_log_entries(id)
    on delete cascade,

  -- Denormalized for fast per-instance queries and Storage policy targeting.
  -- Always matches growth_log_entries.plant_instance_id of the parent entry.
  plant_instance_id uuid not null
    references public.plant_instances(id)
    on delete cascade,

  -- Stable Storage path: <plant_instance_id>/<entry_id>/<photo_uuid>.<ext>
  -- Primary reference — remains valid even if a public URL format changes.
  storage_path text not null,

  -- Public URL derived from storage_path at upload time.
  -- Stored for fast display; re-derivable via getPublicUrl(storage_path).
  photo_url text not null,

  original_filename text,
  mime_type text,
  file_size_bytes bigint,

  created_at timestamptz not null default now()
);

create index if not exists growth_log_photos_entry_id_idx
  on public.growth_log_photos (growth_log_entry_id);

create index if not exists growth_log_photos_instance_id_idx
  on public.growth_log_photos (plant_instance_id);

alter table public.growth_log_photos enable row level security;

drop policy if exists "Authenticated users can do everything" on public.growth_log_photos;
create policy "Authenticated users can do everything" on public.growth_log_photos
  for all to authenticated using (true) with check (true);
