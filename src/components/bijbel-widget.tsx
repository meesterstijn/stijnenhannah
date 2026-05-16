import { useQuery } from "@tanstack/react-query";
import { BookOpen, ExternalLink } from "lucide-react";

type Verse = {
  bookname: string;
  chapter: string;
  verse: string;
  text: string;
};

async function fetchVerse(): Promise<Verse> {
  const res = await fetch("https://labs.bible.org/api/?passage=votd&type=json");
  if (!res.ok) throw new Error("Kon tekst niet laden");
  const data = await res.json();
  return data[0];
}

export function BijbelWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["bijbel-votd"],
    queryFn: fetchVerse,
    staleTime: 1000 * 60 * 60 * 6,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-amber-50/60 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/20 border border-border/60 p-5 flex flex-col gap-3 animate-pulse min-h-[200px]">
        <div className="h-5 w-5 rounded bg-muted-foreground/20" />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-full rounded bg-muted-foreground/20" />
          <div className="h-3 w-5/6 rounded bg-muted-foreground/20" />
          <div className="h-3 w-4/6 rounded bg-muted-foreground/20" />
        </div>
        <div className="h-3 w-24 rounded bg-muted-foreground/20" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-border/60 p-5 flex flex-col justify-between min-h-[200px]">
        <BookOpen className="h-5 w-5 text-primary/60" strokeWidth={1.6} />
        <p className="text-sm text-muted-foreground">Tekst kon niet geladen worden.</p>
        <a
          href="https://www.debijbel.nl"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          Open de Bijbel <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  const reference = `${data.bookname} ${data.chapter}:${data.verse}`;
  const cleanText = data.text.replace(/<[^>]*>/g, "").trim();

  return (
    <a
      href="https://www.debijbel.nl"
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-2xl bg-gradient-to-br from-amber-50/60 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/20 border border-border/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col gap-3 min-h-[200px]"
    >
      <div className="flex items-center justify-between">
        <BookOpen className="h-5 w-5 text-amber-700 dark:text-amber-400" strokeWidth={1.6} />
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Tekst van de dag</span>
      </div>
      <p className="flex-1 text-sm leading-relaxed text-foreground/90 line-clamp-5 italic">
        "{cleanText}"
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{reference}</span>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </a>
  );
}
