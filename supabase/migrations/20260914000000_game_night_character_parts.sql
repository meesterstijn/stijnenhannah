-- Game Night V2.9B — datamodelfundament voor de modulaire Character
-- Creator (opdracht sectie 2/3). Vervangt NIET de bestaande
-- game_night_players.character_id (12 vaste presets, V2.8/V2.9) — die
-- kolom blijft ongewijzigd bestaan als legacy-fallback (sectie 8, zie het
-- opleverrapport). Dit is de eerste van vier additieve migraties:
--   1. 20260914000000 (dit bestand) — catalogus: game_night_character_parts
--   2. 20260914010000 — unlocks + equipment (relationeel, geen kolommen op
--      game_night_players)
--   3. 20260914020000 — equip/unequip RPC's (server-side gecontroleerd)
--   4. 20260914030000 — starterset-seed-data
--
-- ── Slots (sectie 2/3) — vaste allowlist, geen vrije tekst ───────────────
-- "base" bewust NIET opgesplitst in aparte body/skin-slots (sectie 2: "maak
-- het niet onnodig ingewikkeld") — een base-part IS de combinatie van
-- lichaam+huidtint als één samenhangende laag. Een latere fase kan een
-- nieuwe slotwaarde toevoegen (bv. 'skin') zonder deze kolom te hoeven
-- migreren, de CHECK-constraint is puur additief uit te breiden.
--
-- ── layer_order (sectie 2/10) ─────────────────────────────────────────────
-- Staat PER PART (niet afgeleid van slot) zodat dezelfde slot bij
-- uitzondering op twee verschillende dieptes kan renderen (bv. een
-- toekomstig "effect"-part dat ACHTER de base moet liggen naast een ander
-- effect-part dat ERVOOR moet liggen) — de opdracht noemt dit expliciet
-- ("effect achter... badge/effect voor"). Aanbevolen standaardbanden voor
-- nieuwe parts (niet database-afgedwongen, puur conventie):
--   effect(achter)=10, base=20, outfit=30, face=40, hair=50, headwear=60,
--   accessory=70, badge=80.
--
-- ── Bewust WEGGELaten velden (YAGNI-toets, sectie 3) ──────────────────────
-- - preview_asset_path: een aparte thumbnail-crop heeft nu geen functioneel
--   doel — de selector kan dezelfde 512×512-asset gewoon verkleind tonen.
--   Toevoegen zodra een creator-UI een écht andere preview-framing nodig
--   heeft (V2.9C+).
-- - metadata jsonb: er is nu geen concreet gebruik (unlock-herkomstdata
--   staat straks op de unlocks-tabel, niet hier) — een ongebruikte jsonb-kolom
--   is stille complexiteit zonder consument. Makkelijk additief toe te voegen
--   zodra er een echte usecase is.
-- - rarity ipv is_starter (of andersom): BEIDE opgenomen, bewust ontkoppeld
--   (zie hieronder) — "hoe een speler dit gratis krijgt bij aanmelden" is een
--   ander concept dan "hoe bijzonder dit cosmetisch oogt".

create table public.game_night_character_parts (
  id uuid primary key default gen_random_uuid(),
  -- Stabiele, mens-leesbare sleutel (asset-bestandsnaam-vriendelijk) — de
  -- kolom die code/seeds naar verwijzen, `id` is puur het opslag-PK.
  key text not null,
  slot text not null,
  label text not null,
  asset_path text not null,
  layer_order integer not null,
  -- Zie het "bewust WEGGELaten velden"-commentaar hierboven voor de
  -- motivatie om is_starter en rarity ALS TWEE APARTE VELDEN te houden.
  is_starter boolean not null default false,
  rarity text not null default 'common',
  active boolean not null default true,
  -- Weergavevolgorde BINNEN een slot in een toekomstige selector-UI — een
  -- ander concept dan layer_order (dat bepaalt de Z-stacking bij het
  -- RENDEREN van een samengesteld character, niet de keuzevolgorde).
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.game_night_character_parts is
  'V2.9B: catalogus van alle beschikbare character-cosmetics (base/face/hair/outfit/headwear/accessory/effect/badge). Eigendom/unlock-status staat NIET hier, zie game_night_player_character_unlocks/-equipment.';
comment on column public.game_night_character_parts.key is
  'Stabiele identifier, bv. "base-default-01" — matcht de asset-bestandsnaamconventie (zie public/game-night/characters/parts/README.md), gebruikt door seeds/verificatiequeries.';
comment on column public.game_night_character_parts.layer_order is
  'Z-stacking-positie bij het renderen van een samengesteld character (lager = verder naar achteren) — PER PART, niet afgeleid van slot, zodat dezelfde slot op twee verschillende dieptes kan renderen.';
comment on column public.game_night_character_parts.is_starter is
  'true = elke speler heeft dit impliciet unlocked, ook zonder rij in game_night_player_character_unlocks (zie getStarterParts()/canEquipPart() in gameNightCharacter.ts en de equip-RPC). Ontkoppeld van rarity: een starter-item kan alsnog als "common" of desgewenst bijzonderder gelabeld worden.';
comment on column public.game_night_character_parts.rarity is
  'Puur presentationeel (toekomstige visuele styling in de creator-UI, bv. rand-/glow-kleur) — geen enkele functionele/unlock-betekenis in V2.9B.';

-- ── Slot-allowlist (zelfde patroon als arena_style/arena_symbol, sectie 3) ──
alter table public.game_night_character_parts
  add constraint game_night_character_parts_slot_check
  check (slot in ('base', 'face', 'hair', 'outfit', 'headwear', 'accessory', 'effect', 'badge'));

alter table public.game_night_character_parts
  add constraint game_night_character_parts_rarity_check
  check (rarity in ('common', 'uncommon', 'rare', 'epic', 'special'));

alter table public.game_night_character_parts
  add constraint game_night_character_parts_key_unique unique (key);

-- Compound unique i.p.v. alleen op id (sectie 12/4): laat de equipment-
-- tabel straks een COMPOSIETE foreign key (part_id, slot) leggen, zodat de
-- database zelf garandeert dat een equipped part altijd in de zetel-slot
-- past — een defense-in-depth-invariant BOVENOP de RPC-validatie, niet in
-- plaats daarvan.
alter table public.game_night_character_parts
  add constraint game_night_character_parts_id_slot_unique unique (id, slot);

create index game_night_character_parts_slot_idx
  on public.game_night_character_parts (slot, sort_order)
  where active;

create trigger set_game_night_character_parts_updated_at
  before update on public.game_night_character_parts
  for each row execute function public.set_updated_at();

alter table public.game_night_character_parts enable row level security;

-- Owner: volledig beheer (activeren/deactiveren/toevoegen — sectie 13,
-- minimaal nu al mogelijk via directe tabeltoegang, geen apart RPC nodig
-- voor een owner-only CRUD-actie, zelfde afweging als bv. usePlayers.ts).
create policy "game_night_character_parts: owner only" on public.game_night_character_parts
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- Member: alleen ACTIEVE catalogus-items lezen (sectie 12 — "actieve
-- catalogus-items lezen" is met opzet het enige leesrecht van een member
-- op deze tabel; inactieve/uitgefaseerde parts zijn owner-only zichtbaar).
create policy "game_night_character_parts: member select active" on public.game_night_character_parts
  for select to authenticated
  using (private.is_game_night_member_or_owner() and active);

revoke all on public.game_night_character_parts from anon;
