-- Rainbow Six Siege LAN Companion — fase 2.2, deel 1: databasegestuurde
-- puntregels. Vervangt de tot nu toe in TypeScript hardcoded
-- `R6_SCORE_RULES` als bron van waarheid — punten kunnen voortaan via een
-- (toekomstige) beheer-UI aangepast worden zonder code- of migratiewijziging.
--
-- `code` is de stabiele sleutel waarop de frontend leest (nooit `id`, dat is
-- alleen de primary key). `category` maakt onderscheid tussen directe
-- punten (mvp/clutch/ace), eindbonussen (meeste X van de sessie) en
-- toekomstige penalties (nu nog leeg, structuur staat al klaar).
--
-- Challengepunten blijven bewust op `r6_challenges.bonus_points` staan (elke
-- challenge heeft zijn eigen, per-challenge instelbare waarde) — die
-- verhuizen NIET hierheen, om geen twee bronnen van waarheid voor hetzelfde
-- concept te krijgen. r6_score_rules regelt alles wat challenge-onafhankelijk
-- is (mvp/clutch/ace/meeste-X).
create table if not exists public.r6_score_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  category text not null check (category in ('direct', 'end_bonus', 'penalty')),
  points integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.r6_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_r6_score_rules_updated_at on public.r6_score_rules;
create trigger trg_r6_score_rules_updated_at
  before update on public.r6_score_rules
  for each row
  execute function public.r6_set_updated_at();

alter table public.r6_score_rules enable row level security;

create policy "Authenticated users can do everything" on public.r6_score_rules
  for all to authenticated using (true) with check (true);

-- Seed: exact de waarden die tot nu toe hardcoded in R6_SCORE_RULES stonden.
-- Geen punten voor het gezamenlijke matchresultaat — dat is bewust geen rij
-- in deze tabel (win/loss/draw levert nul punten op, structureel, niet via
-- een "0-puntenregel" die per ongeluk aangepast zou kunnen worden).
insert into public.r6_score_rules (code, name, description, category, points, sort_order) values
  ('mvp', 'MVP', 'Speler was MVP van de match.', 'direct', 2, 1),
  ('clutch', 'Clutch', 'Speler won een 1vX-clutch.', 'direct', 3, 2),
  ('ace', 'Ace', 'Speler behaalde een ace.', 'direct', 5, 3),
  ('most_kills', 'Meeste kills', 'Hoogste totaal kills van de volledige LAN-sessie.', 'end_bonus', 1, 4),
  ('most_headshots', 'Meeste headshots', 'Hoogste totaal headshots van de volledige LAN-sessie.', 'end_bonus', 1, 5),
  ('most_assists', 'Meeste assists', 'Hoogste totaal assists van de volledige LAN-sessie.', 'end_bonus', 1, 6),
  ('most_revives', 'Meeste revives', 'Hoogste totaal revives van de volledige LAN-sessie.', 'end_bonus', 2, 7)
on conflict (code) do nothing;
