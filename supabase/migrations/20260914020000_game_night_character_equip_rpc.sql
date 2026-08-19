-- Game Night V2.9B (3/4) — server-side gecontroleerd equippen (opdracht
-- sectie 12): "niet vertrouwen op de frontend" voor welke items unlocked
-- zijn. Zelfde SECURITY DEFINER-grens/patroon als
-- game_night_update_my_profile (20260913000010) — de speler wordt
-- uitsluitend via auth.uid() opgezocht, nooit via een meegegeven player-id
-- (spoofbare input, zelfde motivatie als sectie 25 van de V2.3-opdracht).

create or replace function public.game_night_equip_character_part(
  p_slot text,
  p_part_id uuid
)
returns public.game_night_player_character_equipment
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid;
  v_part public.game_night_character_parts;
  v_row public.game_night_player_character_equipment;
begin
  if not private.is_game_night_member_or_owner() then
    raise exception 'Geen toegang tot Game Night' using errcode = '42501';
  end if;

  select id into v_player_id
  from public.game_night_players
  where auth_user_id = auth.uid();

  if v_player_id is null then
    raise exception 'Geen gekoppeld spelersprofiel voor dit account'
      using errcode = '22023';
  end if;

  -- Stap 2: part bestaat + is actief.
  select * into v_part
  from public.game_night_character_parts
  where id = p_part_id;

  if not found or not v_part.active then
    raise exception 'Onderdeel bestaat niet (meer) of is niet actief'
      using errcode = '22023';
  end if;

  -- Stap 3: part hoort daadwerkelijk in de opgegeven slot.
  if v_part.slot != p_slot then
    raise exception 'Onderdeel "%": slot komt niet overeen (verwacht %, kreeg %)',
      v_part.key, v_part.slot, p_slot
      using errcode = '22023';
  end if;

  -- Stap 4: speler heeft dit onderdeel vrijgespeeld — starter-onderdelen
  -- zijn impliciet unlocked (sectie 7), verder is een expliciete rij in
  -- ..._unlocks vereist. Dit is de daadwerkelijke autorisatiecontrole; de
  -- frontend-filtering in de (toekomstige) creator-UI is puur UX, geen
  -- beveiliging (sectie 12).
  if not v_part.is_starter and not exists (
    select 1 from public.game_night_player_character_unlocks
    where player_id = v_player_id and part_id = p_part_id
  ) then
    raise exception 'Onderdeel "%" is nog niet vrijgespeeld', v_part.key
      using errcode = '42501';
  end if;

  -- Stap 5: veilig upserten — precies één rij per (speler, slot) dankzij
  -- de primary key.
  insert into public.game_night_player_character_equipment (player_id, slot, part_id, equipped_at)
  values (v_player_id, p_slot, p_part_id, now())
  on conflict (player_id, slot)
  do update set part_id = excluded.part_id, equipped_at = excluded.equipped_at
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.game_night_equip_character_part(text, uuid)
  from public, anon;
grant execute on function public.game_night_equip_character_part(text, uuid)
  to authenticated;

-- Unequip: "base" blijft verplicht (opdracht sectie 12 vraagt hier expliciet
-- over na te denken) — een character zonder enige bodylaag is geen zinvolle
-- render-staat en zou CharacterVisual dwingen een speciale "helemaal leeg"-
-- weergave te bedenken voor iets dat nooit een bewuste keuze hoort te zijn.
-- Elke andere slot mag altijd leeggemaakt worden (een ontbrekende laag
-- betekent simpelweg "dit onderdeel wordt niet getoond").
create or replace function public.game_night_unequip_character_part(
  p_slot text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid;
begin
  if not private.is_game_night_member_or_owner() then
    raise exception 'Geen toegang tot Game Night' using errcode = '42501';
  end if;

  if p_slot = 'base' then
    raise exception 'De basis-laag kan niet leeggemaakt worden, alleen vervangen'
      using errcode = '22023';
  end if;

  select id into v_player_id
  from public.game_night_players
  where auth_user_id = auth.uid();

  if v_player_id is null then
    raise exception 'Geen gekoppeld spelersprofiel voor dit account'
      using errcode = '22023';
  end if;

  delete from public.game_night_player_character_equipment
  where player_id = v_player_id and slot = p_slot;
end;
$$;

revoke execute on function public.game_night_unequip_character_part(text)
  from public, anon;
grant execute on function public.game_night_unequip_character_part(text)
  to authenticated;
