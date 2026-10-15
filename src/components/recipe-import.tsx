import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseRecipe, type ImportedRecipe } from "@/lib/recipe-import";

export function RecipeImport({ onImport, onManual }: {
  onImport: (recipe: ImportedRecipe) => void;
  onManual: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Plak een compleet recept uit ChatGPT. Gewone tekst en Markdown werken in hetzelfde veld. Je controleert het resultaat voordat je opslaat.</p>
      <label htmlFor="recipe-source" className="block text-sm font-medium">Je recept</label>
      <Textarea id="recipe-source" rows={12} value={text} maxLength={100000}
        placeholder={"# Pasta met tomaat\nTijd: 25 min\nPersonen: 2\n\n## Ingrediënten\n- 200 g pasta\n- 400 g tomaten\n\n## Bereiding\n1. Kook de pasta.\n2. Maak de saus en meng alles."}
        onChange={(event) => { request.current++; setReading(false); setText(event.target.value); setError(""); }} />
      <input ref={input} type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const id = ++request.current;
          setError("");
          if (!/\.(md|markdown|txt)$/i.test(file.name)) { setError("Kies een Markdown- of tekstbestand (.md of .txt)."); return; }
          if (file.size > 100000) { setError("Dit bestand is te groot. Kies een tekstbestand van maximaal 100 kB."); return; }
          setReading(true);
          try {
            const content = await file.text();
            if (id !== request.current) return;
            if (content.includes("\0")) throw new Error("Dit bestand bevat geen leesbare tekst.");
            setText(content);
          } catch {
            if (id === request.current) setError("Het bestand kon niet worden gelezen. Probeer de tekst te plakken.");
          } finally { if (id === request.current) setReading(false); }
        }} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!text.trim() || reading} onClick={() => onImport(parseRecipe(text))}>Recept verwerken</Button>
        <Button type="button" variant="outline" disabled={reading} onClick={() => input.current?.click()}>{reading ? "Bestand lezen…" : "Upload .md of .txt"}</Button>
        <Button type="button" variant="ghost" onClick={onManual}>Handmatig invoeren</Button>
      </div>
    </div>
  );
}
