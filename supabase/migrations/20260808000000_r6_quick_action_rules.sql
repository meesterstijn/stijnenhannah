-- Rainbow Six Siege LAN Companion — live-scorebord-redesign, deel 1:
-- r6_score_rules uitbreiden zodat dezelfde tabel ook de configureerbare
-- "snelle actietegels" van het live dashboard aanstuurt. Bewust geen nieuwe
-- tabel: r6_score_rules had al code/name/points/is_active/sort_order — de
-- enige echt ontbrekende velden zijn icon/color en een vlag om te merken
-- welke regels als tegel getoond moeten worden (de end_bonus-regels
-- ("meeste kills" e.d.) zijn nooit een tegel, dat blijven sessie-brede
-- afgeleide bonussen, geen individuele tik-acties).

alter table public.r6_score_rules
  add column if not exists icon text,
  add column if not exists color text,
  add column if not exists is_quick_action boolean not null default false;

-- Bestaande regels: mvp/clutch/ace zijn ook prima losse tegels op het live
-- dashboard. Hun bestaande puntenwaarde (mvp +2, clutch +3, ace +5) blijft
-- bewust ongewijzigd — dit is een structuurwijziging, geen herwaardering;
-- via de nieuwe instellingen-UI kan de puntenwaarde alsnog vrij aangepast
-- worden. most_kills/most_headshots/most_assists/most_revives blijven
-- is_quick_action = false: dat zijn sessie-brede eindbonussen, geen
-- individuele gebeurtenis om te "tikken".
update public.r6_score_rules set is_quick_action = true, icon = '🏅', color = 'amber' where code = 'mvp';
update public.r6_score_rules set is_quick_action = true, icon = '⚔️', color = 'violet' where code = 'clutch';
update public.r6_score_rules set is_quick_action = true, icon = '💥', color = 'amber' where code = 'ace';

-- Nieuwe tegels. `kill`/`headshot`/`assist`/`revive`/`death` bestonden
-- voorheen alleen als handmatig ingevoerde aantallen in het matchformulier
-- (r6_match_players.kills/headshots/assists/revives/deaths) — nu ook als
-- individuele, direct punten opleverende tik-gebeurtenissen voor het live
-- dashboard (zie r6_events, volgende migratie). `death` levert bewust 0
-- punten op (net als voorheen) maar blijft een tegel zodat de K/D-stat ook
-- via het live dashboard bijgehouden kan worden zonder het matchformulier.
-- `clutch_1v2`/`clutch_1v3` zijn losse, fijnmaziger tegels náást de
-- bestaande generieke `clutch`-regel (die blijft ongewijzigd bestaan voor
-- de bestaande matchformulier-flow in Geschiedenis). `challenge_bonus` is
-- een snelle, generieke "challenge gehaald"-tik, los van het uitgebreide
-- per-match challenge-systeem (r6_challenges) dat in Geschiedenis blijft
-- werken zoals het was.
insert into public.r6_score_rules (code, name, description, category, points, icon, color, is_quick_action, sort_order) values
  ('kill', 'Kill', 'Eén kill.', 'direct', 1, '🔫', 'emerald', true, 10),
  ('headshot', 'Headshot', 'Eén headshot.', 'direct', 1, '🎯', 'amber', true, 11),
  ('assist', 'Assist', 'Eén assist.', 'direct', 1, '🤝', 'sky', true, 12),
  ('revive', 'Revive', 'Eén revive.', 'direct', 2, '💉', 'emerald', true, 13),
  ('death', 'Death', 'Eén death (voor K/D-statistiek, levert geen punten op).', 'direct', 0, '💀', 'zinc', true, 14),
  ('clutch_1v2', '1v2', 'Clutch tegen twee tegenstanders.', 'direct', 3, '⚔️', 'violet', true, 15),
  ('clutch_1v3', '1v3', 'Clutch tegen drie of meer tegenstanders.', 'direct', 5, '🔥', 'violet', true, 16),
  ('challenge_bonus', 'Challenge', 'Snelle challenge-bonus tijdens het live spelen.', 'direct', 2, '✅', 'sky', true, 17)
on conflict (code) do nothing;
