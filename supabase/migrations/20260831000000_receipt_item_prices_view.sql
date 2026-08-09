-- Prijsanalyse v1 — fundamentele view: leidt betrouwbare prijsinformatie af
-- uit shopping_receipt_items (+ joins), zonder een tweede waarheid op te
-- slaan. Alleen productregels met een betrouwbare productkoppeling
-- (matched_auto/matched_confirmed) komen erin — discount/deposit/
-- service_or_other-regels, en unmatched/needs_review-regels, NOOIT.
--
-- SECURITY: Postgres-views draaien standaard met de rechten van de
-- VIEW-EIGENAAR (het "security invoker = false"-gedrag), niet van de
-- aanroeper — dat zou hier een impliciete RLS-bypass zijn, omdat de rol die
-- migraties uitvoert doorgaans meer rechten heeft dan een gewone
-- authenticated gebruiker. Dit project draait op Postgres 17 (zie
-- supabase/config.toml, major_version = 17), dus de sinds Postgres 15
-- beschikbare `security_invoker = true`-optie is hier de juiste, veilige
-- aanpak: de view evalueert dan de RLS van de onderliggende tabellen
-- (shopping_receipt_items, shopping_receipts, products, product_variants,
-- stores, store_branches — allemaal al owner-only) met de rechten van wie
-- de query daadwerkelijk uitvoert. Een niet-owner (of anon) ziet dus
-- gewoon nul rijen, exact zoals bij de tabellen zelf. Geen enable row level
-- security nodig/mogelijk op een view — dat bestaat alleen voor tabellen;
-- security_invoker + de bestaande tabel-RLS is hier het volledige verhaal.
--
-- Bewust GEEN materialized view en GEEN triggers: dit is precies de
-- "geen dubbele waarheid"-eis — een gewone view berekent altijd live vanuit
-- de brontabellen, dus een matching-correctie (ook retroactief) werkt
-- meteen door zonder herberekening.

