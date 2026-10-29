import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ShootingSession } from "@/features/schietsport/domain/model";
import { cardsToCsv, sessionsToCsv } from "@/features/schietsport/backup/csv";
import { createBackup, downloadFile } from "@/features/schietsport/backup/json";
import { useSchietsport } from "@/features/schietsport/hooks/SchietsportProvider";
import {
  useDisciplines,
  useWeapons,
} from "@/features/schietsport/hooks/useSchietsportData";
import { todayYmd } from "@/features/schietsport/lib/format";

// Exporteren van de (gefilterde) schietbeurten als CSV, of een volledige
// JSON-back-up van alles.
export function ExportMenu({
  sessions,
}: {
  sessions: readonly ShootingSession[];
}) {
  const { db } = useSchietsport();
  const weapons = useWeapons({ includeArchived: true }) ?? [];
  const disciplines = useDisciplines({ includeArchived: true }) ?? [];
  const lookups = { weapons, disciplines };
  const stamp = todayYmd();

  const items = [
    {
      icon: FileSpreadsheet,
      label: "Schietbeurten (CSV)",
      detail: `${sessions.length} regels, huidige filters`,
      run: () =>
        downloadFile(
          `schietsport-schietbeurten-${stamp}.csv`,
          sessionsToCsv(sessions, lookups),
          "text/csv;charset=utf-8",
        ),
    },
    {
      icon: FileSpreadsheet,
      label: "Kaarten en schoten (CSV)",
      detail: "Eén regel per kaart",
      run: () =>
        downloadFile(
          `schietsport-kaarten-${stamp}.csv`,
          cardsToCsv(sessions, lookups),
          "text/csv;charset=utf-8",
        ),
    },
    {
      icon: FileJson,
      label: "Volledige back-up (JSON)",
      detail: "Alles, terug te zetten via Instellingen",
      run: async () =>
        downloadFile(
          `schietsport-backup-${stamp}.json`,
          JSON.stringify(await createBackup(db), null, 2),
          "application/json",
        ),
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm hover:bg-white/10"
        >
          <Download className="h-4 w-4" />
          Exporteren
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="schietsport-theme w-72 rounded-2xl border-white/10 p-2"
      >
        {items.map(({ icon: Icon, label, detail, run }) => (
          <button
            key={label}
            type="button"
            onClick={async () => {
              try {
                await run();
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Export mislukt",
                );
              }
            }}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
          >
            <Icon className="mt-0.5 h-4 w-4 text-[var(--ss-copper)]" />
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">
                {detail}
              </span>
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
