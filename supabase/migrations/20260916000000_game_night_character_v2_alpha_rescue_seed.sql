-- Game Night V2.9E-hersteltraject — "geen matting meer, alpha-kanaal is de
-- bron van waarheid". De vorige seed (20260915010000) markeerde haar (24),
-- wenkbrauwen (8) en gezichtsbeharing (6) volledig als needs_asset_revision
-- omdat de gebruikte kleurafstand-matting faalde op donkere/bruine content.
-- Bij nadere inspectie bleek de bron-PNG een volwaardig alpha-kanaal te
-- hebben (waarden 0 t/m 254, duidelijk bimodaal: ~58% vrijwel-transparante
-- achtergrond, ~33% vrijwel-ondoorzichtige sprite-content) — de sprites
-- waren dus al via transparantie geïsoleerd in de bron, geen kleurmatting
-- nodig. Op basis daarvan zijn deze drie categorieën opnieuw uitgesneden
-- (bbox-crop op alpha>drempel, GEEN pixelwijziging) en op het canonieke
-- 128×128-canvas gezet, uitgelijnd op de daadwerkelijke landmark-posities
-- van de al production-ready base/eyes/mouth-composites (head-top, eyes-
-- center, mouth-top) i.p.v. een naïeve bbox-center.
--
-- Bijkomende correctie t.o.v. de oorspronkelijke aanname: de brondata bevat
-- 26 bruikbare haar-sprites (niet 24 — "hair-medium" en "hair-long" bleken
-- bij precieze her-meting 7 kolommen te bevatten i.p.v. de aangenomen 3) en
-- 10 wenkbrauw-sprites (niet 8 — 5 rijen i.p.v. 4). Alle 26 haar-sprites
-- renderen visueel correct op ZOWEL base-male-01 als base-female-medium
-- (bevestigd via nieuwe QA-contactsheets) en zijn daarom NIET gender-locked
-- — de bestaande architectuur kende toch al geen gender-restrictie per
-- slot, dus geen schemawijziging nodig om dit mogelijk te maken.
--
-- Huidskleur (12 stuks) is WEL opnieuw succesvol uitgesneden, maar NIET in
-- deze seed opgenomen: de bron-crop bevat alleen hoofd+nek (geen
-- schouders), terwijl de bestaande base-architectuur kleding/effecten
-- ankert op de VOLLEDIGE buste-silhouet van base-male-01/base-female-
-- medium. Een directe 1-op-1-vervanging van de base zou een "zwevend
-- hoofd zonder lichaam" opleveren zodra kleding erover gerenderd wordt —
-- dat is geen bruikbare overlay binnen de bestaande architectuur, dus NIET
-- geforceerd (zie het opleverrapport voor de aanbevolen vervolgstap).
--
-- `on conflict (key) do nothing`: heruitvoerbaar, tast de bestaande 20260915010000-seed niet aan.

insert into public.game_night_character_parts
  (key, slot, label, asset_path, layer_order, is_starter, rarity, active, sort_order, body_shape, body_shape_variants, pose_key, requires_pose_key)
values

