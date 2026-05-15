import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
  console.log("[notes] fetch:", { data, error });
  if (error) throw error;
  return data ?? [];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Notities() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: notes = [], isLoading, error: fetchError } = useQuery({
    queryKey: ["notes"],
    queryFn: fetchNotes,
  });

  const saveNote = useMutation({
    mutationFn: async () => {
      if (activeNote) {
        const { error } = await supabase
          .from("notes")
          .update({ title, content, updated_at: new Date().toISOString() })
          .eq("id", activeNote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notes")
          .insert({ title, content, created_by: session?.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      console.log("[notes] save success");
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setSaveError(null);
      setSheetOpen(false);
      setIsNew(false);
      setActiveNote(null);
    },
    onError: (err: Error) => {
      console.error("[notes] save error:", err);
      setSaveError(err.message);
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setActiveNote(null);
      setIsNew(false);
      setTitle("");
      setContent("");
      setConfirmDelete(false);
      setSheetOpen(false);
    },
  });

  function selectNoteDesktop(note: Note) {
    setActiveNote(note);
    setIsNew(false);
    setTitle(note.title);
    setContent(note.content);
    setConfirmDelete(false);
    setSaveError(null);
  }

  function selectNoteMobile(note: Note) {
    selectNoteDesktop(note);
    setSheetOpen(true);
  }

  function startNewDesktop() {
    setActiveNote(null);
    setIsNew(true);
    setTitle("");
    setContent("");
    setConfirmDelete(false);
    setSaveError(null);
  }

  function startNewMobile() {
    startNewDesktop();
    setSheetOpen(true);
  }

  const hasContent = title.trim() || content.trim();
  const isEditing = !!activeNote || isNew;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Persoonlijk</p>
        <h1 className="font-serif text-3xl font-semibold mt-1">Notities</h1>
      </div>

      {fetchError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">
          Fout bij laden: {(fetchError as Error).message}
        </p>
      )}

      {/* ── Desktop: two-panel ── */}
      <div className="hidden lg:flex rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ minHeight: 520 }}>
        {/* Left: list */}
        <div className="w-[260px] shrink-0 border-r border-border/60 flex flex-col">
          <div className="px-4 py-3 flex items-center justify-end border-b border-border/40 shrink-0">
            <Button size="sm" onClick={startNewDesktop} className="rounded-xl h-8 text-xs gap-1 px-2.5">
              <Plus className="h-3.5 w-3.5" />
              Nieuw
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {!isLoading && notes.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nog geen notities.</p>
            )}
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => selectNoteDesktop(note)}
                className={`w-full text-left px-4 py-3 hover:bg-accent/40 transition-colors ${
                  activeNote?.id === note.id ? "bg-accent/60" : ""
                }`}
              >
                <p className="font-semibold text-sm leading-tight truncate">
                  {note.title || (
                    <span className="text-muted-foreground font-normal italic">Zonder titel</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{formatDate(note.updated_at)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right: editor */}
        <div className="flex-1 min-w-0 flex flex-col">
          {isEditing ? (
            <>
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40 shrink-0">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titel..."
                  className="flex-1 min-w-0 text-base font-semibold bg-transparent focus:outline-none placeholder:text-muted-foreground/40"
                />
                {activeNote && !confirmDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {confirmDelete && (
                  <>
                    <Button type="button" variant="ghost" size="sm" className="rounded-xl text-xs"
                      onClick={() => setConfirmDelete(false)}>
                      Annuleer
                    </Button>
                    <Button type="button" variant="destructive" size="sm" className="rounded-xl text-xs"
                      disabled={deleteNote.isPending}
                      onClick={() => deleteNote.mutate(activeNote!.id)}>
                      {deleteNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verwijder"}
                    </Button>
                  </>
                )}
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Schrijf hier je notitie..."
                className="flex-1 resize-none bg-transparent text-sm leading-relaxed focus:outline-none px-5 py-4"
              />
              {saveError && (
                <p className="px-5 pb-1 text-xs text-destructive shrink-0">{saveError}</p>
              )}
              <div className="px-5 py-3 border-t border-border/40 shrink-0">
                <Button
                  className="w-full rounded-xl"
                  disabled={!hasContent || saveNote.isPending}
                  onClick={() => saveNote.mutate()}
                >
                  {saveNote.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : activeNote ? "Opslaan" : "Toevoegen"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecteer een notitie of maak een nieuwe aan
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile: list ── */}
      <div className="lg:hidden space-y-3">
        <Button onClick={startNewMobile} className="rounded-xl gap-2 w-full">
          <Plus className="h-4 w-4" />
          Nieuwe notitie
        </Button>
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && notes.length === 0 && (
          <p className="text-center py-12 text-sm text-muted-foreground">Nog geen notities.</p>
        )}
        <div className="space-y-3">
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => selectNoteMobile(note)}
              className="w-full text-left rounded-2xl border border-border/60 bg-card p-5 hover:border-border transition-all space-y-1"
            >
              <p className="font-semibold text-base leading-tight">
                {note.title || (
                  <span className="text-muted-foreground italic font-normal">Zonder titel</span>
                )}
              </p>
              {note.content && (
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap leading-relaxed">
                  {note.content}
                </p>
              )}
              <p className="text-xs text-muted-foreground/50 pt-1">{formatDate(note.updated_at)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Mobile: bottom sheet editor ── */}
      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); setConfirmDelete(false); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col [&>button.absolute]:hidden p-0"
          style={{ height: "85svh" }}
        >
          <div className="flex items-center gap-2 px-5 pt-5 pb-3 shrink-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel..."
              className="flex-1 min-w-0 text-base font-semibold bg-transparent focus:outline-none placeholder:text-muted-foreground/40"
            />
            <div className="flex items-center gap-1 shrink-0">
              {activeNote && !confirmDelete && (
                <Button type="button" variant="ghost" size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {confirmDelete && (
                <>
                  <Button type="button" variant="ghost" size="sm" className="rounded-xl text-xs"
                    onClick={() => setConfirmDelete(false)}>Annuleer</Button>
                  <Button type="button" variant="destructive" size="sm" className="rounded-xl text-xs"
                    disabled={deleteNote.isPending}
                    onClick={() => deleteNote.mutate(activeNote!.id)}>
                    {deleteNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verwijder"}
                  </Button>
                </>
              )}
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </div>
          <div className="border-t border-border/40" />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Schrijf hier je notitie..."
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed focus:outline-none px-5 py-4 overflow-y-auto"
          />
          {saveError && (
            <p className="px-5 pb-2 text-xs text-destructive shrink-0">{saveError}</p>
          )}
          <div className="px-5 pt-2 pb-6 shrink-0">
            <Button
              className="w-full rounded-xl"
              disabled={!hasContent || saveNote.isPending}
              onClick={() => saveNote.mutate()}
            >
              {saveNote.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : activeNote ? "Opslaan" : "Toevoegen"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
