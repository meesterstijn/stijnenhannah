-- Gebruikersrollen, deel 2: alle NIET-R6-tabellen owner-only maken.
--
-- Vóór deze migratie stond op vrijwel elke tabel in dit schema een brede
-- "Authenticated users can do everything"-policy (of, voor een aantal
-- tabellen die van vóór de migratiehistorie dateren — zie de lijst
-- hieronder — mogelijk zelfs een onbekende, out-of-band aangemaakte policy).
-- Nu een tweede account (r6_player) bestaat, zou zo'n policy hem toegang
-- geven tot alle privédata (tuin, boodschappen, notities, taken, etc.).
--
-- Aanpak per tabel:
--  1. RLS aanzetten (idempotent, ook als al aan).
--  2. ALLE bestaande policies op die tabel verwijderen — dynamisch via
--     pg_policies, niet via `drop policy if exists "<geraden naam>"`. Voor
--     tabellen zonder migratiehistorie (zie de comment bij de tabellenlijst)
--     is de exacte huidige policynaam ons onbekend; deze aanpak vindt en
--     verwijdert ze hoe dan ook, zonder te hoeven gokken.
--  3. Eén nieuwe, owner-only policy voor alle acties (SELECT/INSERT/UPDATE/
--     DELETE) aanmaken.
--
-- `to_regclass` per tabel voorkomt een harde fout als een van de
-- opgesomde namen toch niet (meer) bestaat — zo'n tabel wordt dan simpelweg
-- overgeslagen (met een NOTICE), in plaats van dat de hele migratie faalt.
--
-- Uitgezonderd van deze lijst: `public.push_subscriptions` — die heeft al
-- een correcte, per-gebruiker scoped policy (`auth.uid() = user_id`, zie
-- 20260715120000_note_reminders.sql) die niets aan owner/r6_player-onderscheid
-- hoeft te veranderen: een r6_player die zijn eigen push-subscriptie beheert
-- kan nooit bij andermans rij komen, ongeacht rol.
--
-- Tabellen ZONDER migratie-getrackte CREATE TABLE (uit de audit gebleken via
-- de frontend-queries: groceries, groceries_upfront, notes, todos, birthdays,
-- weekplan, cleaning_tasks, product_categories, product_assignments,
-- recipes, packing_items, quick_links, travel_phrases) zijn hieronder
-- evengoed volledig meegenomen — deze migratie heeft geen kennis van hun
-- kolommen nodig, alleen van hun naam, om RLS/policies te beheren.
do $$
declare
  v_table text;
  v_policy record;
  v_tables text[] := array[
    -- Tuingids / Tuinieren
    'plants', 'plant_photos', 'plant_harvest_logs', 'plant_pruning_logs',
    'plant_repot_logs', 'plant_notes', 'plant_inspection_logs',
    'plant_instances', 'growing_seasons', 'growth_log_entries',
    'growth_log_photos', 'cultivation_plans', 'cultivation_plan_items',
    -- Huishouden / overige privémodules
    'groceries', 'groceries_upfront', 'notes', 'todos', 'todo_reminder_runs',
    'birthdays', 'weekplan', 'recipes', 'cleaning_tasks',
    'product_categories', 'product_assignments', 'packing_items',
    'quick_links', 'travel_phrases', 'daily_prompt', 'daily_prompt_runs',
    -- Instellingen (bevat o.a. wifi-wachtwoord en een DeepL API-key — zie
    -- 20260804040000_reconcile_planted_at_and_app_settings.sql — stond tot nu
    -- toe open voor "elke authenticated user", een reëel geheimenlek zodra
    -- een tweede account bestaat).
    'app_settings'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is null then
      raise notice 'Tabel public.% bestaat niet — overgeslagen.', v_table;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', v_table);

    for v_policy in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy %I on public.%I', v_policy.policyname, v_table);
    end loop;

    execute format(
      'create policy %I on public.%I for all to authenticated using (private.is_owner()) with check (private.is_owner())',
      v_table || '_owner_only',
      v_table
    );

    -- Least privilege: `anon` heeft nooit iets te zoeken op privédata, RLS
    -- of niet — de hele app vereist toch al een sessie (zie App.tsx).
    execute format('revoke all on public.%I from anon', v_table);
  end loop;
end $$;
