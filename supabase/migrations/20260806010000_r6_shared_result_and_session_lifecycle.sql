-- Rainbow Six Siege LAN Companion — fase 2.1, deel 2: gedeeld
-- matchresultaat + sessie-levenscyclus. Wijzigt r6_matches, r6_match_players
-- en r6_sessions uit 20260805010000_r6_sessions_and_matches.sql (dat
-- bestand blijft zelf ongewijzigd).
--
-- Aanleiding: Stijn en de andere speler spelen in hetzelfde online team, dus
-- winst/verlies is nooit een onderling verschil — het hoort één keer bij de
-- match te staan, niet per speler. Het individuele `result` op
-- r6_match_players werd hierdoor overbodig (en kon in theorie zelfs
-- tegenstrijdige waarden per speler bevatten binnen dezelfde match).

-- ── 1. Gedeeld matchresultaat op r6_matches ─────────────────────────────
alter table public.r6_matches
  add column if not exists result text not null default 'unknown'
  check (result in ('win', 'loss', 'draw', 'unknown'));

-- Backfill vanuit eventueel al bestaande r6_match_players.result-waarden,
-- vóórdat die kolom verdwijnt — zodat bestaande testdata niet verloren gaat.
-- Regel: als één van de spelers "win" had staan wint de match, anders "loss"
-- als iemand die had, anders blijft het "unknown" (nooit gemengd/tegen-
-- strijdig geraden).
update public.r6_matches m
set result = coalesce((
  select case
    when bool_or(mp.result = 'win') then 'win'
    when bool_or(mp.result = 'loss') then 'loss'
    else null
  end
  from public.r6_match_players mp
  where mp.match_id = m.id
), 'unknown')
where exists (select 1 from public.r6_match_players mp where mp.match_id = m.id);

alter table public.r6_match_players drop column if exists result;

-- ── 2. Sessie-notities (LAN-naam/datum/notities zijn nu bewerkbaar, zie
--       update_r6_session-achtige plain update vanaf de frontend) ───────
alter table public.r6_sessions add column if not exists notes text;

-- ── 3. status: 'ended' -> 'completed' (consistente naam met de rest van
--       fase 2.1). Bestaande rijen (indien aanwezig) worden meegenomen
--       vóórdat de check-constraint wordt aangescherpt.
update public.r6_sessions set status = 'completed' where status = 'ended';

-- Zoek de bestaande (impliciet genoemde) check-constraint op de
-- status-kolom dynamisch op i.p.v. te gokken naar de automatisch
-- gegenereerde naam — voorkomt een mislukte drop als PostgreSQL een andere
-- naam koos dan verwacht.
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.r6_sessions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if v_conname is not null then
    execute format('alter table public.r6_sessions drop constraint %I', v_conname);
  end if;
end $$;

alter table public.r6_sessions
  add constraint r6_sessions_status_check check (status in ('live', 'completed'));

-- ── 4. Edit-lock: metadata van een afgeronde sessie is alleen-lezen,
--       zolang ze afgerond blijft. `status`/`ended_at` zelf blijven altijd
--       wijzigbaar (anders zou heropenen onmogelijk worden — een sessie die
--       'completed' blijft mag alleen niet tegelijk stiekem hernoemd worden).
create or replace function public.enforce_r6_session_edit_lock()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'completed' and new.status = 'completed' then
    if new.name is distinct from old.name
       or new.notes is distinct from old.notes
       or new.started_at is distinct from old.started_at then
      raise exception 'Deze LAN is afgerond en alleen-lezen. Heropen de LAN om wijzigingen aan te brengen.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_r6_session_edit_lock on public.r6_sessions;
create trigger trg_enforce_r6_session_edit_lock
  before update on public.r6_sessions
  for each row
  execute function public.enforce_r6_session_edit_lock();
