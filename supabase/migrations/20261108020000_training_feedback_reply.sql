-- Reactie van de owner op feedback, zodat de melder ziet wat ermee gedaan
-- is (in het "Wat is er nieuw"-venster en onder Meer → Updates).
--
-- Schrijven kan alleen de owner (bestaande update-policy). De melder leest
-- de eigen feedback al via "Feedback lezen", dus ook de reactie.

begin;

alter table public.training_feedback
  add column if not exists reply text
    check (reply is null or char_length(btrim(reply)) between 1 and 2000),
  add column if not exists replied_at timestamptz;

-- Een nieuwe melding heeft nooit al een reactie.
drop policy if exists "Feedback toevoegen" on public.training_feedback;
create policy "Feedback toevoegen" on public.training_feedback
  for insert to authenticated
  with check (
    private.can_use_training()
    and user_id = auth.uid()
    and resolved_at is null
    and reply is null
    and replied_at is null
  );

commit;
