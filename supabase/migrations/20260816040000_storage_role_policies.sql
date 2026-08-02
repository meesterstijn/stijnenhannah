-- Gebruikersrollen, deel 5: Storage-beveiliging.
--
-- Twee buckets bestaan vandaag: `r6-session-media` (LAN-foto's) en
-- `growth-photos` (Tuingids-groeifoto's). Beide staan `public = true` —
-- Supabase's publieke Storage-endpoint (`/storage/v1/object/public/...`)
-- omzeilt RLS op `storage.objects` volledig voor GET-requests op een
-- publieke bucket, ongeacht welke SELECT-policy hieronder staat. Daarom is
-- de aanpak per bucket bewust verschillend:
--
--  - r6-session-media: LAN-foto's zijn low-sensitivity, gedeelde,
--    feestelijke content — dit was al bewust publiek leesbaar ("anyone with
--    the URL"), dat blijft ongewijzigd. Wat WEL verandert: schrijven
--    (upload/update/verwijderen) wordt rolgebonden (owner + r6_player,
--    zoals gevraagd) én pad-gebonden — het eerste padsegment van
--    `storage_path` (het patroon `<session_id>/<photo_uuid>.<ext>`, zie
--    lib/media.ts) moet daadwerkelijk een BESTAANDE, LIVE r6_sessions-rij
--    zijn, zodat het databaserecord en het Storage-pad gegarandeerd bij
--    dezelfde sessie horen.
--
--  - growth-photos: WEL persoonlijke/privédata (foto's van je eigen tuin/
--    huis). Om deze structureel voor r6_player onzichtbaar te maken zou de
--    bucket naar `public = false` moeten en zou elke weergave moeten
--    overstappen van een opgeslagen publieke URL (`getPublicUrl`, nu
--    persistent bewaard in `growth_log_photos.photo_url`) naar telkens vers
--    gegenereerde, verlopende signed URLs — een niet-triviale
--    frontendwijziging die het bestaande, werkende fototijdlijn-onderdeel
--    kan breken en die in deze sessie niet live tegen de database getest kan
--    worden. Wat déze migratie WEL veilig en zonder frontendimpact doet:
--    upload/update/verwijderen beperken tot owner-only (r6_player kon hier
--    via de UI toch al nooit bij komen, dit sluit alleen de directe-
--    API-omzeiling). SELECT/leestoegang via de publieke bucket-URL blijft
--    voorlopig ongewijzigd — zie het opleverrapport voor de expliciete
--    restrisico-melding en de aanbevolen vervolgstap (private bucket +
--    signed URLs, als apart, zorgvuldig te testen migratietraject).

-- Kleine, foutbestendige helper: geeft het eerste padsegment van een
-- Storage-object-pad terug als uuid, of NULL als dat segment geen geldige
-- uuid is (i.p.v. de hele policy-evaluatie te laten crashen op een
-- cast-fout bij een onverwacht pad).
create or replace function private.storage_first_segment_uuid(path text)
returns uuid
language plpgsql
stable
as $$
declare
  v_id uuid;
begin
  v_id := (storage.foldername(path))[1]::uuid;
  return v_id;
exception when others then
  return null;
end;
$$;

revoke execute on function private.storage_first_segment_uuid(text) from public, anon;
grant execute on function private.storage_first_segment_uuid(text) to authenticated;

-- ── r6-session-media ─────────────────────────────────────────────────────
drop policy if exists "r6-session-media: authenticated upload" on storage.objects;
drop policy if exists "r6-session-media: authenticated delete" on storage.objects;
drop policy if exists "r6-session-media: authenticated update" on storage.objects;
drop policy if exists "r6-session-media: public read" on storage.objects;

create policy "r6-session-media: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'r6-session-media');

create policy "r6-session-media: owner or r6_player upload to live session"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'r6-session-media'
    and private.is_r6_or_owner()
    and exists (
      select 1 from public.r6_sessions s
      where s.id = private.storage_first_segment_uuid(name)
        and s.status = 'live'
    )
  );

create policy "r6-session-media: owner or r6_player update in live session"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'r6-session-media'
    and private.is_r6_or_owner()
    and exists (
      select 1 from public.r6_sessions s
      where s.id = private.storage_first_segment_uuid(name)
        and s.status = 'live'
    )
  );

create policy "r6-session-media: owner or r6_player delete from live session"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'r6-session-media'
    and private.is_r6_or_owner()
    and exists (
      select 1 from public.r6_sessions s
      where s.id = private.storage_first_segment_uuid(name)
        and s.status = 'live'
    )
  );

-- ── growth-photos ────────────────────────────────────────────────────────
-- Zie de toelichting bovenaan dit bestand: alleen de schrijfkant wordt hier
-- owner-only afgesloten. De bucket blijft (voorlopig) `public = true` en de
-- publieke leesroute blijft dus openstaan — bekende, expliciet gemelde
-- restrisico, geen stilzwijgende beperking.
drop policy if exists "growth-photos: authenticated upload" on storage.objects;
drop policy if exists "growth-photos: authenticated delete" on storage.objects;
drop policy if exists "growth-photos: authenticated update" on storage.objects;
-- "growth-photos: public read" blijft bewust ongewijzigd staan.

create policy "growth-photos: owner upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'growth-photos' and private.is_owner());

create policy "growth-photos: owner update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'growth-photos' and private.is_owner());

create policy "growth-photos: owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'growth-photos' and private.is_owner());
