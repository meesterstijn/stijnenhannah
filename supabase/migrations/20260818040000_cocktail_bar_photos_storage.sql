-- Cocktail Bar — fotobucket, exact het patroon van growth-photos/
-- r6-session-media: publiek leesbaar (het pad zelf is niet geheim), schrijven
-- (upload/update/verwijderen) owner-only en padgebonden aan een bestaande
-- cocktails-rij via het al bestaande private.storage_first_segment_uuid().
-- Pad: <cocktail_id>/<uuid>.<ext>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cocktail-photos', 'cocktail-photos', true, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "cocktail-photos: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'cocktail-photos');

-- `objects.name` (met tabelnaam) i.p.v. bare `name`: cocktails heeft zelf
-- ook een kolom `name` (de cocktailnaam), en een onbevoegd `name` binnen de
-- exists-subquery wordt door Postgres stilzwijgend naar DIE kolom herleid
-- (de binnenste FROM-scope wint, zonder waarschuwing) i.p.v. naar de rij die
-- hier daadwerkelijk geïnsert wordt — waardoor de check een cocktailnaam als
-- pad probeerde te parsen (altijd NULL, dus altijd false). Ontdekt via
-- storage-logs + een handmatige insert-simulatie tijdens het testen van de
-- beheer-wizard.
create policy "cocktail-photos: owner upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'cocktail-photos'
    and private.is_owner()
    and exists (select 1 from public.cocktails c where c.id = private.storage_first_segment_uuid(objects.name))
  );

create policy "cocktail-photos: owner update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'cocktail-photos' and private.is_owner());

create policy "cocktail-photos: owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'cocktail-photos' and private.is_owner());
