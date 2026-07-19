import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, type Plant } from "@/lib/supabase";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const MONTH_NAMES = [
  "Januari","Februari","Maart","April","Mei","Juni",
  "Juli","Augustus","September","Oktober","November","December",
];
const SHORT_DAYS = ["Ma","Di","Wo","Do","Vr","Za","Zo"];

type TaskType = "zaaien" | "bloei" | "oogsten" | "water" | "bemesten";

interface CalendarTask {
  type: TaskType;
  plants: string[];
}

const TASK_COLORS: Record<TaskType, string> = {
  zaaien: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  bloei: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  oogsten: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  water: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  bemesten: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

const TASK_EMOJI: Record<TaskType, string> = {
  zaaien: "🌱", bloei: "🌸", oogsten: "🍅", water: "💧", bemesten: "🌿",
};

const MONTH_OPTIONS = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december",
];

export default function TuingidsKalender() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["plants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plants").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Plant[];
    },
  });

  const monthName = MONTH_OPTIONS[month];

  // Get tasks for the current month
  const monthTasksRaw: CalendarTask[] = [
    { type: "zaaien" as TaskType, plants: plants.filter((p) => p.sow_months?.includes(monthName)).map((p) => p.name) },
    { type: "bloei" as TaskType, plants: plants.filter((p) => p.bloom_months?.includes(monthName)).map((p) => p.name) },
    { type: "oogsten" as TaskType, plants: plants.filter((p) => p.harvest_months?.includes(monthName)).map((p) => p.name) },
  ];
  const monthTasks = monthTasksRaw.filter((t) => t.plants.length > 0);

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Mon=0 offset
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1);
    setSelectedDay(null);
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tuingids</p>
        <h1 className="font-serif text-3xl font-semibold mt-1">Kalender</h1>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="h-9 w-9 rounded-xl border border-border flex items-center justify-center hover:bg-accent/30 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="flex-1 text-center font-semibold">{MONTH_NAMES[month]} {year}</p>
        <button onClick={nextMonth} className="h-9 w-9 rounded-xl border border-border flex items-center justify-center hover:bg-accent/30 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border/60">
          {SHORT_DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSelected = day === selectedDay;
            return (
              <button
                key={i}
                type="button"
                disabled={!day}
                onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                className={`relative py-3 text-sm transition-colors ${!day ? "opacity-0 pointer-events-none" : "hover:bg-accent/30"} ${isSelected ? "bg-primary/10" : ""}`}
              >
                {day && (
                  <span className={`mx-auto h-7 w-7 flex items-center justify-center rounded-full text-sm ${isToday ? "bg-primary text-primary-foreground font-bold" : ""}`}>
                    {day}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Month overview */}
      {monthTasks.length > 0 && (
        <div className="space-y-3">
          <p className="font-semibold text-sm">Deze maand — {MONTH_NAMES[month]}</p>
          {monthTasks.map((task) => (
            <div key={task.type} className="rounded-2xl border border-border/60 bg-card p-4 space-y-2">
              <p className="text-sm font-medium">
                <span className="mr-1.5">{TASK_EMOJI[task.type]}</span>
                {task.type.charAt(0).toUpperCase() + task.type.slice(1)}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {task.plants.map((name) => (
                  <span key={name} className={`text-xs rounded-full px-2.5 py-1 ${TASK_COLORS[task.type]}`}>{name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {monthTasks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Geen taken gepland voor {MONTH_NAMES[month].toLowerCase()}.</p>
      )}
    </div>
  );
}
