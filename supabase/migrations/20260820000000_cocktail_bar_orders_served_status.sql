-- Cocktail Bar — nieuwe terminale status 'served' op cocktail_orders.
-- Zonder deze status bleef een "Klaar"-bestelling voor altijd in de
-- Bereiden-wachtrij staan: de bestaande "Beëindigen"-knop schreef alleen
-- cocktail_bar_state.dismissed_ready_order_id (om het Big Screen het
-- klaar-scherm vroegtijdig te laten verlaten), maar raakte de bestelling
-- zelf niet aan — de kaart bleef dus onveranderd in de "Klaar"-kolom staan.
-- 'served' is de echte "deze bestelling is afgehandeld"-status: de
-- bestaande ready_at-trigger zet 'm vanzelf terug op null bij de overgang
-- weg van 'ready' (zie 20260819020000_cocktail_bar_orders.sql), en zowel
-- Bereiden als het Big Screen filteren al op status = 'ready', dus 'served'
-- verdwijnt overal automatisch uit beeld zonder verdere codewijziging.
alter table public.cocktail_orders drop constraint cocktail_orders_status_check;
alter table public.cocktail_orders add constraint cocktail_orders_status_check
  check (status in ('ordered', 'in_progress', 'ready', 'served'));
