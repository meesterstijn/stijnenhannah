-- Rainbow Six Siege LAN Companion — sessie-brede "meeste X van de LAN"
-- eindbonussen (most_kills/most_headshots/most_assists/most_revives)
-- verwijderen. computeScoreboard() (zie scoring.ts) kende deze bonus al toe
-- aan wie een stat als eerste van 0 naar 1 tikte — er hoefde geen tweede
-- speler ooit iets getikt te hebben om al "unieke koploper" te zijn. Op een
-- verse LAN kreeg de eerste kill/revive-tik zo onterecht dubbele (of meer)
-- punten. Punten komen voortaan uitsluitend uit direct getikte acties
-- (category = 'direct') en de MVP-toekenning bij het afsluiten van een
-- game — zie R6ScoreboardEntry in types.ts.
delete from public.r6_score_rules
where code in ('most_kills', 'most_headshots', 'most_assists', 'most_revives');
