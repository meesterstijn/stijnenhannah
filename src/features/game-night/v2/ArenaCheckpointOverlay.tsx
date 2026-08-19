import { useState } from "react";
import type {
  GameNightCheckpoint,
  GameNightCheckpointPhotoType,
  GameNightPlayer,
} from "@/lib/supabase";
import { useCheckpointsForSession } from "@/features/game-night/hooks/useCheckpoints";
import { CheckpointSavePanel } from "@/features/game-night/components/CheckpointSavePanel";
import { CheckpointHistoryPanel } from "@/features/game-night/components/CheckpointHistoryPanel";
import { CheckpointViewer } from "@/features/game-night/components/CheckpointViewer";

type CheckpointView = "save" | "history" | "view";

// Game Night V2.7B (sectie 26) — hergebruikt de bestaande checkpoint-
// architectuur VOLLEDIG ongewijzigd (CheckpointSavePanel/-HistoryPanel/
// -Viewer, met hun eigen bestaande camera-/upload-/foto-logica) — alleen de
// OMLIJSTING is nieuw: een .gnv2-* sheet i.p.v. het oude .gn-board, zodat
// "FOTO" tijdens Live Play nooit meer terugvalt op de houten weergave. De
// checkpoint-content zelf blijft bewust in haar bestaande stijl (sectie 26:
// "NIET herschrijven") — dat is functioneel/beheerste tooling, geen
// onderdeel van de nieuwe Arena-sfeer.
export function ArenaCheckpointOverlay({
  gameSessionId,
  attendees,
  initialView = "save",
  initialCategory = null,
  initialCaptureMode,
  onClose,
  onSaved,
}: {
  gameSessionId: string;
  attendees: GameNightPlayer[];
  initialView?: CheckpointView;
  // Sectie 3 (V2.7D): "Foto maken"/"Uit galerij kiezen" in het nieuwe
  // ···-menu springen direct naar de SPEELBORD-categorie i.p.v. eerst het
  // 6-categorieën-grid te tonen — alleen relevant zolang `initialView`
  // "save" is.
  initialCategory?: GameNightCheckpointPhotoType | null;
  initialCaptureMode?: "camera" | "gallery";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [view, setView] = useState<CheckpointView>(initialView);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const { data: checkpoints = [] } = useCheckpointsForSession(gameSessionId);

  function openViewer(checkpointId: string) {
    setViewingId(checkpointId);
    setView("view");
  }

  const viewingCheckpoint: GameNightCheckpoint | undefined =
    checkpoints.find((c) => c.id === viewingId) ??
    (viewingId
      ? {
          id: viewingId,
          game_session_id: gameSessionId,
          title: "",
          notes: null,
          created_at: new Date().toISOString(),
          created_by: null,
          round_id: null,
        }
      : undefined);

  return (
    <div className="gnv2-checkpoint-overlay">
      <div className="gnv2-checkpoint-card">
        {view === "save" && (
          <CheckpointSavePanel
            gameSessionId={gameSessionId}
            roundId={null}
            attendees={attendees}
            initialCategory={initialCategory}
            initialCaptureMode={initialCaptureMode}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
        {view === "history" && (
          <CheckpointHistoryPanel
            checkpoints={checkpoints}
            onSelect={openViewer}
            onClose={onClose}
          />
        )}
        {view === "view" && viewingCheckpoint && (
          <CheckpointViewer
            checkpoint={viewingCheckpoint}
            checkpoints={checkpoints}
            attendees={attendees}
            onNavigateCheckpoint={setViewingId}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