-- ── hair (26, gender-agnostisch — zie toelichting hierboven) ────────────
('hair-short-01', 'hair', 'Kort haar 1', '/game-night/characters/parts/v2/hair/hair-short-01.png', 50, true, 'common', true, 0, null, null, null, null),
('hair-short-02', 'hair', 'Kort haar 2', '/game-night/characters/parts/v2/hair/hair-short-02.png', 50, true, 'common', true, 1, null, null, null, null),
('hair-short-03', 'hair', 'Kort haar 3', '/game-night/characters/parts/v2/hair/hair-short-03.png', 50, true, 'common', true, 2, null, null, null, null),
('hair-short-04', 'hair', 'Kort haar 4', '/game-night/characters/parts/v2/hair/hair-short-04.png', 50, true, 'common', true, 3, null, null, null, null),
('hair-short-05', 'hair', 'Kort haar 5', '/game-night/characters/parts/v2/hair/hair-short-05.png', 50, true, 'common', true, 4, null, null, null, null),
('hair-short-06', 'hair', 'Kort haar 6', '/game-night/characters/parts/v2/hair/hair-short-06.png', 50, true, 'common', true, 5, null, null, null, null),
('hair-short-07', 'hair', 'Kort haar 7', '/game-night/characters/parts/v2/hair/hair-short-07.png', 50, true, 'common', true, 6, null, null, null, null),
('hair-short-08', 'hair', 'Kort haar 8', '/game-night/characters/parts/v2/hair/hair-short-08.png', 50, true, 'common', true, 7, null, null, null, null),
('hair-short-09', 'hair', 'Kort haar 9', '/game-night/characters/parts/v2/hair/hair-short-09.png', 50, true, 'common', true, 8, null, null, null, null),
('hair-short-10', 'hair', 'Kort haar 10', '/game-night/characters/parts/v2/hair/hair-short-10.png', 50, true, 'common', true, 9, null, null, null, null),
('hair-short-11', 'hair', 'Kort haar 11', '/game-night/characters/parts/v2/hair/hair-short-11.png', 50, true, 'common', true, 10, null, null, null, null),
('hair-short-12', 'hair', 'Kort haar 12', '/game-night/characters/parts/v2/hair/hair-short-12.png', 50, true, 'common', true, 11, null, null, null, null),
('hair-medium-01', 'hair', 'Halflang haar 1', '/game-night/characters/parts/v2/hair/hair-medium-01.png', 50, true, 'common', true, 12, null, null, null, null),
('hair-medium-02', 'hair', 'Halflang haar 2', '/game-night/characters/parts/v2/hair/hair-medium-02.png', 50, true, 'common', true, 13, null, null, null, null),
('hair-medium-03', 'hair', 'Halflang haar 3', '/game-night/characters/parts/v2/hair/hair-medium-03.png', 50, true, 'common', true, 14, null, null, null, null),
('hair-medium-04', 'hair', 'Halflang haar 4', '/game-night/characters/parts/v2/hair/hair-medium-04.png', 50, true, 'common', true, 15, null, null, null, null),
('hair-medium-05', 'hair', 'Halflang haar 5', '/game-night/characters/parts/v2/hair/hair-medium-05.png', 50, true, 'common', true, 16, null, null, null, null),
('hair-medium-06', 'hair', 'Halflang haar 6', '/game-night/characters/parts/v2/hair/hair-medium-06.png', 50, true, 'common', true, 17, null, null, null, null),
('hair-medium-07', 'hair', 'Halflang haar 7', '/game-night/characters/parts/v2/hair/hair-medium-07.png', 50, true, 'common', true, 18, null, null, null, null),
('hair-long-01', 'hair', 'Lang haar 1', '/game-night/characters/parts/v2/hair/hair-long-01.png', 50, true, 'common', true, 19, null, null, null, null),
('hair-long-02', 'hair', 'Lang haar 2', '/game-night/characters/parts/v2/hair/hair-long-02.png', 50, true, 'common', true, 20, null, null, null, null),
('hair-long-03', 'hair', 'Lang haar 3', '/game-night/characters/parts/v2/hair/hair-long-03.png', 50, true, 'common', true, 21, null, null, null, null),
('hair-long-04', 'hair', 'Lang haar 4', '/game-night/characters/parts/v2/hair/hair-long-04.png', 50, true, 'common', true, 22, null, null, null, null),
('hair-long-05', 'hair', 'Lang haar 5', '/game-night/characters/parts/v2/hair/hair-long-05.png', 50, true, 'common', true, 23, null, null, null, null),
('hair-long-06', 'hair', 'Lang haar 6', '/game-night/characters/parts/v2/hair/hair-long-06.png', 50, true, 'common', true, 24, null, null, null, null),
('hair-long-07', 'hair', 'Lang haar 7', '/game-night/characters/parts/v2/hair/hair-long-07.png', 50, true, 'common', true, 25, null, null, null, null),