create view public.receipt_item_prices
with (security_invoker = true)
as
with base as (
  select
    i.id as receipt_item_id,
    i.receipt_id,
    i.product_id,
    p.canonical_name as product_name,
    i.product_variant_id,
    v.variant_name,
    r.store_id,
    s.canonical_name as store_name,
    r.branch_id,
    br.branch_name,
    r.purchase_date,
    r.purchase_time,
    i.matching_status,
    i.quantity,
    i.weight,
    i.weight_unit,
    v.package_size,
    v.package_unit,
    p.comparison_unit,
    i.regular_unit_price,
    i.regular_line_total,
    i.discount_amount,
    i.paid_line_total,
    r.currency,
    -- Daadwerkelijk gewogen hoeveelheid in kg (bron 1) — alleen uit het
    -- kassabonfeit zelf, nooit uit de catalogus.
    case
      when i.weight is not null and i.weight_unit = 'kg' then i.weight
      when i.weight is not null and i.weight_unit = 'g' then i.weight / 1000.0
      else null
    end as weight_kg,
    -- Gewicht van ÉÉN verpakking in kg (bron 2, catalogus) — bewust apart
    -- van "totaal gekocht gewicht", want regular_unit_price is een
    -- prijs-per-verpakking en moet dus door het gewicht van ÉÉN verpakking
    -- gedeeld worden, niet door het totaal van alle gekochte verpakkingen.
    case
      when v.package_size is not null and v.package_unit = 'kg' then v.package_size
      when v.package_size is not null and v.package_unit = 'g' then v.package_size / 1000.0
      else null
    end as package_kg,
    case
      when i.weight is not null and i.weight_unit = 'l' then i.weight
      when i.weight is not null and i.weight_unit = 'ml' then i.weight / 1000.0
      else null
    end as weight_liter,
    case
      when v.package_size is not null and v.package_unit = 'l' then v.package_size
      when v.package_size is not null and v.package_unit = 'ml' then v.package_size / 1000.0
      else null
    end as package_liter
  from public.shopping_receipt_items i
  join public.shopping_receipts r on r.id = i.receipt_id
  -- INNER join naar products (i.p.v. left join): een matched_auto/
  -- matched_confirmed-regel hoort altijd een product te hebben; als dat
  -- ooit niet zo is (een datafout), sluit de INNER join die rij vanzelf uit
  -- i.p.v. 'm met een lege productnaam te tonen.
  join public.products p on p.id = i.product_id
  left join public.product_variants v on v.id = i.product_variant_id
  left join public.stores s on s.id = r.store_id
  left join public.store_branches br on br.id = r.branch_id
  where i.line_type = 'product'
    and i.matching_status in ('matched_auto', 'matched_confirmed')
)
select
  receipt_item_id,
  receipt_id,
  product_id,
  product_name,
  product_variant_id,
  variant_name,
  store_id,
  store_name,
  branch_id,
  branch_name,
  purchase_date,
  purchase_time,
  matching_status,
  quantity,
  weight,
  weight_unit,
  package_size,
  package_unit,
  comparison_unit,
  regular_unit_price,
  regular_line_total,
  discount_amount,
  paid_line_total,

  -- regular_unit_price_effective: raw waarde als die er is, anders
  -- afgeleid uit regular_line_total/quantity — nooit uit een losse
  -- kortingsregel.
  case
    when regular_unit_price is not null then regular_unit_price
    when regular_line_total is not null and quantity is not null and quantity > 0
      then regular_line_total / quantity
    else null
  end as regular_unit_price_effective,

  -- paid_unit_price: uitsluitend voor getelde producten (quantity > 0).
  -- Gewichtsproducten hebben hier bewust altijd NULL — hun vergelijkbare
  -- prijs leeft in comparison_paid_price, niet hier.
  case
    when quantity is not null and quantity > 0 then paid_line_total / quantity
    else null
  end as paid_unit_price,

  -- comparison_regular_price: kg/liter -> bron 1 (echt gewogen) vóór bron 2
  -- (verpakking); piece -> unit price; none -> altijd NULL.
  case
    when comparison_unit = 'kg' and weight_kg is not null then
      case
        when regular_line_total is not null then regular_line_total / weight_kg
        when regular_unit_price is not null then regular_unit_price
        else null
      end
    when comparison_unit = 'kg' and weight_kg is null and package_kg is not null
         and quantity is not null and quantity > 0 then
      case
        when regular_line_total is not null then regular_line_total / (package_kg * quantity)
        when regular_unit_price is not null then regular_unit_price / package_kg
        else null
      end
    when comparison_unit = 'liter' and weight_liter is not null then
      case
        when regular_line_total is not null then regular_line_total / weight_liter
        when regular_unit_price is not null then regular_unit_price
        else null
      end
    when comparison_unit = 'liter' and weight_liter is null and package_liter is not null
         and quantity is not null and quantity > 0 then
      case
        when regular_line_total is not null then regular_line_total / (package_liter * quantity)
        when regular_unit_price is not null then regular_unit_price / package_liter
        else null
      end
    when comparison_unit = 'piece' then
      case
        when regular_unit_price is not null then regular_unit_price
        when regular_line_total is not null and quantity is not null and quantity > 0
          then regular_line_total / quantity
        else null
      end
    else null
  end as comparison_regular_price,

  -- comparison_paid_price: paid_line_total is altijd een "hele regel"-
  -- bedrag, dus hier telt total_kg/total_liter (niet single-package).
  case
    when comparison_unit = 'kg' and weight_kg is not null then paid_line_total / weight_kg
    when comparison_unit = 'kg' and weight_kg is null and package_kg is not null
         and quantity is not null and quantity > 0
      then paid_line_total / (package_kg * quantity)
    when comparison_unit = 'liter' and weight_liter is not null then paid_line_total / weight_liter
    when comparison_unit = 'liter' and weight_liter is null and package_liter is not null
         and quantity is not null and quantity > 0
      then paid_line_total / (package_liter * quantity)
    when comparison_unit = 'piece' and quantity is not null and quantity > 0
      then paid_line_total / quantity
    else null
  end as comparison_paid_price,

  -- comparison_price_unit: alleen gevuld als er ook echt een comparison-
  -- prijs berekend kon worden (zelfde voorwaarden als hierboven).
  case
    when comparison_unit = 'kg' and (
      weight_kg is not null or (package_kg is not null and quantity is not null and quantity > 0)
    ) then upper(currency) || '/kg'
    when comparison_unit = 'liter' and (
      weight_liter is not null or (package_liter is not null and quantity is not null and quantity > 0)
    ) then upper(currency) || '/l'
    when comparison_unit = 'piece' and quantity is not null and quantity > 0
      then upper(currency) || '/piece'
    else null
  end as comparison_price_unit,

  -- discount_effective: UITSLUITEND regelgebonden korting. Een losse
  -- discount-regel (bv. de Bonus -0.99 op een andere rij) wordt hier nooit
  -- meegenomen — die heeft geen kolom die 'm aan deze regel koppelt.
  case
    when discount_amount is not null then discount_amount
    when regular_line_total is not null and paid_line_total is not null
         and (regular_line_total - paid_line_total) >= 0
      then regular_line_total - paid_line_total
    else null
  end as discount_effective
from base;

revoke all on public.receipt_item_prices from public, anon;
grant select on public.receipt_item_prices to authenticated;
