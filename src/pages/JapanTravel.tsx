import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { ArrowLeft, Plus, Trash2, Pencil, X, Loader2, Languages, Volume2 } from "lucide-react";
import { toRomaji } from "wanakana";

type TravelPhrase = {
  id: string;
  category: string;
  phrase_nl: string;
  phrase_jp: string;
  phrase_romaji: string;
  sort_order: number;
};

const DEFAULT_CATEGORIES = ["Bestellen", "Eten", "Betalen", "OV", "Regelen", "Hulp"];

const LANG_PAIRS = [
  { label: "NL → JA", from: "NL", to: "JA" },
  { label: "JA → NL", from: "JA", to: "NL" },
  { label: "NL → EN", from: "NL", to: "EN-GB" },
  { label: "NL → DE", from: "NL", to: "DE" },
  { label: "NL → FR", from: "NL", to: "FR" },
  { label: "NL → ES", from: "NL", to: "ES" },
];

let cachedDeepLKey: string | null = null;

async function getDeepLKey(): Promise<string> {
  if (cachedDeepLKey) return cachedDeepLKey;
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "deepl_api_key")
    .single();
  if (error || !data?.value) throw new Error("DeepL sleutel niet ingesteld");
  cachedDeepLKey = data.value as string;
  return cachedDeepLKey;
}

function speakJapanese(text: string) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.85;
  utterance.pitch = 1;

  const doSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang === "ja-JP") ??
      voices.find((v) => v.lang.startsWith("ja"));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    doSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = doSpeak;
  }
}

async function translateText(text: string, from: string, to: string): Promise<string> {
  const apiKey = await getDeepLKey();
  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: [text], source_lang: from, target_lang: to }),
  });
  if (!res.ok) throw new Error(`DeepL fout (${res.status})`);
  const json = await res.json();
  return json.translations[0].text as string;
}

