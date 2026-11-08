import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookMarked,
  ChevronRight,
  Disc3,
  History,
  MessageSquareText,
  Scale,
  Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
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

// Aantal open feedbackmeldingen voor de owner (null = onbekend/offline).
function useOpenFeedbackCount(enabled: boolean) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void supabase
      .from("training_feedback")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null)
      .then(({ count, error }) => {
        if (!cancelled && !error) setCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return count;
}

export default function TrainingMeer() {
  const { isOwner } = useAuth();
  const openFeedback = useOpenFeedbackCount(isOwner);
  const links = isOwner
    ? [
        ...LINKS,
        {
          to: "/training/feedback",
          label:
            openFeedback && openFeedback > 0
              ? `Feedback (${openFeedback} open)`
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
