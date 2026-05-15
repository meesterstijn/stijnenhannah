import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Circle, CheckCircle2, Trash2, Loader2 } from "lucide-react";

type Todo = {
  id: string;
  text: string;
  done: boolean;
  created_at: string;
};

async function fetchTodos(): Promise<Todo[]> {
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export default function Todo() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
  });

  const addTodo = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase
        .from("todos")
        .insert({ text, done: false, created_by: session?.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      setText("");
      inputRef.current?.focus();
    },
  });

  const toggleTodo = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("todos").update({ done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });

  const deleteTodo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("todos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });

  const clearDone = useMutation({
    mutationFn: async () => {
      const ids = todos.filter((t) => t.done).map((t) => t.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from("todos").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    addTodo.mutate(t);
  }

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Overzicht</p>
          <h1 className="font-serif text-3xl font-semibold mt-1">To-do</h1>
        </div>
        {done.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl text-xs text-muted-foreground mb-1"
            onClick={() => clearDone.mutate()}
            disabled={clearDone.isPending}
          >
            {clearDone.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : `Wis ${done.length} gedaan`}
          </Button>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nieuwe taak..."
          className="bg-card"
          autoComplete="off"
        />
        <Button type="submit" className="rounded-xl shrink-0" disabled={!text.trim() || addTodo.isPending}>
          {addTodo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Voeg toe"}
        </Button>
      </form>

      {/* List */}
      {isLoading && (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!isLoading && todos.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">
          Geen taken — voeg er een toe.
        </p>
      )}

      {(open.length > 0 || done.length > 0) && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/50">
          {open.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              onToggle={() => toggleTodo.mutate({ id: todo.id, done: true })}
              onDelete={() => deleteTodo.mutate(todo.id)}
            />
          ))}

          {done.length > 0 && open.length > 0 && (
            <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30">
              Gedaan
            </div>
          )}

          {done.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              onToggle={() => toggleTodo.mutate({ id: todo.id, done: false })}
              onDelete={() => deleteTodo.mutate(todo.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TodoRow({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 group hover:bg-accent/30 transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
        aria-label={todo.done ? "Markeer als open" : "Markeer als gedaan"}
      >
        {todo.done ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>
      <span className={`flex-1 text-sm ${todo.done ? "line-through text-muted-foreground" : ""}`}>
        {todo.text}
      </span>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all"
        aria-label="Verwijder"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
