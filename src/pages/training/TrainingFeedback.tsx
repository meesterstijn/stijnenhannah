import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, RefreshCw, RotateCcw, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/with-timeout";
import {
  EmptyState,
  Loading,
  PageHeader,
  Segment,
} from "@/features/training/components/ui";
import {
  KIND_LABELS,
  type FeedbackKind,
} from "@/features/training/feedback/feedback";

type Item = {
  id: string;
  user_id: string;
  kind: FeedbackKind;
  message: string;
  page_path: string;
  page_label: string | null;
  context: Record<string, unknown>;
  created_at: string;
  resolved_at: string | null;
  reply: string | null;
  replied_at: string | null;
};

type Filter = "open" | "done" | "all";

const DETAIL_KEYS: [string, string][] = [
  ["build", "Versie"],
  ["viewport", "Scherm"],
  ["standalone", "Als app geopend"],
  ["online", "Online"],
  ["open_session", "Lopende training"],
  ["local_time", "Tijd op toestel"],
  ["user_agent", "Browser"],
  ["url", "Volledige URL"],
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "–";
  if (typeof value === "boolean") return value ? "ja" : "nee";
  if (typeof value === "object") {
    const v = value as { name?: string; status?: string };
    return v.name ? `${v.name} (${v.status ?? "?"})` : JSON.stringify(value);
  }
  return String(value);
}

