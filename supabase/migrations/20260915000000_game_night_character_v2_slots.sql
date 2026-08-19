-- Game Night — uitbreiding van de character-architectuur (nieuwe pixel-
-- art assetstandaard + vrouwelijke lichaamsvorm). Volledig additief:
-- bestaande rijen/migraties blijven ongewijzigd, dit bestand verbreedt
-- alleen de bestaande allowlists en voegt nieuwe, nullable kolommen toe.
--
-- ── Slots (9→17, additief) ────────────────────────────────────────────────
-- De oude 8 slots (base/face/hair/outfit/headwear/accessory/effect/badge,
-- 20260914000000) blijven VOLLEDIG geldig — bestaande V2.9B-starterdata
-- breekt niet. Nieuw toegevoegd: clothing (opvolger van outfit), eyes/
-- eyebrows/mouth (opsplitsing van het oude "face"), facial-hair, glasses
-- (specifieke opvolger van "accessory"), arms, props, foreground-effects
-- (opvolger naast het bestaande "effect", dat nu conceptueel de
-- achtergrond-variant is). "outfit"/"face"/"accessory" NIET verwijderd —
-- nieuwe catalogusdata gebruikt de nieuwe namen, oude rijen blijven
-- gewoon renderen via dezelfde resolvePlayerCharacter()-logica.
do $$
begin
  alter table public.game_night_character_parts
    drop constraint if exists game_night_character_parts_slot_check;
  alter table public.game_night_character_parts
    add constraint game_night_character_parts_slot_check
    check (slot in (
      -- bestaand (V2.9B, 20260914000000) — ongewijzigd geldig
      'base', 'face', 'hair', 'outfit', 'headwear', 'accessory', 'effect', 'badge',
      -- nieuw (deze migratie)
      'clothing', 'eyes', 'eyebrows', 'mouth', 'facial-hair', 'glasses',
      'arms', 'props', 'foreground-effects'
    ));
end $$;

-- ── Vrouwelijke lichaamsvorm ────────────────────────────────────────────
--
-- `body_shape` op game_night_players: structurele spelerseigenschap (net
-- als character_id/color_id), GEEN cosmetisch/unlockable item — daarom
-- direct op de spelerrij, niet in de parts-catalogus. Alleen relevant
-- voor een female-base-keuze; bij male/geen base blijft dit null en heeft
-- het geen render-effect. Bestaande spelers zonder waarde vallen op
-- applicatieniveau terug op 'medium' (bodyShape ?? "medium"), hier bewust
-- GEEN kolomdefault die dat verhult — expliciet null totdat een speler
-- zelf kiest, zodat "nog geen bewuste keuze" en "koos medium" onderscheidbaar
-- blijven voor toekomstige analyse.
alter table public.game_night_players
  add column if not exists body_shape text;

comment on column public.game_night_players.body_shape is
  'Structurele lichaamsbouw-keuze voor een female base (small/medium/large) — geen cosmetisch item, geen unlock. Null = nog geen keuze; de applicatielaag valt dan terug op "medium" (bodyShape ?? "medium"). Voor male-bases niet van toepassing.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_night_players_body_shape_check'
      and conrelid = 'public.game_night_players'::regclass
  ) then
    alter table public.game_night_players
      add constraint game_night_players_body_shape_check
      check (body_shape is null or body_shape in ('small', 'medium', 'large'));
  end if;
end $$;

-- ── Lichaamsvorm-varianten op catalogus-items ────────────────────────────
--
-- Twee gebruiken (sectie "architectuur" van de opdracht):
-- 1. BASE-rijen: `body_shape` direct gezet (bv. de female-medium-base-rij
--    heeft body_shape='medium') — dit maakt van elke lichaamsvorm een
--    eigen, apart selecteerbaar catalogus-item/tegel (precies wat gevraagd
--    is: 3 zichtbare keuzes onder "Lichaamsbouw").
-- 2. CLOTHING/ARMS-rijen die op MEERDERE lichaamsvormen moeten passen:
--    `body_shape` blijft null (het is geen apart-selecteerbaar item), en
--    `body_shape_variants` (jsonb, vorm { small?, medium?, large?: asset_path })
--    bepaalt welk bestand daadwerkelijk gerenderd wordt voor de HUIDIGE
--    bodyShape van de speler — één "Groene hoodie"-tegel in de UI, de
--    renderer kiest zelf de juiste laag (zie resolveBodyShapeAssetPath()
--    in gameNightCharacter.ts). Een ontbrekende sleutel in deze map
--    betekent needs_asset_revision voor die combinatie; de resolver valt
--    dan terug op de 'medium'-variant (en anders op de basis-asset_path)
--    zodat kleding nooit stilzwijgend verdwijnt.
alter table public.game_night_character_parts
  add column if not exists body_shape text,
  add column if not exists body_shape_variants jsonb;

comment on column public.game_night_character_parts.body_shape is
  'Alleen gezet op BASE-rijen die zelf een aparte, direct selecteerbare lichaamsvorm-tegel zijn (bv. de 3 female bases). Null voor alle andere rijen, inclusief kleding/arm-items die via body_shape_variants meerdere vormen ondersteunen.';
comment on column public.game_night_character_parts.body_shape_variants is
  'Optioneel: {"small"?: asset_path, "medium"?: asset_path, "large"?: asset_path} voor kleding/arm-items die per lichaamsvorm een andere pasvorm nodig hebben, terwijl de speler in de UI nog altijd maar ÉÉN tegel kiest (bv. "Groene hoodie"). Ontbrekende sleutel = needs_asset_revision voor die vorm; de resolver valt terug op medium, dan op asset_path.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_night_character_parts_body_shape_check'
      and conrelid = 'public.game_night_character_parts'::regclass
  ) then
    alter table public.game_night_character_parts
      add constraint game_night_character_parts_body_shape_check
      check (body_shape is null or body_shape in ('small', 'medium', 'large'));
  end if;
end $$;

-- ── Pose/prop-compatibiliteit ────────────────────────────────────────────
--
-- Een prop (bv. een mok) mag nooit los "zweven" voor het character —
-- dezelfde speler-keuze moet automatisch de bijpassende arm/hand-laag
-- selecteren. `pose_key` op een `arms`-rij is de stabiele identifier;
-- `requires_pose_key` op een `props`-rij verwijst ernaar. Bewust GEEN
-- foreign key naar (key,slot): props/arms worden onafhankelijk geseed en
-- een prop mag best tijdelijk verwijzen naar een pose_key die nog niet
-- (meer) bestaat zonder de seed-insert te laten falen — de resolver
-- (resolveCompatibleArmsLayer() in gameNightCharacter.ts) valt dan simpelweg
-- terug op "geen arm-laag tonen", nooit een crash.
alter table public.game_night_character_parts
  add column if not exists pose_key text,
  add column if not exists requires_pose_key text;

comment on column public.game_night_character_parts.pose_key is
  'Alleen gezet op een `arms`-rij: stabiele identifier waarnaar een props-rij via requires_pose_key kan verwijzen (bv. "pose-hold-mug").';
comment on column public.game_night_character_parts.requires_pose_key is
  'Alleen gezet op een `props`-rij die een specifieke arm/hand-laag vereist (bv. prop-mug-01 → "pose-hold-mug"). Null = decoratieve, pose-onafhankelijke prop.';
