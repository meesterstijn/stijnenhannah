-- recipes.created_by kon niet in 20260715110000_baseline_missing_tables.sql
-- staan: de live constraint-export toont eenduidig een NOT NULL FOREIGN KEY
-- naar public.profiles(id) (recipes_created_by_fkey), maar profiles bestaat
-- pas vanaf de migratie hierboven in de bestandsnaam-volgorde
-- (20260816000000_app_roles_and_profiles.sql). Dit bestand staat bewust
-- tussen die migratie en 20260816010000_owner_only_lockdown.sql (die raakt
-- alleen RLS/policies aan, dus de precieze plek binnen dat gat maakt niet
-- uit voor die migratie).
--
-- `if not exists`: op de huidige live database bestaat deze kolom (met FK)
-- al — dit statement is daar dan ook een volledige no-op. Op een verse
-- database is recipes op dit punt in de keten altijd leeg (0 rijen), dus
-- een directe NOT NULL zonder default is veilig: er zijn geen bestaande
-- rijen die de constraint zouden kunnen schenden.
alter table public.recipes
  add column if not exists created_by uuid not null references public.profiles(id);

-- Handmatige controle na het draaien van deze migratie:
--
-- select column_name, is_nullable, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'recipes' and column_name = 'created_by';
--
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.recipes'::regclass and conname = 'recipes_created_by_fkey';
