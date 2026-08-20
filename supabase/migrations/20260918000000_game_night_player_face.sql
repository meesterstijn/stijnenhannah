-- Game Night — persoonlijke face-layer (selfie/crop/upload-flow). Het
-- eigen gezicht van de speler wordt vanaf nu de identiteitslaag van het
-- character, boven op de bestaande Photoshop-character-infrastructuur
-- (game_night_character_parts/unlocks/equipment blijven ongewijzigd en
-- volledig functioneel — dit bestand voegt uitsluitend NIEUWE, optionele
-- velden toe aan game_night_players, plus een eigen self-service-RPC en
-- storage-bucket).
--
-- Drie nieuwe, nullable kolommen — geen enkele bestaande kolom aangeraakt:
--   face_original_path: storage-pad van de ORIGINELE (alleen grootte-
--     beperkte, nog niet gecropte) selfie — bewaard zodat cropping/
--     toekomstige achtergrondverwijdering later herhaald kan worden zonder
--     dat de speler opnieuw een foto hoeft te maken/kiezen.
--   face_asset_path: storage-pad van de AFGELEIDE, canonieke 512×512-
--     face-laag — dit is de afbeelding die CharacterVisual daadwerkelijk
--     rendert.
--   face_crop: jsonb met de croppixel-rechthoek uit het ORIGINEEL
--     (sourceX/sourceY/sourceWidth/sourceHeight) — genoeg om face_asset
--     opnieuw te genereren vanuit face_original zonder de croppositionering
--     te verliezen, mocht de exportpipeline later verbeteren (bv. met
--     echte achtergrondverwijdering).
--
-- Net als character_id/body_shape hiervoor: NULL = nog geen face ingesteld,
-- de applicatielaag (CharacterVisual/resolvePlayerCharacter) valt dan
-- gewoon terug op het bestaande modulaire/legacy/leeg-gedrag — bestaande
-- spelers zonder face lopen dus nergens vast.
alter table public.game_night_players
  add column if not exists face_original_path text,
  add column if not exists face_asset_path text,
  add column if not exists face_crop jsonb;

comment on column public.game_night_players.face_original_path is
  'Storage-pad (bucket game-night-player-faces) van de originele, alleen grootte-beperkte selfie. Null = nog geen foto aangeleverd. Bewaard voor toekomstige herverwerking (bv. echte achtergrondverwijdering) zonder dat de speler opnieuw hoeft te fotograferen.';
comment on column public.game_night_players.face_asset_path is
  'Storage-pad (bucket game-night-player-faces) van de afgeleide, canonieke 512x512 face-laag die CharacterVisual rendert. Null = nog geen face ingesteld; de applicatielaag valt dan terug op modulaire equipment/legacy character_id/initiaal, zie resolvePlayerCharacter() in gameNightCharacter.ts.';
comment on column public.game_night_players.face_crop is
  'Cropmetadata uit het origineel, vorm {"sourceX": number, "sourceY": number, "sourceWidth": number, "sourceHeight": number} (pixels binnen face_original) — genoeg om face_asset later opnieuw te genereren vanuit face_original. Null zolang er geen face is ingesteld.';

-- Geen nieuwe RLS-policy nodig: "game_night_players: member select" (al
-- bestaand, 20260912160000) dekt lezen van deze nieuwe kolommen voor alle
-- leden al (nodig zodat ieders face-laag overal gerenderd kan worden, zoals
-- nu al met character_id/equipment het geval is). Net als alle overige
-- zelf-service-velden op deze tabel is er GEEN directe member-UPDATE-grant
-- — schrijven kan uitsluitend via de SECURITY DEFINER-RPC hieronder, zelfde
-- grens als game_night_update_my_profile (20260912150000).

-- ── Self-service RPC: eigen face bijwerken ────────────────────────────────
-- Een eigen, aparte RPC i.p.v. game_night_update_my_profile verder uit te
-- breiden (net als bij character_id/body_shape voorheen): face-opslag is
-- functioneel een ander moment/flow (na foto-upload naar Storage, niet
-- samen met nickname/kleur) en zou die RPC's al 4 optionele parameters
-- alleen maar verder laten groeien zonder duidelijk voordeel.
--
-- p_face_original_path/p_face_asset_path mogen NIET los van elkaar null
-- zijn: een geldige face heeft altijd beide bestanden, en "face wissen"
-- (bv. bij een mislukte upload die alsnog wil resetten) gebeurt door BEIDE
-- expliciet null mee te geven — nooit een half-opgeslagen face-staat.
create or replace function public.game_night_update_my_face(
  p_face_original_path text,
  p_face_asset_path text,
  p_face_crop jsonb default null
)
returns public.game_night_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.game_night_players;
begin
  if not private.is_game_night_member_or_owner() then
    raise exception 'Geen toegang tot Game Night' using errcode = '42501';
  end if;

  if (p_face_original_path is null) <> (p_face_asset_path is null) then
    raise exception 'face_original_path en face_asset_path moeten samen gezet of samen leeg zijn'
      using errcode = '22023';
  end if;

  select * into v_player
  from public.game_night_players
  where auth_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Geen gekoppeld spelersprofiel voor dit account'
      using errcode = '22023';
  end if;

  update public.game_night_players
  set face_original_path = p_face_original_path,
      face_asset_path = p_face_asset_path,
      face_crop = p_face_crop
  where id = v_player.id
  returning * into v_player;

  return v_player;
