-- Rainbow Six Siege LAN Companion — fase 2.2, deel 6: Storage-bucket voor
-- LAN-foto's/media. Zelfde patroon als de bestaande 'growth-photos'-bucket
-- (zie 20260803110000_growth_photos_storage.sql).
--
-- IMPORTANT: als Storage nog niet actief is op dit Supabase-project, maak
-- de bucket eerst handmatig aan via het dashboard:
--   Storage → New bucket → Name: r6-session-media → Public: on
-- Deze migratie is idempotent (ON CONFLICT DO NOTHING op de bucket-insert).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'r6-session-media',
  'r6-session-media',
  true,
  20971520, -- 20 MB, zelfde grens als growth-photos
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "r6-session-media: authenticated upload" on storage.objects;
create policy "r6-session-media: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'r6-session-media');

drop policy if exists "r6-session-media: authenticated delete" on storage.objects;
create policy "r6-session-media: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'r6-session-media');

drop policy if exists "r6-session-media: authenticated update" on storage.objects;
create policy "r6-session-media: authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'r6-session-media');

drop policy if exists "r6-session-media: public read" on storage.objects;
create policy "r6-session-media: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'r6-session-media');
