import { useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useR6SessionMedia } from "@/features/rainbow-six-siege/hooks/useR6SessionMedia";
import { getR6MediaPublicUrl } from "@/features/rainbow-six-siege/lib/media";
import type { R6Match } from "@/features/rainbow-six-siege/types";

const NONE = "none";

export function R6SessionMediaGallery({
  sessionId,
  matches,
  editable,
}: {
  sessionId: string;
  matches: R6Match[];
  editable: boolean;
}) {
  const { media, isLoading, uploadMedia, isUploading, uploadError, deleteMedia, isDeleting } = useR6SessionMedia(sessionId);
  const [caption, setCaption] = useState("");
  const [matchId, setMatchId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(file: File | undefined) {
    if (!file) return;
    await uploadMedia({ file, caption: caption.trim() || null, matchId: matchId || null });
    setCaption("");
    setMatchId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-6 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {editable && (
        <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Onderschrift (optioneel)"
              className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
            />
            <Select value={matchId || NONE} onValueChange={(v) => setMatchId(v === NONE ? "" : v)}>
              <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectValue placeholder="Koppel aan hele LAN" />
              </SelectTrigger>
              <SelectContent className="r6-theme border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectItem value={NONE} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                  Koppel aan hele LAN
                </SelectItem>
                {matches.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                    Gimma {m.match_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFileSelected(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Foto uploaden
          </Button>
          {uploadError && <p className="text-sm text-rose-400">{uploadError.message}</p>}
        </div>
      )}

      {media.length === 0 ? (
        <p className="text-sm text-zinc-400">Nog geen foto's toegevoegd.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((item) => (
            <div key={item.id} className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50">
              <img src={getR6MediaPublicUrl(item.storage_path)} alt={item.caption ?? ""} className="aspect-square w-full object-cover" />
              {item.caption && (
                <p className="truncate bg-zinc-950/80 px-2 py-1 text-xs text-zinc-300">{item.caption}</p>
              )}
              {editable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7 bg-zinc-950/70 text-zinc-300 opacity-0 transition-opacity hover:bg-rose-500/80 hover:text-zinc-950 group-hover:opacity-100"
                  onClick={() => deleteMedia(item)}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
