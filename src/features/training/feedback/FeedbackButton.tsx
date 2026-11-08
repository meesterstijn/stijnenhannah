import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Check, Loader2, MessageSquarePlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet } from "@/features/training/components/ui";
import { useOpenSession } from "@/features/training/hooks/useTrainingData";
import {
  FEEDBACK_KINDS,
  MAX_MESSAGE,
  collectContext,
  enqueue,
  flushQueue,
  pageLabelFor,
  type FeedbackKind,
} from "./feedback";

type Phase = "idle" | "sending" | "sent" | "queued" | "error";

type Target = { path: string; label: string; heading: string | null };

function currentHeading(): string | null {
  return (
    document
      .querySelector(".training-theme h1")
      ?.textContent?.replace(/\s+/g, " ")
      .trim() || null
  );
}

// Vaste knop rechtsonder op elke trainingspagina (ook tijdens een training).
// De pagina wordt vastgelegd op het moment van openen, dus precies waar de
// gebruiker was. Een half getypt bericht blijft bewaard bij sluiten.
export function FeedbackButton({ low = false }: { low?: boolean }) {
  const { session } = useAuth();
  const { pathname, search } = useLocation();
  const openSession = useOpenSession();
  const userId = session?.user.id ?? null;

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Eerder offline opgeslagen feedback alsnog versturen.
  useEffect(() => {
    if (!userId) return;
    const flush = () => void flushQueue(userId);
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [userId]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const openSheet = () => {
    const heading = currentHeading();
    setTarget({
      path: `${pathname}${search}`,
      label: pageLabelFor(pathname, heading),
      heading,
    });
    if (phase !== "sending") setPhase("idle");
    setOpen(true);
  };

  const close = useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(false);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || !userId || !target || phase === "sending") return;
    setPhase("sending");
    const id = crypto.randomUUID();
    enqueue({
      id,
      user_id: userId,
      kind: kind ?? "opmerking",
      message: text.slice(0, MAX_MESSAGE),
      page_path: target.path.slice(0, 500),
      page_label: target.label.slice(0, 200),
      context: collectContext({
        heading: target.heading,
        reporter_email: session?.user.email ?? null,
        open_session: openSession
          ? { name: openSession.name, status: openSession.status }
          : null,
      }),
    });
    const result = await flushQueue(userId);
    if (result.rejected.includes(id)) {
      setPhase("error");
      return;
    }
    setPhase(result.sent.includes(id) ? "sent" : "queued");
    setMessage("");
    setKind(null);
    closeTimer.current = setTimeout(close, 1800);
  };

  const done = phase === "sent" || phase === "queued";

  return (
    <>
      <button
        type="button"
        className="tr-feedback-fab"
        data-low={low || undefined}
        onClick={openSheet}
        aria-label="Feedback geven over deze pagina"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span>Feedback</span>
      </button>
      <Sheet open={open} onClose={close} title="Feedback">
        {done ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="tr-chip tr-chip-aqua">
              <Check className="h-4 w-4" />
              {phase === "sent" ? "Verstuurd" : "Bewaard"}
            </span>
            <p className="tr-muted text-sm">
              {phase === "sent"
                ? "Bedankt! Hier wordt naar gekeken."
                : "Geen verbinding. Wordt vanzelf verstuurd zodra je weer online bent."}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="tr-muted text-sm">
              Over:{" "}
              <span className="tr-ink-2 font-medium">{target?.label}</span>
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Soort feedback (optioneel)"
            >
              {FEEDBACK_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  className="tr-chip"
                  aria-pressed={kind === k.value}
                  onClick={() => setKind(kind === k.value ? null : k.value)}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <textarea
              className="tr-textarea"
              rows={4}
              autoFocus
              maxLength={MAX_MESSAGE}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (phase === "error") setPhase("idle");
              }}
              placeholder="Wat ging er mis, wat is onduidelijk of wat kan beter?"
              aria-label="Je feedback"
            />
            {phase === "error" && (
              <p className="tr-danger-text text-sm">
                Versturen lukte niet. Probeer het later nog eens.
              </p>
            )}
            <button
              type="submit"
              className="tr-btn tr-btn-primary tr-btn-block"
              disabled={!message.trim() || phase === "sending"}
            >
              {phase === "sending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Versturen"
              )}
            </button>
          </form>
        )}
      </Sheet>
    </>
  );
}
