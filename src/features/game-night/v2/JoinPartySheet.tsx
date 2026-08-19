import { useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import type { GameNightSession } from "@/lib/supabase";
import { QrCodeDisplay } from "@/components/qr-code-display";
import {
  useActiveJoinToken,
  useGenerateJoinToken,
} from "@/features/game-night/hooks/useGameNightJoinTokens";

// Game Night V2.5 (sectie 12/13) — hergebruikt de bestaande V2.4 token-RPC's
// ongewijzigd; alleen het uiterlijk is nieuw: royale QR, weinig tekst, veel
// witruimte, token-expiry bewust niet prominent. Portrait-tablet-vriendelijk
// (sectie 30): de sheet is een gecentreerde kaart, geen vaste breedte die op
// smallere/hogere viewports zou afsnijden.
export function JoinPartySheet({
  session,
  onClose,
}: {
  session: GameNightSession;
  onClose: () => void;
}) {
  const { data: activeToken, isLoading } = useActiveJoinToken(session.id);
  const generate = useGenerateJoinToken(session.id);

  const token = activeToken?.token;

  useEffect(() => {
    if (!isLoading && !token && !generate.isPending) {
      generate.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, token, generate.isPending]);

  const joinUrl = token
    ? `${window.location.origin}/#/game-night/join/${token}`
    : null;

  return (
    <div
      className="gnv2-sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Join met telefoon"
    >
      <div className="gnv2-sheet-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="gnv2-sheet-close"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        <p className="gnv2-sheet-eyebrow">{session.name}</p>
        <p className="gnv2-sheet-title">Scan om aan te schuiven</p>

        <div className="gnv2-sheet-qr">
          <QrCodeDisplay data={joinUrl} size={280} />
        </div>

        <button
          type="button"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="gnv2-btn gnv2-btn-ghost"
        >
          <RefreshCw
            className={`h-4 w-4 ${generate.isPending ? "animate-spin" : ""}`}
          />
          QR vernieuwen
        </button>
      </div>
    </div>
  );
}