-- ── eyebrows (10) ─────────────────────────────────────────────────────
('eyebrows-01', 'eyebrows', 'Wenkbrauwen 1', '/game-night/characters/parts/v2/eyebrows/eyebrows-01.png', 34, true, 'common', true, 0, null, null, null, null),
('eyebrows-02', 'eyebrows', 'Wenkbrauwen 2', '/game-night/characters/parts/v2/eyebrows/eyebrows-02.png', 34, true, 'common', true, 1, null, null, null, null),
('eyebrows-03', 'eyebrows', 'Wenkbrauwen 3', '/game-night/characters/parts/v2/eyebrows/eyebrows-03.png', 34, true, 'common', true, 2, null, null, null, null),
('eyebrows-04', 'eyebrows', 'Wenkbrauwen 4', '/game-night/characters/parts/v2/eyebrows/eyebrows-04.png', 34, true, 'common', true, 3, null, null, null, null),
('eyebrows-05', 'eyebrows', 'Wenkbrauwen 5', '/game-night/characters/parts/v2/eyebrows/eyebrows-05.png', 34, true, 'common', true, 4, null, null, null, null),
('eyebrows-06', 'eyebrows', 'Wenkbrauwen 6', '/game-night/characters/parts/v2/eyebrows/eyebrows-06.png', 34, true, 'common', true, 5, null, null, null, null),
('eyebrows-07', 'eyebrows', 'Wenkbrauwen 7', '/game-night/characters/parts/v2/eyebrows/eyebrows-07.png', 34, true, 'common', true, 6, null, null, null, null),
('eyebrows-08', 'eyebrows', 'Wenkbrauwen 8', '/game-night/characters/parts/v2/eyebrows/eyebrows-08.png', 34, true, 'common', true, 7, null, null, null, null),
('eyebrows-09', 'eyebrows', 'Wenkbrauwen 9', '/game-night/characters/parts/v2/eyebrows/eyebrows-09.png', 34, true, 'common', true, 8, null, null, null, null),
('eyebrows-10', 'eyebrows', 'Wenkbrauwen 10', '/game-night/characters/parts/v2/eyebrows/eyebrows-10.png', 34, true, 'common', true, 9, null, null, null, null),

-- ── facial-hair (6) ───────────────────────────────────────────────────
('facialhair-beard-full-01', 'facial-hair', 'Volle baard 1', '/game-night/characters/parts/v2/facial-hair/facialhair-beard-full-01.png', 38, true, 'common', true, 0, null, null, null, null),
('facialhair-beard-full-02', 'facial-hair', 'Volle baard 2', '/game-night/characters/parts/v2/facial-hair/facialhair-beard-full-02.png', 38, true, 'common', true, 1, null, null, null, null),
('facialhair-beard-round-01', 'facial-hair', 'Ronde baard 1', '/game-night/characters/parts/v2/facial-hair/facialhair-beard-round-01.png', 38, true, 'common', true, 2, null, null, null, null),
('facialhair-beard-round-02', 'facial-hair', 'Ronde baard 2', '/game-night/characters/parts/v2/facial-hair/facialhair-beard-round-02.png', 38, true, 'common', true, 3, null, null, null, null),
('facialhair-moustache-goatee', 'facial-hair', 'Snor met sikje', '/game-night/characters/parts/v2/facial-hair/facialhair-moustache-goatee.png', 38, true, 'common', true, 4, null, null, null, null),
('facialhair-moustache-patch', 'facial-hair', 'Snor met kinpatch', '/game-night/characters/parts/v2/facial-hair/facialhair-moustache-patch.png', 38, true, 'common', true, 5, null, null, null, null)

on conflict (key) do nothing;
