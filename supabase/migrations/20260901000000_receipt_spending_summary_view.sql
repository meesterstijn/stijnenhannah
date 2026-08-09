-- Prijsanalyse v1 — bonniveau-uitgavenlaag. shopping_receipts is hier DE
-- bron van waarheid: deze view telt nergens shopping_receipt_items opnieuw
-- op als alternatieve/parallelle waarheid voor bonbedragen — dat zou het
-- dubbeltellingsrisico invoeren dat we expliciet willen vermijden (de
-- itemregels kunnen door afronding/import-warnings lichtjes afwijken van de
-- bongetallen, zie de validatie in parseReceiptFile.ts).
--
-- NULL-semantiek deposit_total (expliciet gecontroleerd tegen de echte
-- code, niet aangenomen): parseReceiptFile.ts valideert `receipt.
-- deposit_total` via optionalNumber() — bij afwezigheid in de bron-JSON
-- wordt het `null`, nergens in parser/receiptsApi.ts/save_receipt_v1_rpc
-- wordt dat naar 0 omgezet. NULL betekent hier dus daadwerkelijk "onbekend
-- of geen statiegeld vermeld op de bon", NIET "gegarandeerd 0 statiegeld".
-- spending_excluding_deposit mag daarom NOOIT NULL als 0 behandelen.
--
-- Precies één rij per bon: elke join is een enkelvoudige FK-lookup naar een
-- primary key (stores.id, store_branches.id) — die kan per definitie nooit
-- meer dan één rij per bon opleveren, dus geen fan-out mogelijk. Geen
-- GROUP BY/aggregatie in deze view — dat komt in een latere, eigen laag.
--
-- SECURITY: zelfde redenering en aanpak als public.receipt_item_prices
-- (20260831000000) — Postgres-views draaien standaard met de rechten van
-- de eigenaar, niet de aanroeper, wat hier een RLS-omzeiling zou zijn. Dit
-- project draait Postgres 17 (supabase/config.toml, major_version = 17),
-- dus `security_invoker = true` (beschikbaar sinds Postgres 15) is de
-- juiste aanpak: de view evalueert dan de RLS van shopping_receipts/
-- stores/store_branches (allemaal al owner-only) met de rechten van de
-- daadwerkelijke aanroeper. Geen "enable row level security" op een view
-- — dat bestaat alleen voor tabellen.

create view public.receipt_spending_summary
with (security_invoker = true)
as
select
  r.id as receipt_id,
  r.store_id,
  s.canonical_name as store_name,
  r.branch_id,
  br.branch_name,
  r.purchase_date,
  r.purchase_time,
  r.currency,
  r.subtotal,
  r.discount_total,
  r.deposit_total,
  r.total_paid,
  -- Alleen berekend als BEIDE bronwaarden bekend zijn — Postgres laat NULL
  -- al vanzelf door een rekenkundige expressie propageren, maar de CASE
  -- hier maakt die bedoelde semantiek expliciet leesbaar i.p.v. impliciet.
  case
    when r.total_paid is not null and r.deposit_total is not null
      then r.total_paid - r.deposit_total
    else null
  end as spending_excluding_deposit,
  extract(year from r.purchase_date)::integer as purchase_year,
  extract(month from r.purchase_date)::integer as purchase_month
from public.shopping_receipts r
left join public.stores s on s.id = r.store_id
left join public.store_branches br on br.id = r.branch_id;

revoke all on public.receipt_spending_summary from public, anon;
grant select on public.receipt_spending_summary to authenticated;
