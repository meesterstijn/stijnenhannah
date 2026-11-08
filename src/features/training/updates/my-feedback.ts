import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/with-timeout";
import type { FeedbackKind } from "@/features/training/feedback/feedback";

// Eigen feedback met de reactie van de beheerder (training_feedback, kolommen
// reply/replied_at). Expliciet op user_id: de owner mag via RLS alles lezen,
// maar ziet hier alleen de eigen meldingen.

export type MyFeedback = {
  id: string;
  kind: FeedbackKind;
  message: string;
  page_label: string | null;
  created_at: string;
  resolved_at: string | null;
  reply: string | null;
  replied_at: string | null;
};

/** null = niet gelukt (offline of fout). */
export async function fetchMyFeedback(
  userId: string,
  limit = 50,
): Promise<MyFeedback[] | null> {
  const response = await withTimeout(
    supabase
      .from("training_feedback")
      .select(
        "id, kind, message, page_label, created_at, resolved_at, reply, replied_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  if (!response || response.error || !response.data) return null;
  return response.data as MyFeedback[];
}

/** Reacties die nieuwer zijn dan wat de gebruiker al zag. */
export function newReplies(
  list: MyFeedback[],
  lastSeenReplyAt: string | null | undefined,
): MyFeedback[] {
  const since = lastSeenReplyAt ? Date.parse(lastSeenReplyAt) : -Infinity;
  return list
    .filter((f) => f.reply && f.replied_at && Date.parse(f.replied_at) > since)
    .sort((a, b) => Date.parse(b.replied_at!) - Date.parse(a.replied_at!));
}

export function latestReplyAt(list: MyFeedback[]): string | null {
  let best: string | null = null;
  for (const f of list) {
    if (f.replied_at && (!best || Date.parse(f.replied_at) > Date.parse(best)))
      best = f.replied_at;
  }
  return best;
}
