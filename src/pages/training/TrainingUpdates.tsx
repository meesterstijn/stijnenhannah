import { useEffect, useState } from "react";
import { PageHeader } from "@/features/training/components/ui";
import { useTraining } from "@/features/training/hooks/TrainingProvider";
import {
  fetchMyFeedback,
  type MyFeedback,
} from "@/features/training/updates/my-feedback";
import { recentUpdates } from "@/features/training/updates/updates";
import { ReplyView, UpdateView } from "@/features/training/updates/UpdateViews";

// Meer → Updates: de laatste (max. 10) updates en de eigen feedback met de
// reactie van de beheerder.
export default function TrainingUpdates() {
  const { userId } = useTraining();
  const [feedback, setFeedback] = useState<MyFeedback[] | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    void fetchMyFeedback(userId, 20).then((list) => {
      if (!cancelled) setFeedback(list);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Updates"
        subtitle="Wat er de laatste tijd in Training is veranderd."
      />
      {feedback && feedback.length > 0 && (
        <section className="space-y-2">
          <h2 className="tr-label">Jouw feedback</h2>
          {feedback.map((f) => (
            <ReplyView key={f.id} feedback={f} />
          ))}
        </section>
      )}
      {feedback === null && (
        <p className="tr-muted text-sm">
          Je feedback en reacties zie je hier zodra je online bent.
        </p>
      )}
      <ul className="space-y-3">
        {recentUpdates().map((u) => (
          <li key={u.id} className="tr-card p-4">
            <UpdateView update={u} />
          </li>
        ))}
      </ul>
    </div>
  );
}
