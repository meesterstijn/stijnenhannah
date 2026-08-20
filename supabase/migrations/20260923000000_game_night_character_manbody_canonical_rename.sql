-- Game Night — eenmalige, additieve remap van legacy `body-manbody-*`
-- catalogus-rijen naar de nieuwe canonical `body-man-<N>`-keys.
--
-- Aanleiding: de assetdiscovery-pijplijn (scripts/generate-custom-body-
-- manifest.mjs) gaat vanaf nu uit van `body-man-<slug>.png`/
-- `body-vrouw-<slug>.png` i.p.v. het oude, gender-loze `manbody<N>.png`.
-- De fysieke PNG's zijn al hernoemd (bv. manbody13.png -> body-man-13.png,
-- geen pixel gewijzigd, alleen bestandsnaam) — deze migratie brengt de
-- database in lijn zonder een speler zijn huidige body te laten verliezen.
--
-- Waarom een APARTE, timestamped migratie i.p.v. alleen de doorlopend
-- gegenereerde SQL (supabase/generated/game_night_custom_bodies.sql):
-- bestaande `game_night_player_character_equipment`/`..._unlocks`-rijen
-- kunnen al naar een legacy part_id verwijzen. Dat remappen is een
-- eenmalige, historisch-gevoelige operatie — de gegenereerde SQL is
-- bewust altijd herschrijfbaar/opnieuw-toepasbaar en mag daarom nooit
-- zulke ordening-/historiegevoelige logica bevatten. Vanaf deze migratie
-- upsert de gegenereerde SQL uitsluitend nog canonical `body-man-*`/
-- `body-vrouw-*`-rijen (zie de nieuwe scope-comment in het script) en
-- raakt legacy `body-manbody-*`-rijen nooit meer aan.
--
-- Werkwijze per gevonden legacy-rij (key ~ '^body-manbody-\d+$', slot
-- 'base', nog actief):
--   1. canonical key/asset_path afleiden: body-manbody-13 -> body-man-13
--      (voorloopnullen verdwijnen, matcht exact de al-toegepaste
--      bestandshernoeming). Label opnieuw afgeleid volgens de "Man <N>"-
--      conventie (zelfde regel als de generator voor een puur-numerieke
--      fallback-slug).
--   2. canonical rij aanmaken ALS die nog niet bestaat (idempotent) — mocht
--      de gegenereerde SQL 'm al eerder hebben aangemaakt (bv. omdat de
--      PNG al hernoemd was vóór deze migratie werd toegepast), dan wordt
--      die bestaande rij hergebruikt i.p.v. een duplicate te proberen
--      aan te maken.
--   3. equipment-rijen die naar de LEGACY part_id wijzen: part_id wordt
--      bijgewerkt naar de canonical part_id via UPDATE (geen delete+
--      insert) — dezelfde (player_id, slot)-rij blijft gewoon bestaan,
--      een speler ziet dus zonder enige actie exact dezelfde artwork
--      (canonical asset_path wijst naar het fysiek hernoemde, byte-
--      identieke PNG). Defensief tegen het (door de primary key eigenlijk
--      onmogelijke) geval dat er voor diezelfde (player_id, slot) al een
--      rij naar de canonical part_id bestaat: dan wordt de overbodige
--      legacy-equipment-rij verwijderd i.p.v. de UPDATE te laten botsen op
--      de primary key.
--   4. unlock-rijen die naar de LEGACY part_id wijzen: zelfde aanpak,
--      remappen naar de canonical part_id, met een ON CONFLICT DO NOTHING-
--      veilige route voor het (eveneens onwaarschijnlijke) geval dat een
--      speler al een unlock-rij voor de canonical key heeft.
--   5. de legacy-rij zelf: `active = false`. NOOIT hard deleted — blijft
--      als inactief historisch artefact staan, precies dezelfde soft-
--      delete-conventie als de rest van de app.
--
-- Idempotent: de FOR-loop selecteert alleen `active = true`-legacy-rijen,
-- dus een tweede run na een voltooide eerste run vindt niets meer om te
-- verwerken. Een run die halverwege onderbroken raakte (bv. na stap 3 maar
-- vóór stap 5) is bij een volgende run alsnog veilig: canonical rij bestaat
-- al (stap 2 hergebruikt 'm), equipment/unlocks die al geremapt zijn worden
-- niet nogmaals geraakt (de UPDATE-WHERE-clausules matchen dan simpelweg
-- niets meer), en stap 5 zet `active = false` alsnog.
--
-- Scope: uitsluitend rijen met key ~ '^body-manbody-\d+$' en slot = 'base'.
-- Raakt geen andere slots, geen andere starter-rijen, geen andere
-- catalogus-onderdelen.

do $$
declare
  rec record;
  v_number int;
  v_new_key text;
  v_new_label text;
  v_new_asset_path text;
  v_new_part_id uuid;
begin
  for rec in
    select id, key, slot, layer_order, is_starter, rarity, active, sort_order
    from public.game_night_character_parts
    where slot = 'base'
      and active = true
      and key ~ '^body-manbody-\d+$'
    order by sort_order
  loop
    v_number := (regexp_match(rec.key, '^body-manbody-0*(\d+)$'))[1]::int;
    v_new_key := 'body-man-' || v_number::text;
    v_new_label := 'Man ' || v_number::text;
    v_new_asset_path :=
      '/game-night/characters/parts/custom/base/body-man-' || v_number::text || '.png';

    -- Stap 2: canonical rij aanmaken, of hergebruiken als 'm al bestaat
    -- (bv. omdat de gegenereerde SQL al vóór deze migratie is toegepast op
    -- een al-hernoemd bestand).
    select id into v_new_part_id
    from public.game_night_character_parts
    where key = v_new_key;

    if v_new_part_id is null then
      insert into public.game_night_character_parts
        (key, slot, label, asset_path, layer_order, is_starter, rarity, active, sort_order)
      values
        (v_new_key, rec.slot, v_new_label, v_new_asset_path, rec.layer_order,
         rec.is_starter, rec.rarity, true, v_number)
      returning id into v_new_part_id;
    end if;

    -- Stap 3: equipment remappen (UPDATE, geen delete+insert). Eerst de
    -- overbodige rij opruimen voor het (via de primary key eigenlijk
    -- onmogelijke) geval dat dezelfde speler al een equipment-rij voor de
    -- canonical part_id heeft, zodat de UPDATE nooit op de
    -- (player_id, slot)-primary-key kan botsen.
    delete from public.game_night_player_character_equipment old_eq
    where old_eq.part_id = rec.id
      and exists (
        select 1 from public.game_night_player_character_equipment new_eq
        where new_eq.player_id = old_eq.player_id
          and new_eq.slot = old_eq.slot
          and new_eq.part_id = v_new_part_id
      );

    update public.game_night_player_character_equipment
    set part_id = v_new_part_id
    where part_id = rec.id;

    -- Stap 4: unlocks remappen. Verplaats elke legacy-unlock-rij naar de
    -- canonical part_id; als de speler die al heeft (ON CONFLICT DO
    -- NOTHING op de (player_id, part_id)-primary-key), laat de nieuwe
    -- rij met rust en verwijder alleen de overbodige legacy-rij.
    insert into public.game_night_player_character_unlocks
      (player_id, part_id, unlocked_at, source, source_ref)
    select player_id, v_new_part_id, unlocked_at, source, source_ref
    from public.game_night_player_character_unlocks
    where part_id = rec.id
    on conflict (player_id, part_id) do nothing;

    delete from public.game_night_player_character_unlocks
    where part_id = rec.id;

    -- Stap 5: legacy-rij deactiveren, nooit hard deleten.
    update public.game_night_character_parts
    set active = false
    where id = rec.id;
  end loop;
end $$;

-- Handmatige controle na het draaien van deze migratie:
--
-- select key, label, active, sort_order from public.game_night_character_parts
-- where key like 'body-man-%' or key like 'body-manbody-%'
-- order by sort_order;
-- -- verwacht: alle 'body-manbody-%'-rijen active=false, een 'body-man-<N>'-
-- -- rij per voorheen-actieve legacy-rij, active=true.
--
-- select e.player_id, e.slot, p.key, p.active
-- from public.game_night_player_character_equipment e
-- join public.game_night_character_parts p on p.id = e.part_id
-- where p.key like 'body-man-%';
-- -- verwacht: elke speler die eerder een manbody-part droeg, wijst nu naar
-- -- de bijbehorende canonical body-man-<N>-rij (active=true).
