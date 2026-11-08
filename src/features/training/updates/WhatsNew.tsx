import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Sheet } from "@/features/training/components/ui";
import { updateProfile } from "@/features/training/db/repository";
import { useTraining } from "@/features/training/hooks/TrainingProvider";
import { useProfile } from "@/features/training/hooks/useTrainingData";
import { UPDATES, unseenUpdates } from "./updates";
import {
  fetchMyFeedback,
  latestReplyAt,
  newReplies,
  type MyFeedback,
} from "./my-feedback";
import { ReplyView, UpdateView } from "./UpdateViews";

// Eenmalig venster met nieuwe updates en reacties op eigen feedback. Wat
// gezien is staat in de (gesynchroniseerde) instellingen, dus ook op een
// ander toestel niet nog eens. Alleen tonen als het eigen profiel lokaal
// al bestond: anders zou "gezien" een leeg standaardprofiel aanmaken dat
// botst met het profiel op de server dat nog binnenkomt.
export function WhatsNew({ suppressed }: { suppressed: boolean }) {
  const { db, userId } = useTraining();
  const profile = useProfile();
  const hasProfile = useLiveQuery(
    async () => !!(await db.profiles.get(userId)),
    [db, userId],
  );
  // Alleen bij het openen van Training: bestond het profiel toen nog niet
  // (nieuwe gebruiker die net een schema kiest, of een nieuw toestel waar
  // de sync nog loopt), dan pas bij een volgend bezoek.
  const [atStart, setAtStart] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (atStart === undefined && hasProfile !== undefined)
      setAtStart(hasProfile);
  }, [atStart, hasProfile]);
  const [feedback, setFeedback] = useState<MyFeedback[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!atStart) return;
    let cancelled = false;
    void fetchMyFeedback(userId).then((list) => {
      // Offline: dan alleen de updates.
      if (!cancelled) setFeedback(list ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [atStart, userId]);

  const { lastSeenUpdate, lastSeenReplyAt } = profile.settings;
  const updates = unseenUpdates(lastSeenUpdate);
  const replies = newReplies(feedback ?? [], lastSeenReplyAt);

  const close = useCallback(() => {
    setDismissed(true);
    const seenReply = latestReplyAt(feedback ?? []);
    void updateProfile(db, userId, (p) => ({
      ...p,
      settings: {
        ...p.settings,
        lastSeenUpdate: UPDATES[0]?.id ?? p.settings.lastSeenUpdate ?? null,
        lastSeenReplyAt: seenReply ?? p.settings.lastSeenReplyAt ?? null,
      },
    }));
  }, [db, userId, feedback]);

  const open =
    !suppressed &&
    !dismissed &&
    atStart === true &&
    feedback !== null &&
    (updates.length > 0 || replies.length > 0);

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Wat is er nieuw"
      footer={
        <>
          <Link
            to="/training/updates"
            className="tr-btn tr-btn-ghost"
            onClick={close}
          >
            Alle updates
          </Link>
          <button
            type="button"
            className="tr-btn tr-btn-primary"
            onClick={close}
          >
            Begrepen
          </button>
        </>
      }
    >
      {replies.length > 0 && (
        <section className="space-y-2">
          <h3 className="tr-h2 text-base">Reactie op jouw feedback</h3>
          {replies.map((f) => (
            <ReplyView key={f.id} feedback={f} />
          ))}
        </section>
      )}
      {updates.map((u) => (
        <UpdateView key={u.id} update={u} />
      ))}
    </Sheet>
  );
}
