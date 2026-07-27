-- Rainbow Six Siege LAN Companion — fase 2.2, deel 5: LAN-foto's/media.
--
-- Alleen `storage_path` wordt opgeslagen — bewust GEEN aparte publieke-URL-
-- kolom (in tegenstelling tot het patroon in growth_log_photos, waar
-- photo_url wél apart wordt bewaard). De publieke URL is een pure,
-- goedkope afleiding van storage_path via supabase.storage.getPublicUrl()
-- (geen netwerkcall, alleen stringopbouw) — een aparte kolom zou dezelfde
-- informatie dubbel opslaan.
--
-- match_id is optioneel: media hoort bij de hele LAN (match_id null) of bij
-- één specifieke match. RLS-policies (live-only insert/update/delete) volgen
-- in 20260807060000, samen met r6_session_challenges/r6_session_chaos_effects.
create table if not exists public.r6_session_media (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.r6_sessions(id) on delete cascade,
  match_id uuid,
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  caption text,
  sort_order integer not null default 0,
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  -- Cross-session-integriteit (fase 2.2 SQL-audit): match_id (indien
  -- ingevuld) moet daadwerkelijk bij déze session_id horen — voorkomt dat
  -- een foto aan een match uit een ándere sessie gekoppeld wordt. Composite
  -- FK tegen r6_matches(id, session_id) — die unique constraint is
  -- aangemaakt in 20260807010000_r6_achievements.sql — i.p.v. een simpele
  -- FK naar r6_matches(id). MATCH SIMPLE staat match_id = null (foto hoort
  -- bij de hele LAN) gewoon toe.
  --
  -- Bewust GEEN `on delete set null` hier: bij een composite FK zet
  -- SET NULL ALLE kolommen van de FK (dus ook session_id) op null zodra de
  -- gerefereerde match verdwijnt — en session_id is hierboven `not null`,
  -- dus dat zou een constraint-fout geven zodra iemand een match verwijdert
  -- waar nog een foto aan gekoppeld is. In plaats daarvan: standaardgedrag
  -- (de FK-check faalt als er nog een referentie bestaat) + de trigger
  -- hieronder die match_id al vóór de eigenlijke delete losmaakt.
  constraint r6_session_media_match_session_fk
    foreign key (match_id, session_id) references public.r6_matches (id, session_id)
);

create index if not exists r6_session_media_session_id_idx on public.r6_session_media (session_id);
create index if not exists r6_session_media_match_id_idx on public.r6_session_media (match_id);

alter table public.r6_session_media enable row level security;

-- Ontkoppelt foto's van een match vlak vóórdat die match verwijderd wordt
-- (bv. via deleteR6Match), zodat de foto blijft bestaan op sessie-niveau
-- (match_id -> null) i.p.v. dat de delete faalt op de foreign key
-- hierboven, of dat de foto per ongeluk mee verdwijnt. Moet een BEFORE
-- DELETE-trigger zijn: de UPDATE hieronder moet vóór de eigenlijke DELETE
-- (en dus vóór de FK-check) uitgevoerd zijn.
create or replace function public.detach_r6_session_media_on_match_delete()
returns trigger
language plpgsql
as $$
begin
  update public.r6_session_media set match_id = null where match_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_detach_r6_session_media_on_match_delete on public.r6_matches;
create trigger trg_detach_r6_session_media_on_match_delete
  before delete on public.r6_matches
  for each row
  execute function public.detach_r6_session_media_on_match_delete();
