import { Bell, BellOff, X } from "lucide-react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

function todayLocalDateStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date + 24-hour time picker (native datetime-local silently switches to AM/PM based on OS locale — this doesn't). */
export function ReminderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [datePart, timePart] = value ? value.split("T") : ["", ""];
  const [hh, mm] = timePart ? timePart.split(":") : ["", ""];

  function update(date: string, hour: string, minute: string) {
    onChange(date && hour && minute ? `${date}T${hour}:${minute}` : "");
  }

  const selectClass =
    "text-xs bg-transparent border border-border/60 rounded-md px-1.5 py-1 focus:outline-none text-muted-foreground";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {value ? (
        <Bell className="h-3.5 w-3.5 text-primary shrink-0" />
      ) : (
        <BellOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <input
        type="date"
        value={datePart}
        onChange={(e) => update(e.target.value, hh || "09", mm || "00")}
        className={`${selectClass} [color-scheme:light] dark:[color-scheme:dark]`}
      />
      <select
        value={hh}
        onChange={(e) =>
          update(datePart || todayLocalDateStr(), e.target.value, mm || "00")
        }
        className={selectClass}
      >
        <option value="" disabled>
          uu
        </option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">:</span>
      <select
        value={mm}
        onChange={(e) =>
          update(datePart || todayLocalDateStr(), hh || "09", e.target.value)
        }
        className={selectClass}
      >
        <option value="" disabled>
          mm
        </option>
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
