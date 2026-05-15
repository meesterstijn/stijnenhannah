import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, X } from "lucide-react";

type Note = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export default function Notities() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: fetchNotes,
  });

  const saveNote = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("notes")
          .update({ title, content, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notes")
          .insert({ title, content });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setOpen(false);
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setConfirmDelete(null);
      setOpen(false);
    },
  });

  function openNew() {
    setEditing(null);
    setTitle("");
    setContent("");
    setOpen(true);
  }

  function openEdit(note: Note) {
    setEditing(note);
    setTitle(note.title);
    setContent(note.content);
    setConfirmDelete(null);
    setOpen(true);
  }

  const hasContent = title.trim() || content.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Overzicht</p>
          <h1 className="font-serif text-3xl font-semibold mt-1">Notities</h1>
        </div>
        <Button onClick={openNew} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nieuwe notitie</span>
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!isLoading && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <p className="text-muted-foreground text-sm">Nog geen notities — maak er eentje aan.</p>
        </div>
      )}

      {notes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => openEdit(note)}
              className="text-left rounded-2xl border border-border/60 bg-card p-5 hover:border-border hover:shadow-sm transition-all space-y-2 group"
            >
              <p className="font-semibold text-base leading-tight line-clamp-1">
                {note.title || <span className="text-muted-foreground italic font-normal">Zonder titel</span>}
              </p>
              {note.content && (
                <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap leading-relaxed">
                  {note.content}
                </p>
              )}
              <p className="text-xs text-muted-foreground/60 pt-1">
                {new Date(note.updated_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </button>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); setConfirmDelete(null); }}>
        <SheetContent side="top" className="rounded-b-2xl max-h-[90vh] flex flex-col [&>button.absolute]:hidden">
          <div className="flex items-center justify-between gap-2 pb-3 shrink-0">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel..."
              className="text-base font-semibold border-0 shadow-none px-0 focus-visible:ring-0 bg-transparent h-auto"
            />
            <div className="flex items-center gap-2 shrink-0">
              {editing && !confirmDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDelete(editing.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {confirmDelete && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-xs"
                    onClick={() => setConfirmDelete(null)}
                  >
                    Annuleer
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="rounded-xl text-xs"
                    onClick={() => deleteNote.mutate(editing!.id)}
                    disabled={deleteNote.isPending}
                  >
                    Verwijder
                  </Button>
                </>
              )}
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </div>

          <div className="border-t border-border/40 -mx-6" />

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Schrijf hier je notitie..."
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed focus:outline-none py-4 min-h-[200px]"
          />

          <div className="pt-2 pb-1 shrink-0">
            <Button
              className="w-full rounded-xl"
              disabled={!hasContent || saveNote.isPending}
              onClick={() => saveNote.mutate()}
            >
              {saveNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Opslaan" : "Toevoegen"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
