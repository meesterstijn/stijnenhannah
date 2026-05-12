import { useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Check } from "lucide-react";

type Item = { id: string; text: string; done: boolean };

export default function Boodschappen() {
  const [items, setItems] = useLocalStorage<Item[]>("groceries", []);
  const [text, setText] = useState("");

  function add() {
    const t = text.trim();
    if (!t) return;
    setItems([{ id: crypto.randomUUID(), text: t, done: false }, ...items]);
    setText("");
  }

  function toggle(id: string) {
    setItems(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  }

  function remove(id: string) {
    setItems(items.filter((i) => i.id !== id));
  }

  function clearDone() {
    setItems(items.filter((i) => !i.done));
  }

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Lijstje</p>
        <h1 className="font-serif text-4xl font-semibold mt-2">Boodschappen</h1>
        <p className="text-muted-foreground mt-2">
          {open.length} nog te halen · {done.length} in het mandje
        </p>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Bijv. avocado's, brood, kaas…"
          className="bg-card"
        />
        <Button type="submit" size="lg" className="rounded-xl">
          <Plus className="h-4 w-4" /> Voeg toe
        </Button>
      </form>

      <section className="rounded-2xl bg-card border border-border/60 divide-y divide-border/50 overflow-hidden">
        {open.length === 0 && done.length === 0 && (
          <p className="p-8 text-center text-muted-foreground text-sm">
            Nog geen boodschappen — voeg er eentje toe ✨
          </p>
        )}
        {open.map((i) => (
          <Row key={i.id} item={i} onToggle={toggle} onRemove={remove} />
        ))}
      </section>

      {done.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Gehaald
            </h2>
            <button
              onClick={clearDone}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Wis lijst
            </button>
          </div>
          <div className="rounded-2xl bg-card/60 border border-border/40 divide-y divide-border/40">
            {done.map((i) => (
              <Row key={i.id} item={i} onToggle={toggle} onRemove={remove} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({
  item, onToggle, onRemove,
}: {
  item: Item;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-4 group">
      <button
        onClick={() => onToggle(item.id)}
        aria-label="Toggle"
        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          item.done
            ? "bg-primary border-primary text-primary-foreground"
            : "border-border hover:border-primary"
        }`}
      >
        {item.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>
      <span className={`flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>
        {item.text}
      </span>
      <button
        onClick={() => onRemove(item.id)}
        aria-label="Verwijder"
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