export function JapanTravel({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"zinnen" | "vertaler">("zinnen");
  const [showPhrase, setShowPhrase] = useState<TravelPhrase | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<TravelPhrase | null>(null);
  const [newNl, setNewNl] = useState("");
  const [newJp, setNewJp] = useState("");
  const [newRomaji, setNewRomaji] = useState("");
  const [newCategory, setNewCategory] = useState("Bestellen");
  const [isNewCat, setIsNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [inputText, setInputText] = useState("");
  const [langPair, setLangPair] = useState(LANG_PAIRS[0]);
  const [translating, setTranslating] = useState(false);
  const [result, setResult] = useState<{ text: string; romaji: string } | null>(null);
  const [transError, setTransError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: phrases = [], isLoading } = useQuery({
    queryKey: ["travel_phrases"],
    queryFn: async (): Promise<TravelPhrase[]> => {
      const { data, error } = await supabase
        .from("travel_phrases")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const categories = [
    ...new Set([...DEFAULT_CATEGORIES, ...phrases.map((p) => p.category)]),
  ];

  function openNew() {
    setEditing(null);
    setNewNl(""); setNewJp(""); setNewRomaji("");
    setNewCategory(categories[0] ?? "Bestellen");
    setIsNewCat(false); setNewCatName("");
    setSheetOpen(true);
  }

  function openEdit(phrase: TravelPhrase) {
    setEditing(phrase);
    setNewNl(phrase.phrase_nl);
    setNewJp(phrase.phrase_jp);
    setNewRomaji(phrase.phrase_romaji);
    setNewCategory(phrase.category);
    setIsNewCat(false); setNewCatName("");
    setSheetOpen(true);
  }

  const activeCategory = isNewCat ? newCatName.trim() : newCategory;

  const savePhrase = useMutation({
    mutationFn: async () => {
      const payload = {
        category: activeCategory,
        phrase_nl: newNl.trim(),
        phrase_jp: newJp.trim(),
        phrase_romaji: newRomaji.trim(),
      };
      if (editing) {
        const { error } = await supabase.from("travel_phrases").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("travel_phrases").insert({
          ...payload,
          sort_order: phrases.filter((p) => p.category === activeCategory).length + 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travel_phrases"] });
      setSheetOpen(false);
    },
  });

  const deletePhrase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("travel_phrases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["travel_phrases"] }),
  });

  async function handleTranslate() {
    if (!inputText.trim()) return;
    setTranslating(true);
    setTransError(null);
    setResult(null);
    try {
      const text = await translateText(inputText.trim(), langPair.from, langPair.to);
      const converted = toRomaji(text);
      const romaji = converted !== text ? converted : "";
      setResult({ text, romaji });
    } catch {
      setTransError("Vertaling mislukt. Probeer opnieuw.");
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-serif text-2xl font-semibold flex-1">Japan</h1>
        {tab === "zinnen" && (
          <Button size="sm" className="rounded-xl gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Zin
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit">
        {(["zinnen", "vertaler"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "zinnen" ? "Zinnen" : "Vertaler"}
          </button>
        ))}
      </div>

      {/* Zinnen */}
      {tab === "zinnen" && (
        isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((cat) => {
              const catPhrases = phrases.filter((p) => p.category === cat);
              if (catPhrases.length === 0) return null;
              return (
                <div key={cat} className="rounded-2xl bg-card border border-border/60 shadow-sm overflow-hidden">
                  <div className="px-5 py-2.5 bg-muted/30 border-b border-border/40">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
                  </div>
                  <div className="divide-y divide-border/40">
                    {catPhrases.map((phrase) => (
                      <div key={phrase.id} className="group flex items-start gap-3 px-5 py-4">
                        <button
                          onClick={() => {
                            setSpeaking(phrase.id);
                            const u = new SpeechSynthesisUtterance(phrase.phrase_jp);
                            u.lang = "ja-JP"; u.rate = 0.85;
                            u.onend = () => setSpeaking(null);
                            const doSpeak = () => {
                              const v = window.speechSynthesis.getVoices();
                              const voice = v.find((x) => x.lang === "ja-JP") ?? v.find((x) => x.lang.startsWith("ja"));
                              if (voice) u.voice = voice;
                              window.speechSynthesis.cancel();
                              window.speechSynthesis.speak(u);
                            };
                            window.speechSynthesis.getVoices().length > 0
                              ? doSpeak()
                              : (window.speechSynthesis.onvoiceschanged = doSpeak);
                          }}
                          className={`shrink-0 mt-1 transition-colors ${speaking === phrase.id ? "text-primary" : "text-muted-foreground/50 hover:text-primary"}`}
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                        <button className="flex-1 text-left" onClick={() => setShowPhrase(phrase)}>
                          <p className="text-xs text-muted-foreground mb-1">{phrase.phrase_nl}</p>
                          <p className="text-xl font-medium leading-snug">{phrase.phrase_jp}</p>
                          <p className="text-xs text-muted-foreground/70 italic mt-1">{phrase.phrase_romaji}</p>
                        </button>
                        <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-1">
                          <button onClick={() => openEdit(phrase)} className="text-muted-foreground/50 hover:text-primary transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deletePhrase.mutate(phrase.id)} className="text-muted-foreground/50 hover:text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {phrases.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">
                Nog geen zinnen — voeg er een toe.
              </p>
            )}
          </div>
        )
      )}

      {/* Vertaler */}
      {tab === "vertaler" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {LANG_PAIRS.map((lp) => (
              <button
                key={lp.label}
                onClick={() => { setLangPair(lp); setResult(null); setTransError(null); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  langPair.label === lp.label
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {lp.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTranslate(); } }}
              placeholder="Tekst om te vertalen…"
              rows={4}
              className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              className="w-full rounded-xl gap-2"
              disabled={!inputText.trim() || translating}
              onClick={handleTranslate}
            >
              {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Languages className="h-4 w-4" />Vertaal</>}
            </Button>
          </div>

          {transError && <p className="text-sm text-destructive">{transError}</p>}

          {result && (
            <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-3">
              <p className="text-2xl font-medium leading-relaxed">{result.text}</p>
              {result.romaji && (
                <p className="text-sm text-muted-foreground italic leading-relaxed">{result.romaji}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full-screen toon aan Japanner */}
      {showPhrase && (
        <div
          className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-10 text-center"
          onClick={() => setShowPhrase(null)}
        >
          <button
            className="absolute top-5 right-5 h-10 w-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowPhrase(null); }}
          >
            <X className="h-5 w-5" />
          </button>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-10">{showPhrase.phrase_nl}</p>
          <p className="text-5xl sm:text-6xl font-medium leading-relaxed mb-8">{showPhrase.phrase_jp}</p>
          <p className="text-base text-muted-foreground italic mb-10">{showPhrase.phrase_romaji}</p>
          <button
            onClick={(e) => { e.stopPropagation(); speakJapanese(showPhrase.phrase_jp); }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-muted hover:bg-accent transition-colors text-sm font-medium"
          >
            <Volume2 className="h-4 w-4" />
            Uitspreken
          </button>
        </div>
      )}

      {/* Zin toevoegen / bewerken */}
      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) setEditing(null); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col [&>button.absolute]:hidden p-0"
          style={{ height: "85svh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
            <p className="flex-1 font-semibold text-base">
              {editing ? "Zin bewerken" : "Nieuwe zin"}
            </p>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categorie</label>
              <select
                value={isNewCat ? "__new__" : newCategory}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setIsNewCat(true);
                  } else {
                    setIsNewCat(false);
                    setNewCategory(e.target.value);
                  }
                }}
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ Nieuwe categorie…</option>
              </select>
              {isNewCat && (
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Naam nieuwe categorie…"
                  className="bg-card"
                  autoFocus
                />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nederlands</label>
              <Input value={newNl} onChange={(e) => setNewNl(e.target.value)} placeholder="Nederlandse zin…" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Japans (tekens)</label>
              <Input value={newJp} onChange={(e) => setNewJp(e.target.value)} placeholder="日本語…" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Uitspraak (romaji)</label>
              <Input value={newRomaji} onChange={(e) => setNewRomaji(e.target.value)} placeholder="Bijv. Onegaishimasu" className="bg-card" />
            </div>
          </div>
          <div className="px-5 pt-2 pb-6 shrink-0 border-t border-border/40">
            <Button
              className="w-full rounded-xl"
              disabled={!newNl.trim() || !newJp.trim() || !activeCategory || savePhrase.isPending}
              onClick={() => savePhrase.mutate()}
            >
              {savePhrase.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Opslaan" : "Toevoegen"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
