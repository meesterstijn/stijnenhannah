-- Boodschappenproduct <-> canoniek product V1.
--
-- Voorafgaand onderzoek (twee eerdere STOP-rapporten) heeft bewezen:
--   - `groceries`/`groceries_upfront` zijn tijdelijke, wegwerpbare regels
--     (`{id, text, done, created_at}`, delete+insert-patroon) zonder
--     blijvende productidentiteit — GEEN geschikte plek voor deze koppeling.
--   - `product_assignments` is wél de blijvende laag per boodschappenproduct
--     (`product` <-> `category_id`), en blijft de enige plek waar deze
--     nieuwe koppeling hoort.
--   - `product_assignments` heeft zelf geen migratie-getrackte CREATE TABLE
--     (zie 20260816010000_owner_only_lockdown.sql, regel 30-35: "Tabellen
--     ZONDER migratie-getrackte CREATE TABLE ... product_assignments ...").
--     Dat is geen probleem voor een ADD COLUMN: die heeft geen kennis nodig
--     van de bestaande kolommen/PK, alleen van de tabelnaam.
--
-- ONTWERPKEUZES (uit de opdracht, hier herbevestigd):
--   - Koppelt naar het CANONIEKE product (`products.id`), NOOIT naar een
--     specifieke `product_variants.id` — welke variant echt gekocht wordt
--     blijft een kassabon-aangelegenheid, niet iets waar de boodschappenlijst
--     van afhankelijk mag zijn.
--   - Nullable: niet elk boodschappenproduct hoeft gekoppeld te zijn.
--   - ON DELETE SET NULL: het (veilig, via de bestaande
--     delete_unused_product_v1-RPC) verwijderen van een canoniek product mag
--     nooit een boodschappenproduct/categorie-toewijzing vernietigen — alleen
--     de cataloguskoppeling verdwijnt, de rij blijft gewoon bestaan.
--   - GEEN unique constraint op canonical_product_id: meerdere
--     boodschappennamen (bv. "Tomaat" en "Trostomaten") mogen bewust naar
--     hetzelfde canonieke product verwijzen — dat is een geldige keuze van de
--     gebruiker, geen datafout.
--   - GEEN backfill: elke bestaande rij krijgt canonical_product_id = null,
--     ook bij een exacte naamovereenkomst tussen product_assignments.product
--     en products.canonical_name. De gebruiker koppelt zelf, bewust, per
--     rij — dit is uitdrukkelijk geen automatische matching.
--
-- RLS: geen wijziging nodig. De bestaande, dynamisch aangemaakte policy
-- "product_assignments_owner_only" (zie 20260816010000_owner_only_lockdown.sql)
-- is `for all to authenticated using (private.is_owner()) with check
-- (private.is_owner())` — kolom-agnostisch, dekt dus automatisch ook deze
-- nieuwe kolom. Een gewone Supabase .update() volstaat; geen RPC nodig.
alter table public.product_assignments
  add column canonical_product_id uuid references public.products(id) on delete set null;

-- Voor de bulk-embedquery (product_assignments -> products) vanuit de UI,
-- en voor eventuele toekomstige "welke boodschappenproducten wijzen naar dit
-- canonieke product"-opzoekingen.
create index product_assignments_canonical_product_id_idx
  on public.product_assignments (canonical_product_id);
