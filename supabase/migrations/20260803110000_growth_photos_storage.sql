-- Creates the 'growth-photos' Storage bucket and its access policies.
--
-- IMPORTANT: If the Supabase project does not yet have storage enabled,
-- create the bucket manually via the Supabase dashboard:
--   Storage → New bucket → Name: growth-photos → Public: on
--
-- This migration is idempotent: if the bucket already exists, the INSERT is
-- skipped via ON CONFLICT DO NOTHING.

-- Create bucket (public: images are readable by URL without signing)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'growth-photos',
  'growth-photos',
  true,
  20971520, -- 20 MB hard limit at Storage level (app also validates)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Only authenticated users may upload
drop policy if exists "growth-photos: authenticated upload" on storage.objects;
create policy "growth-photos: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'growth-photos');

-- Only authenticated users may delete
drop policy if exists "growth-photos: authenticated delete" on storage.objects;
create policy "growth-photos: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'growth-photos');

-- Only authenticated users may update (replace)
drop policy if exists "growth-photos: authenticated update" on storage.objects;
create policy "growth-photos: authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'growth-photos');

-- Public read: anyone with the URL can view a photo
drop policy if exists "growth-photos: public read" on storage.objects;
create policy "growth-photos: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'growth-photos');
