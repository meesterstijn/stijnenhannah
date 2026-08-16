import type { ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ChordPickerContent,
  type ChordPickerContentProps,
} from "./ChordPickerContent";

// Desktop: Popover naast/boven het geklikte woord. Mobiel: bottom sheet
// (section 23) — zelfde onderliggende ChordPickerContent, alleen de
// omhullende container verschilt, dus geen tweede implementatie van de
// picker zelf.
export function ChordPicker({
  trigger,
  open,
  onOpenChange,
  ...content
}: ChordPickerContentProps & {
  trigger: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            className="guitar-theme rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            <SheetTitle className="wa-eyebrow mb-1">Akkoord</SheetTitle>
            <ChordPickerContent
              {...content}
              onClose={() => onOpenChange(false)}
            />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="guitar-theme w-72"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ChordPickerContent {...content} onClose={() => onOpenChange(false)} />
      </PopoverContent>
    </Popover>
  );
}
