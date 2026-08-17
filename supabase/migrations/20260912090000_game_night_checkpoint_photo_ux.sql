-- Game Night — Checkpoint Camera & Foto UX. Additief op de negen bestaande
-- Game Night-migraties.

-- ── Wie staat er op de foto? (sectie 19) ──────────────────────────────────
-- Optioneel, alleen zinvol bij photo_type 'cards'/'player', maar niet
-- afgedwongen op databaseniveau (de UI biedt "Geen specifieke speler" aan
-- voor elk type). `restrict`: dezelfde reden als overal elders in Game
-- Night — een speler met historie (hier: foto's) mag nooit stilletjes
-- verdwijnen; archiveren (game_night_players.archived_at) is de juiste weg.
alter table public.game_night_checkpoint_photos
  add column if not exists player_id uuid references public.game_night_players(id) on delete restrict;

create index if not exists game_night_checkpoint_photos_player_idx
  on public.game_night_checkpoint_photos (player_id)
  where player_id is not null;

-- ── Tijdens welke ronde is dit checkpoint gemaakt? (sectie 33) ───────────
-- Puur context/metadata ("Opgeslagen tijdens Ronde 4") — het checkpoint
-- blijft primair aan de spelsessie gekoppeld (game_session_id), dit is een
-- optionele extra verwijzing. `set null` i.p.v. `restrict`: rondes worden
-- in de huidige architectuur nooit verwijderd, maar mocht dat ooit gebeuren
-- dan moet het checkpoint zelf (met zijn foto's) gewoon blijven bestaan.
alter table public.game_night_checkpoints
  add column if not exists round_id uuid references public.game_night_rounds(id) on delete set null;

create index if not exists game_night_checkpoints_round_idx
  on public.game_night_checkpoints (round_id)
  where round_id is not null;

-- ── RPC: checkpoint aanmaken met server-side naamgeving ───────────────────
-- Sectie 32: "Stand N" moet uit de database komen, niet uit een
-- racegevoelige client-only telling. Rij-lock op de spelsessie serialiseert
-- gelijktijdige aanroepen voor dezelfde sessie zodat twee snel na elkaar
-- aangemaakte checkpoints nooit hetzelfde automatische nummer krijgen.
create or replace function public.game_night_create_checkpoint(
  p_game_session_id uuid,
  p_title text,
  p_notes text,
  p_round_id uuid default null
)
returns public.game_night_checkpoints
language plpgsql
as $$
declare
  v_count integer;
  v_title text;
  v_checkpoint public.game_night_checkpoints;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Game Night'
      using errcode = '42501';
  end if;

  perform 1 from public.game_night_game_sessions
  where id = p_game_session_id
  for update;

  if not found then
    raise exception 'Spelsessie % niet gevonden', p_game_session_id;
  end if;

  v_title := nullif(trim(both from p_title), '');
  if v_title is null then
    select count(*) into v_count
    from public.game_night_checkpoints
    where game_session_id = p_game_session_id;
    v_title := 'Stand ' || (v_count + 1);
  end if;

  insert into public.game_night_checkpoints
    (game_session_id, title, notes, round_id, created_by)
  values (
    p_game_session_id,
    v_title,
    nullif(trim(both from p_notes), ''),
    p_round_id,
    auth.uid()
  )
  returning * into v_checkpoint;

  return v_checkpoint;
end;
$$;

revoke execute on function public.game_night_create_checkpoint(uuid, text, text, uuid)
  from public, anon;
grant execute on function public.game_night_create_checkpoint(uuid, text, text, uuid)
  to authenticated;

-- ── Bucket privacy (sectie 35/36) ─────────────────────────────────────────
-- Checkpointfoto's kunnen kaarten-op-hand tonen — dat hoort niet publiek
-- via een onbeveiligde URL bereikbaar te zijn, alleen omdat het pad met
-- willekeurige UUID's technisch moeilijk te raden is. Bucket gaat van
-- public naar private; lezen kan voortaan alleen via getekende URL's
-- (createSignedUrl, client-side), wat een geldige owner-sessie vereist —
-- exact hetzelfde owner-only model als de rest van Game Night, nu ook
-- toegepast op het LEZEN van deze specifieke foto's (upload/update/delete
-- waren al owner-only en blijven ongewijzigd).
update storage.buckets set public = false where id = 'game-night-checkpoints';

drop policy if exists "game-night-checkpoints: public read" on storage.objects;

create policy "game-night-checkpoints: owner read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'game-night-checkpoints' and private.is_owner());
