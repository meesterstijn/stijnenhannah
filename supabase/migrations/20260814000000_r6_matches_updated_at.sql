-- Rainbow Six Siege LAN Companion — `updated_at` op r6_matches, zodat de
-- frontend een betrouwbaar tijdstip heeft voor "wanneer is deze match voor
-- het laatst opgeslagen" (bv. het moment van "Gimma afronden", waar MVP
-- wordt gekozen). `played_at` is bewust ongeschikt hiervoor: dat blijft het
-- moment waarop de match/ronde BEGON, ver vóór alle tikken en de
-- uiteindelijke MVP-keuze aan het eind — puur op played_at sorteren zou de
-- MVP-toekenning in de "Laatste acties"-feed onderaan die match se acties
-- laten verschijnen in plaats van bovenaan (zie R6RecentEventsFeed).
--
-- Puur informatief, raakt geen puntenberekening (scoring.ts blijft
-- uitsluitend op mvp_player_id/mvp_points/events lezen).
alter table public.r6_matches
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_r6_matches_updated_at on public.r6_matches;
create trigger trg_r6_matches_updated_at
  before update on public.r6_matches
  for each row
  execute function public.r6_set_updated_at();
