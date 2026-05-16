import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Plus, Trash2, Loader2, X } from "lucide-react";

type QuickLink = {
  id: string;
  label: string;
  url: string;
  emoji: string;
  position: number;
};

async function fetchLinks(): Promise<QuickLink[]> {
  const { data, error } = await supabase
    .from("quick_links")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

function ensureHttps(url: string) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return "https://" + url;
}

export function SnelleLinksWidget() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [manageOpen, setManageOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newEmoji, setNewEmoji] = useState("");

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["quick_links"],
    queryFn: fetchLinks,
  });

  const addLink = useMutation({
    mutationFn: async () => {
      const position = links.length;
      const { error } = await supabase.from("quick_links").insert({
        label: newLabel.trim(),
        url: ensureHttps(newUrl.trim()),
        emoji: newEmoji.trim() || "🔗",
        position,
        created_by: session?.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick_links"] });
      setNewLabel("");
      setNewUrl("");
      setNewEmoji("");
    },
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quick_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quick_links"] }),
  });

  const canAdd = newLabel.trim() && newUrl.trim();
  const displayed = links.slice(0, 6);
  const empty = Array.from({ length: Math.max(0, 6 - displayed.length) });

  return (
    <>
      <div className="rounded-2xl bg-card border border-border/60 p-5 shadow-sm flex flex-col gap-3 sm:min-h-[200px]">
        <div className="flex items-center justify-between">
          <p className="font-serif text-xl font-semibold">Snelle links</p>
          <button
            onClick={() => setManageOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Beheer links"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 flex-1">
            {displayed.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-muted/40 hover:bg-accent transition-colors p-2 flex items-center justify-center text-center min-h-[56px]"
              >
                <span className="text-xs font-medium leading-tight line-clamp-2 w-full text-center">
                  {link.label}
                </span>
              </a>
            ))}
            {empty.map((_, i) => (
              <button
                key={`empty-${i}`}
                onClick={() => setManageOpen(true)}
                className="rounded-xl border border-dashed border-border/50 hover:border-border hover:bg-accent/30 transition-colors p-2 flex items-center justify-center min-h-[56px] text-muted-foreground/40 hover:text-muted-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Beheer sheet */}
      <Sheet open={manageOpen} onOpenChange={setManageOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col [&>button.absolute]:hidden p-0"
          style={{ height: "85svh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
            <p className="font-semibold text-base">Snelle links beheren</p>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Bestaande links */}
            <div className="space-y-2">
              {links.map((link) => (
                <div key={link.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                  <span className="text-xl w-8 text-center">{link.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{link.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                  </div>
                  <button
                    onClick={() => deleteLink.mutate(link.id)}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {links.length === 0 && (
                <p className="text-sm text-muted-foreground">Nog geen links — voeg er een toe.</p>
              )}
            </div>

            {/* Nieuwe link */}
            {links.length < 6 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nieuwe link</p>
                <div className="flex gap-2">
                  <Input
                    value={newEmoji}
                    onChange={(e) => setNewEmoji(e.target.value)}
                    placeholder="🔗"
                    className="w-16 text-center bg-card"
                  />
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Naam"
                    className="flex-1 bg-card"
                  />
                </div>
                <Input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="www.example.com"
                  className="bg-card"
                  inputMode="url"
                />
                <Button
                  className="w-full rounded-xl"
                  disabled={!canAdd || addLink.isPending}
                  onClick={() => addLink.mutate()}
                >
                  {addLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Toevoegen"}
                </Button>
              </div>
            )}
            {links.length >= 6 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Maximum van 6 links bereikt. Verwijder er een om een nieuwe toe te voegen.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