end;
$$;

revoke execute on function public.game_night_update_my_face(text, text, jsonb)
  from public, anon;
grant execute on function public.game_night_update_my_face(text, text, jsonb)
  to authenticated;

-- ── Storage: player-faces ─────────────────────────────────────────────────
-- Pad: <player_id>/original.<ext> en <player_id>/face.<ext> — platte
-- structuur, zelfde conventie als growth-photos/cocktail-photos/
-- game-night-checkpoints: private.storage_first_segment_uuid() toetst het
-- eerste padsegment rechtstreeks aan een bestaande player-rij.
--
-- PRIVÉ (herzien t.o.v. de eerste versie van dit -nog nooit uitgevoerde-
-- bestand, dat hier ten onrechte "publiek" koos): dit zijn echte selfies
-- van echte spelers, geen cosmetische game-art zoals growth-photos/
-- cocktail-photos — daarom hier bewust WEL hetzelfde privacy-model als
-- game-night-checkpoints (20260912090000: "kaarten-op-hand hoort niet
-- publiek bereikbaar te zijn, ook al is het pad met een UUID technisch
-- moeilijk te raden"). Lezen kan alleen via een getekende URL, voor elk
-- Game Night-lid (niet uitsluitend owner, i.t.t. checkpoints — een face is
-- immers wél bedoeld om door alle leden gezien te worden in Lobby/Arena/
-- profielen, alleen niet door de buitenwereld). CharacterVisual.tsx lost
-- dit synchroon-blijvende-renderprobleem op via een kleine, losse
-- useSignedFaceUrl()-hook die uitsluitend de "personal-face"-laag raakt —
-- alle overige (publieke, statische) character-lagen blijven ongewijzigd
-- direct via hun pad renderen.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-night-player-faces', 'game-night-player-faces', false, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- `drop policy if exists` vóór elke `create policy` hieronder (zelfde
-- idempotente patroon als overal elders in dit project, bv.
-- owner_only_lockdown.sql): dit bestand bleek bij een eerdere poging
-- gedeeltelijk te zijn uitgevoerd (sommige policies bestonden al op live),
-- waardoor een kale `create policy` op "already exists" liep. Puur een
-- heruitvoerbaarheidsfix — de policy-namen/-logica zijn ongewijzigd.
drop policy if exists "game-night-player-faces: member read" on storage.objects;
create policy "game-night-player-faces: member read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'game-night-player-faces'
    and private.is_game_night_member_or_owner()
  );

-- Zelf-service (i.t.t. checkpoints, waar alleen de OWNER schrijft): een
-- speler beheert zijn EIGEN face-map, owner mag daarnaast elke speler
-- beheren (zelfde bevoegdheid als overal elders in Game Night).
drop policy if exists "game-night-player-faces: self or owner upload" on storage.objects;
create policy "game-night-player-faces: self or owner upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'game-night-player-faces'
    and (
      private.is_owner()
      or exists (
        select 1 from public.game_night_players p
        where p.id = private.storage_first_segment_uuid(objects.name)
          and p.auth_user_id = auth.uid()
      )
    )
  );

drop policy if exists "game-night-player-faces: self or owner update" on storage.objects;
create policy "game-night-player-faces: self or owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'game-night-player-faces'
    and (
      private.is_owner()
      or exists (
        select 1 from public.game_night_players p
        where p.id = private.storage_first_segment_uuid(objects.name)
          and p.auth_user_id = auth.uid()
      )
    )
  );

drop policy if exists "game-night-player-faces: self or owner delete" on storage.objects;
create policy "game-night-player-faces: self or owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'game-night-player-faces'
    and (
      private.is_owner()
      or exists (
        select 1 from public.game_night_players p
        where p.id = private.storage_first_segment_uuid(objects.name)
          and p.auth_user_id = auth.uid()
      )
    )
  );

-- Handmatige controle na het draaien van deze migratie:
--
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'game_night_players'
--   and column_name in ('face_original_path', 'face_asset_path', 'face_crop');
--
-- select proname, pg_get_function_identity_arguments(oid)
-- from pg_proc
-- where proname = 'game_night_update_my_face';
--
-- select id, public, file_size_limit, allowed_mime_types
-- from storage.buckets where id = 'game-night-player-faces';
