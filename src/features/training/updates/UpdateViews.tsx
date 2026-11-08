import { MessageSquareReply } from "lucide-react";
import { formatUpdateDate, type TrainingUpdate } from "./updates";
import type { MyFeedback } from "./my-feedback";

export function UpdateView({ update }: { update: TrainingUpdate }) {
  return (
    <article className="space-y-3">
      <header>
        <p className="tr-label">{formatUpdateDate(update.date)}</p>
        <h3 className="tr-h2 text-base">{update.title}</h3>
      </header>
      <ul className="space-y-3">
        {update.items.map((item) => (
          <li key={item.title} className="space-y-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {item.title}
              {item.fromFeedback && (
                <span className="tr-chip tr-chip-aqua">
                  Op basis van feedback
                </span>
              )}
            </p>
            <p className="tr-ink-2 text-sm">{item.text}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}

const shortDate = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
});

export function ReplyView({ feedback }: { feedback: MyFeedback }) {
  const message =
    feedback.message.length > 160
      ? `${feedback.message.slice(0, 160).trimEnd()}…`
      : feedback.message;
  return (
    <div className="tr-card-flat space-y-2 p-3">
      <p className="tr-muted text-xs">
        Jouw feedback
        {feedback.page_label ? ` over ${feedback.page_label}` : ""} ·{" "}
        {shortDate.format(new Date(feedback.created_at))}
      </p>
      <p className="tr-ink-2 whitespace-pre-wrap break-words text-sm italic">
        "{message}"
      </p>
      {feedback.reply ? (
        <p className="flex gap-2 text-sm">
          <MessageSquareReply className="tr-aqua-text mt-0.5 h-4 w-4 shrink-0" />
          <span className="whitespace-pre-wrap break-words">
            {feedback.reply}
          </span>
        </p>
      ) : (
        <p className="tr-muted text-xs">
          {feedback.resolved_at ? "Afgehandeld" : "Ontvangen, nog geen reactie"}
        </p>
      )}
    </div>
  );
}
