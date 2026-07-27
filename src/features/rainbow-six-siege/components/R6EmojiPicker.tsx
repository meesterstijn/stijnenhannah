import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { R6_ICON_EMOJI_OPTIONS } from "@/features/rainbow-six-siege/lib/emojiOptions";

// Klikbare emoji-kiezer i.p.v. een tekstveld — niet elk toetsenbord
// (vooral desktop/tablet zonder ingebouwde emoji-invoer) laat een emoji
// zomaar typen, dus kiezen uit een vaste lijst moet altijd werken.
export function R6EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-12 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-lg text-zinc-100 hover:bg-zinc-800"
          aria-label="Icoon kiezen"
        >
          {value || "🙂"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="r6-theme w-72 border-zinc-700 bg-zinc-900 p-2 text-zinc-100">
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          className="mb-2 w-full rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          Geen icoon
        </button>
        <div className="grid grid-cols-8 gap-1">
          {R6_ICON_EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-zinc-800 ${
                emoji === value ? "bg-amber-500/20 ring-1 ring-amber-500" : ""
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