const dateFormat = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// Overzicht voor de owner: alle feedback uit de feedbackknop, nieuwste
// eerst, met een link naar de pagina waar die gegeven is.
export default function TrainingFeedback() {
  const { isOwner } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");

  const load = useCallback(async () => {
    setError(null);
    const response = await withTimeout(
      supabase
        .from("training_feedback")
        .select(
          "id, user_id, kind, message, page_path, page_label, context, created_at, resolved_at, reply, replied_at",
        )
        .order("created_at", { ascending: false })
        .limit(300),
    );
    const { data, error } = response ?? { data: null, error: true };
    if (error || !data) {
      setError("Laden lukte niet. Ben je online?");
      setItems((current) => current ?? []);
      return;
    }
    setItems(data as Item[]);
  }, []);

  useEffect(() => {
    if (isOwner) void load();
  }, [isOwner, load]);

  if (!isOwner) {
    return (
      <EmptyState title="Geen toegang">
        Alleen de beheerder ziet de feedback.
      </EmptyState>
    );
  }
  if (!items) return <Loading />;

  const setResolved = async (item: Item, resolved: boolean) => {
    const resolved_at = resolved ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("training_feedback")
      .update({ resolved_at })
      .eq("id", item.id);
    if (error) return setError("Opslaan lukte niet.");
    setItems((list) =>
      (list ?? []).map((i) => (i.id === item.id ? { ...i, resolved_at } : i)),
    );
  };

  // Reactie aan de melder: die ziet hem één keer in "Wat is er nieuw" en
  // altijd onder Meer → Updates. Versturen handelt de melding ook af.
  const sendReply = async (item: Item, reply: string) => {
    const now = new Date().toISOString();
    const patch = {
      reply: reply.trim(),
      replied_at: now,
      resolved_at: item.resolved_at ?? now,
    };
    const { error } = await supabase
      .from("training_feedback")
      .update(patch)
      .eq("id", item.id);
    if (error) return setError("Reactie opslaan lukte niet.");
    setItems((list) =>
      (list ?? []).map((i) => (i.id === item.id ? { ...i, ...patch } : i)),
    );
  };

  const remove = async (item: Item) => {
    if (!window.confirm("Deze feedback definitief verwijderen?")) return;
    const { error } = await supabase
      .from("training_feedback")
      .delete()
      .eq("id", item.id);
    if (error) return setError("Verwijderen lukte niet.");
    setItems((list) => (list ?? []).filter((i) => i.id !== item.id));
  };

  const openCount = items.filter((i) => !i.resolved_at).length;
  const shown = items.filter((i) =>
    filter === "all"
      ? true
      : filter === "open"
        ? !i.resolved_at
        : !!i.resolved_at,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feedback"
        subtitle={`${openCount} open · van de feedbackknop, met de pagina erbij`}
        actions={
          <button
            type="button"
            className="tr-btn tr-btn-ghost"
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" /> Vernieuwen
          </button>
        }
      />
      <Segment
        label="Filter"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "open", label: "Open" },
          { value: "done", label: "Afgehandeld" },
          { value: "all", label: "Alles" },
        ]}
      />
      {error && <p className="tr-banner tr-banner-warn">{error}</p>}
      {shown.length === 0 ? (
        <EmptyState title={filter === "open" ? "Niets open" : "Geen feedback"}>
          Feedback komt binnen via de knop rechtsonder op elke trainingspagina.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => {
            const reporter =
              (item.context.reporter_email as string | undefined) ??
              item.user_id.slice(0, 8);
            return (
              <li
                key={item.id}
                className="tr-card space-y-3 p-4"
                style={item.resolved_at ? { opacity: 0.65 } : undefined}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={`tr-chip ${item.kind === "fout" ? "tr-chip-warn" : ""}`}
                  >
                    {KIND_LABELS[item.kind] ?? item.kind}
                  </span>
                  {item.page_path.startsWith("/training") ? (
                    <Link
                      to={item.page_path}
                      className="tr-aqua-text min-w-0 font-semibold underline-offset-4 hover:underline"
                    >
                      {item.page_label ?? item.page_path}
                    </Link>
                  ) : (
                    <span className="font-semibold">
                      {item.page_label ?? item.page_path}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words">
                  {item.message}
                </p>
                <p className="tr-muted text-xs">
                  {reporter} · {dateFormat.format(new Date(item.created_at))}
                  {item.resolved_at && " · afgehandeld"}
                </p>
                <ReplyBox
                  item={item}
                  onSend={(text) => sendReply(item, text)}
                />
                <details className="text-xs">
                  <summary className="tr-muted cursor-pointer">
                    Details · <code>{item.page_path}</code>
                  </summary>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {DETAIL_KEYS.filter(([k]) => k in item.context).map(
                      ([key, label]) => (
                        <div key={key} className="contents">
                          <dt className="tr-muted">{label}</dt>
                          <dd className="break-all">
                            {formatValue(item.context[key])}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                </details>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="tr-btn tr-btn-secondary"
                    onClick={() => void setResolved(item, !item.resolved_at)}
                  >
                    {item.resolved_at ? (
                      <>
                        <RotateCcw className="h-4 w-4" /> Weer open
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" /> Afgehandeld
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="tr-btn tr-btn-quiet"
                    onClick={() => void remove(item)}
                    aria-label="Verwijderen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReplyBox({
  item,
  onSend,
}: {
  item: Item;
  onSend: (text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.reply ?? "");
  const [sending, setSending] = useState(false);

  if (item.reply && !editing) {
    return (
      <div className="tr-card-flat space-y-1 p-3 text-sm">
        <p className="tr-label">Jouw reactie</p>
        <p className="whitespace-pre-wrap break-words">{item.reply}</p>
        <button
          type="button"
          className="tr-muted text-xs underline-offset-4 hover:underline"
          onClick={() => setEditing(true)}
        >
          Wijzigen
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <textarea
        className="tr-textarea"
        rows={3}
        maxLength={2000}
        value={text}
        placeholder="Reactie aan de melder (ziet die bij Updates)"
        aria-label="Reactie aan de melder"
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className="tr-btn tr-btn-primary"
        disabled={!text.trim() || sending}
        onClick={async () => {
          setSending(true);
          await onSend(text);
          setSending(false);
          setEditing(false);
        }}
      >
        <Send className="h-4 w-4" />
        {item.reply ? "Reactie bijwerken" : "Reactie sturen"}
      </button>
    </div>
  );
}
