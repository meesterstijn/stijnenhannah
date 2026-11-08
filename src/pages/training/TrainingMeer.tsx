import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookMarked,
  ChevronRight,
  Disc3,
  History,
  ListChecks,
  MessageSquareText,
  Scale,
  Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/with-timeout";
import { PlateCalculator } from "@/features/training/components/PlateCalculator";
import { PageHeader } from "@/features/training/components/ui";

const LINKS = [
  {
    to: "/training/historie",
    label: "Historie en kalender",
    desc: "Alle trainingen terugkijken en corrigeren",
    icon: History,
  },
  {
    to: "/training/lichaam",
    label: "Lichaamsgewicht",
    desc: "Gewicht per datum en lichaamsmaten",
    icon: Scale,
  },
  {
    to: "/training/schijven",
    label: "Schijvencalculator",
    desc: "Welke schijven op de stang of dumbbells",
    icon: Disc3,
  },
  {
    to: "/training/bibliotheek",
    label: "Trainingsbibliotheek",
    desc: "Schema's met uitgangspunten en bronnen",
    icon: BookMarked,
  },
  {
    to: "/training/instellingen",
    label: "Instellingen en apparatuur",
    desc: "Profiel, timer, schijven, export, sync",
    icon: Settings,
  },
];

// Tellers voor de owner: open feedback en oefeningen die op beoordeling
// wachten (null = onbekend/offline).
function useOwnerCounts(enabled: boolean) {
  const [counts, setCounts] = useState<{
    feedback: number | null;
    exercises: number | null;
  }>({ feedback: null, exercises: null });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void withTimeout(
      supabase
        .from("training_feedback")
        .select("id", { count: "exact", head: true })
        .is("resolved_at", null),
    ).then((r) => {
      if (!cancelled && r && !r.error)
        setCounts((c) => ({ ...c, feedback: r.count ?? 0 }));
    });
    void withTimeout(supabase.rpc("training_exercise_submissions")).then(
      (r) => {
        if (!cancelled && r && !r.error && Array.isArray(r.data))
          setCounts((c) => ({
            ...c,
            exercises: (r.data as { status: string | null }[]).filter(
              (s) => !s.status,
            ).length,
          }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return counts;
}

export default function TrainingMeer() {
  const { isOwner } = useAuth();
  const counts = useOwnerCounts(isOwner);
  const links = isOwner
    ? [
        ...LINKS,
        {
          to: "/training/oefeningen-beoordelen",
          label: counts.exercises
            ? `Nieuwe oefeningen (${counts.exercises} wachten)`
            : "Nieuwe oefeningen",
          desc: "Eigen oefeningen van anderen goedkeuren voor iedereen",
          icon: ListChecks,
        },
        {
          to: "/training/feedback",
          label: counts.feedback
            ? `Feedback (${counts.feedback} open)`
            : "Feedback",
          desc: "Wat testers melden, met de pagina erbij",
          icon: MessageSquareText,
        },
      ]
    : LINKS;
  return (
    <div className="space-y-4">
      <PageHeader title="Meer" />
      <ul className="space-y-2">
        {links.map(({ to, label, desc, icon: Icon }) => (
          <li key={to}>
            <Link to={to} className="tr-card flex items-center gap-3 p-4">
              <Icon className="tr-aqua-text h-6 w-6 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="tr-muted text-sm">{desc}</span>
              </span>
              <ChevronRight className="tr-muted h-5 w-5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrainingSchijven() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Schijvencalculator"
        subtitle="Rekent met je eigen voorraad (Instellingen → Apparatuur) en laadt altijd aan beide kanten hetzelfde."
      />
      <section className="tr-card p-4">
        <PlateCalculator loadMode="barbell" targetKg={null} />
      </section>
    </div>
  );
}
