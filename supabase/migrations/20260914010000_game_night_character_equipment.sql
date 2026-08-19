-- Game Night V2.9B (2/4) — ownership/unlock-laag + equipped-laag (opdracht
-- sectie 4/5). Relationeel i.p.v. tientallen nullable kolommen op
-- game_night_players (sectie 4 expliciet) — twee tabellen, drie
-- verschillende vragen (sectie 5):
--   A. bestaat een onderdeel?            -> game_night_character_parts
--   B. heeft een speler het vrijgespeeld? -> game_night_player_character_unlocks
--   C. draagt een speler het NU?          -> game_night_player_character_equipment
--
-- ── ON DELETE-gedrag (sectie 4: "mag geen historie/spelerrecord slopen") ──
-- player_id -> ON DELETE CASCADE: als een SPELER ooit hard verwijderd wordt
--   (komt vandaag nergens voor — spelers worden altijd gearchiveerd, nooit
--   hard-deleted, zie game_night_players.archived_at), verdwijnen alleen
--   DIENS eigen unlock-/equipment-rijen mee. Raakt nooit WIN-historie of
--   andere spelers.
-- part_id -> ON DELETE CASCADE: een catalogus-item hoort ALTIJD via
--   `active = false` uitgefaseerd te worden (zelfde soft-delete-conventie
--   als de rest van de app), nooit hard verwijderd — maar ALS dat ooit
--   toch gebeurt, cascadeert dat naar de unlock-/equipment-rijen die ernaar
--   verwezen, nooit naar game_night_players of WIN-data (aparte tabellen).
--   Een speler verliest dan hooguit een leeg geworden slot, wat de
--   frontend al veilig afhandelt (resolvePlayerCharacter valt terug op
--   "geen laag voor dit slot", nooit een crash).

create table public.game_night_player_character_unlocks (
  player_id uuid not null references public.game_night_players(id) on delete cascade,
  part_id uuid not null references public.game_night_character_parts(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  -- Herkomst van de unlock (sectie 5) — bewust nog GEEN volledig
  -- achievement-systeem, alleen de allowlist die dat later kan voeden.
  -- 'starter' wordt in de praktijk NIET als rij hier opgeslagen (starter-
  -- items zijn impliciet unlocked via parts.is_starter, sectie 7) — toch
  -- opgenomen in de allowlist voor het geval een owner een starter-item
  -- ooit EXPLICIET aan één speler wil toekennen (bv. na een reset).
  source text not null,
  source_ref text,
  primary key (player_id, part_id)
);

comment on table public.game_night_player_character_unlocks is
  'V2.9B: "speler X heeft onderdeel Y vrijgespeeld" — puur eigendom, zegt niets over wat een speler NU draagt (zie ..._equipment). Starter-onderdelen (parts.is_starter) hebben normaliter GEEN rij hier nodig, zie getStarterParts()/canEquipPart().';
comment on column public.game_night_player_character_unlocks.source is
  'Herkomst van de unlock — allowlist bewust ruim genoeg voor toekomstige achievement-typen, geen enkele daarvan wordt in V2.9B daadwerkelijk toegekend behalve owner_grant (handmatig, sectie 13).';

alter table public.game_night_player_character_unlocks
  add constraint game_night_player_character_unlocks_source_check
  check (source in ('starter', 'wins', 'game_achievement', 'attendance', 'title', 'special', 'owner_grant'));

create index game_night_player_character_unlocks_player_idx
  on public.game_night_player_character_unlocks (player_id);

alter table public.game_night_player_character_unlocks enable row level security;

-- Owner: volledig beheer (handmatig unlocks toekennen, sectie 5/13).
create policy "game_night_player_character_unlocks: owner only" on public.game_night_player_character_unlocks
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- Member: uitsluitend de EIGEN unlocks lezen (sectie 12: "zijn eigen
-- unlocked onderdelen lezen") — bewust GEEN "member select all"-policy
-- zoals de sociale statistiektabellen: wat een speler heeft vrijgespeeld is
-- geen gedeelde Game Night-data, en is voor het RENDEREN van andere
-- spelers (Arena/Lobby) ook niet nodig — alleen EQUIPPED items moeten voor
-- iedereen zichtbaar zijn, zie de policy op ..._equipment hieronder.
create policy "game_night_player_character_unlocks: member select own" on public.game_night_player_character_unlocks
  for select to authenticated
  using (
    private.is_owner()
    or player_id in (
      select id from public.game_night_players where auth_user_id = auth.uid()
    )
  );

revoke all on public.game_night_player_character_unlocks from anon;

-- ── Equipped-laag ─────────────────────────────────────────────────────────

create table public.game_night_player_character_equipment (
  player_id uuid not null references public.game_night_players(id) on delete cascade,
  slot text not null,
  part_id uuid not null references public.game_night_character_parts(id) on delete cascade,
  equipped_at timestamptz not null default now(),
  primary key (player_id, slot),
  -- Defense-in-depth (sectie 4/12): garandeert op databaseniveau dat een
  -- equipped part.slot altijd overeenkomt met de slot-kolom van deze rij —
  -- bovenop, niet in plaats van, de RPC-validatie hieronder.
  constraint game_night_player_character_equipment_part_slot_fk
    foreign key (part_id, slot) references public.game_night_character_parts(id, slot)
);

comment on table public.game_night_player_character_equipment is
  'V2.9B: "speler X draagt NU onderdeel Y in slot Z" — precies één rij per (speler, slot) dankzij de primary key. Uitsluitend schrijfbaar via de equip/unequip-RPC''s (20260914020000) — geen directe INSERT/UPDATE/DELETE-policy voor members, zie hieronder.';

alter table public.game_night_player_character_equipment
  add constraint game_night_player_character_equipment_slot_check
  check (slot in ('base', 'face', 'hair', 'outfit', 'headwear', 'accessory', 'effect', 'badge'));

alter table public.game_night_player_character_equipment enable row level security;

-- Owner: volledig beheer (sectie 13: equipment van een speler kunnen
-- bekijken/corrigeren).
create policy "game_night_player_character_equipment: owner only" on public.game_night_player_character_equipment
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- Member: EQUIPPED items van ALLE spelers lezen (bewust WEL "member select
-- all", in tegenstelling tot de unlocks-tabel hierboven) — nodig om straks
-- andermans samengestelde character te kunnen renderen in Lobby/Arena/
-- profielen (sectie 14), niet alleen de eigen. Geen INSERT/UPDATE/DELETE-
-- policy voor members — server-side equippen loopt uitsluitend via de
-- SECURITY DEFINER-RPC's in 20260914020000 (sectie 12: "niet vertrouwen op
-- de frontend").
create policy "game_night_player_character_equipment: member select" on public.game_night_player_character_equipment
  for select to authenticated
  using (private.is_game_night_member_or_owner());

revoke all on public.game_night_player_character_equipment from anon;
