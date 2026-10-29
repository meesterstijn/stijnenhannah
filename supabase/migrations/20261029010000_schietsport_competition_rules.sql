-- Schietsport: competitieregels.
--
--   rule_type 'manual'  : wedstrijden handmatig koppelen (oude werking)
--             'periods' : puntenbord — periodes binnen een jaar, hoogste
--                         score per periode telt, afgelopen periodes liggen
--                         vast (rules.frozen)
--             'best_of' : beste N — eerste N scores vullen de plekken, daarna
--                         vervangt een hogere score de laagste
--   rules     jsonb met de instellingen (periodes, aantal, welk type
--             schietbeurt telt, afstand, vastgezette periodes). Inhoud wordt
--             door de app gevalideerd; de database bewaakt alleen vorm en
--             omvang.
-- Additief: bestaande competities worden 'manual' met lege regels.

begin;

alter table public.shooting_competitions
  add column if not exists rule_type text not null default 'manual',
  add column if not exists rules jsonb not null default '{}'::jsonb;

alter table public.shooting_competitions
  drop constraint if exists shooting_competitions_rule_type,
  add constraint shooting_competitions_rule_type
    check (rule_type in ('manual', 'periods', 'best_of')),
  drop constraint if exists shooting_competitions_rules_shape,
  add constraint shooting_competitions_rules_shape
    check (jsonb_typeof(rules) = 'object' and pg_column_size(rules) <= 16384);

create or replace function public.shooting_push_competition(
  p_change_id uuid, p_base_version integer, p_row jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.shooting_assert_access();
  v_id uuid := (p_row->>'id')::uuid;
  v_table regclass := 'public.shooting_competitions';
  v_state text := private.shooting_check_version(v_table, v_id, p_change_id, p_base_version);
  v_rule_type text := coalesce(p_row->>'rule_type', 'manual');
  v_rules jsonb := case
    when jsonb_typeof(p_row->'rules') = 'object' then p_row->'rules'
    else '{}'::jsonb
  end;
begin
  if v_state = 'insert' then
    insert into public.shooting_competitions (
      id, user_id, name, start_date, end_date, discipline_id, notes,
      rule_type, rules,
      archived_at, created_at, updated_at, deleted_at, last_change_id
    ) values (
      v_id, v_uid, btrim(p_row->>'name'),
      (p_row->>'start_date')::date, (p_row->>'end_date')::date,
      (p_row->>'discipline_id')::uuid, p_row->>'notes',
      v_rule_type, v_rules,
      (p_row->>'archived_at')::timestamptz,
      coalesce((p_row->>'created_at')::timestamptz, now()),
      coalesce((p_row->>'updated_at')::timestamptz, now()),
      (p_row->>'deleted_at')::timestamptz, p_change_id
    );
  elsif v_state = 'update' then
    update public.shooting_competitions set
      name = btrim(p_row->>'name'),
      start_date = (p_row->>'start_date')::date,
      end_date = (p_row->>'end_date')::date,
      discipline_id = (p_row->>'discipline_id')::uuid,
      notes = p_row->>'notes',
      rule_type = v_rule_type,
      rules = v_rules,
      archived_at = (p_row->>'archived_at')::timestamptz,
      updated_at = coalesce((p_row->>'updated_at')::timestamptz, now()),
      deleted_at = (p_row->>'deleted_at')::timestamptz,
      last_change_id = p_change_id
    where id = v_id;
  end if;
  return private.shooting_result(v_state, v_table, v_id);
end;
$$;

revoke execute on function public.shooting_push_competition(uuid, integer, jsonb) from public, anon;
grant execute on function public.shooting_push_competition(uuid, integer, jsonb) to authenticated;

commit;
