import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { R6Header } from "@/features/rainbow-six-siege/components/R6Header";
import { R6SessionCard } from "@/features/rainbow-six-siege/components/R6SessionCard";
import { R6NewSessionWizard } from "@/features/rainbow-six-siege/components/R6NewSessionWizard";
import { useActiveR6Session } from "@/features/rainbow-six-siege/hooks/useR6Sessions";
import { useR6History } from "@/features/rainbow-six-siege/hooks/useR6History";

export default function RainbowSixSiegeLan() {
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);
  const { data: activeSession, isLoading: activeLoading } = useActiveR6Session();
  const { data: history = [], isLoading: historyLoading } = useR6History();

  return (
    <div className="space-y-4">
      <R6Header title="LAN-avond" subtitle="Start een nieuwe avond of hervat de actieve LAN" backTo="/rainbow-six-siege" />

      {activeLoading || historyLoading ? (
        <div className="flex justify-center py-16 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {activeSession && (
            <button
              type="button"
              onClick={() => navigate(`/rainbow-six-siege/lan/${activeSession.id}`)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-left transition-colors hover:bg-amber-500/15"
            >
              <div className="flex items-center gap-3">
                <Radio className="h-5 w-5 shrink-0 animate-pulse text-amber-400" />
                <div>
                  <p className="font-serif text-lg font-semibold text-zinc-100">{activeSession.name}</p>
                  <p className="text-sm text-zinc-400">Actieve LAN — klik om te hervatten</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                LIVE
              </span>
            </button>
          )}

          {!activeSession && (
            <Button
              type="button"
              className="w-full bg-amber-500 text-zinc-950 hover:bg-amber-400 sm:w-auto"
              onClick={() => setWizardOpen(true)}
            >
              <Plus className="h-4 w-4" /> Nieuwe LAN starten
            </Button>
          )}

          <div className="space-y-3">
            <p className="font-serif text-lg font-semibold text-zinc-100">Historie</p>
            {history.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
                <p className="text-sm text-zinc-400">Nog geen afgeronde LAN-avonden.</p>
                {!activeSession && (
                  <Button
                    type="button"
                    className="mt-4 bg-amber-500 text-zinc-950 hover:bg-amber-400"
                    onClick={() => setWizardOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> Nieuwe LAN starten
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((summary) => (
                  <R6SessionCard key={summary.session.id} summary={summary} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <R6NewSessionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={(sessionId) => navigate(`/rainbow-six-siege/lan/${sessionId}`)}
      />
    </div>
  );
}
