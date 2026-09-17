import { useEffect, useRef, useState } from "react";
import { Copy, Loader2, RefreshCw, X } from "lucide-react";
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
//
// Bugfix (join-QR bleef leeg): het automatisch genereren van een token kon
// eerder onopgemerkt mislukken (zie de nieuwe migratie
// 20260919000000_game_night_join_token_rpc_security_definer_fix.sql — de
// daadwerkelijke oorzaak zat in de database-RPC, niet hier) zonder dat deze
// sheet dat ooit liet zien: `joinUrl` bleef simpelweg `null` en
// QrCodeDisplay deed dan letterlijk niets. Dit bestand toont nu expliciet
// een foutstatus + retry i.p.v. voor altijd stil een leeg wit vlak, en
// retryt niet meer automatisch in een lus bij een mislukte poging.
export function JoinPartySheet({
  session,
  onClose,
}: {
  session: GameNightSession;
  onClose: () => void;
}) {
  const {
    data: activeToken,
    isLoading,
    error: tokenError,
  } = useActiveJoinToken(session.id);
  const generate = useGenerateJoinToken(session.id);
  const [copyMessage, setCopyMessage] = useState("");

  const token = activeToken?.token;

  // Precies ÉÉN automatische poging per keer dat de sheet opent — niet
  // opnieuw proberen bij elke render zolang `token` leeg blijft (dat zou bij
  // een echte, aanhoudende fout een oneindige retry-lus geven, telkens
  // opnieuw dezelfde RPC-aanroep). Een mislukte poging toont hieronder een
  // duidelijke foutstatus; de speler/host moet dan bewust op "Opnieuw
  // proberen" tikken.
  const hasAutoAttemptedRef = useRef(false);
  useEffect(() => {
    if (
      !isLoading &&
      !token &&
      !generate.isPending &&
      !hasAutoAttemptedRef.current
    ) {
      hasAutoAttemptedRef.current = true;
      generate.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, token, generate.isPending]);

  function handleRetry() {
    hasAutoAttemptedRef.current = true;
    generate.mutate();
  }

  const joinUrl = token
    ? `${window.location.origin}${window.location.pathname}#/game-night/join/${token}`
    : null;

  // Alleen een echte, permanente fout tonen als er ook geen (nog geldig)
  // token is om op terug te vallen — een mislukte "QR vernieuwen"-poging
  // terwijl de oude QR nog geldig is, mag die oude QR niet vervangen door
  // een foutmelding.
  const showError = (generate.isError || !!tokenError) && !token && !isLoading;

  return (
    <div
      className="gnv2-sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Join met telefoon"
    >
      <div
        className="gnv2-sheet-card gnv2-guest-qr-sheet"
        onClick={(e) => e.stopPropagation()}
      >
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
        <p className="gnv2-dialog-muted text-sm">
          Kies je naam en avatar. Je hebt geen account nodig.
        </p>

        {showError ? (
          <div className="gnv2-sheet-qr flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-semibold text-red-400">
              QR kon niet worden geladen
            </p>
            <p className="gnv2-dialog-faint max-w-[16rem] text-xs">
              {(generate.error ?? tokenError) instanceof Error
                ? (generate.error ?? tokenError)?.message
                : "Onbekende fout bij het aanmaken van de join-link."}
            </p>
          </div>
        ) : !joinUrl ? (
          <div
            className="gnv2-sheet-qr flex items-center justify-center"
            role="status"
            aria-label="QR-code laden"
          >
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          </div>
        ) : (
          <div className="gnv2-sheet-qr">
            <QrCodeDisplay data={joinUrl} size={280} />
          </div>
        )}

        {joinUrl && (
          <>
            <button
              type="button"
              className="gnv2-btn gnv2-btn-ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(joinUrl);
                  setCopyMessage("Link gekopieerd");
                } catch {
                  setCopyMessage(
                    "Kopiëren lukt niet. Houd de link hieronder ingedrukt om hem te delen.",
                  );
                }
              }}
            >
              <Copy className="h-4 w-4" />
              Uitnodiging kopiëren
            </button>
            <p role="status" className="gnv2-dialog-muted text-xs">
              {copyMessage}
            </p>
            <a href={joinUrl} className="gnv2-dialog-faint text-xs underline">
              Uitnodiging openen
            </a>
          </>
        )}

        <button
          type="button"
          onClick={handleRetry}
          disabled={generate.isPending}
          className="gnv2-btn gnv2-btn-ghost"
        >
          <RefreshCw
            className={`h-4 w-4 ${generate.isPending ? "animate-spin" : ""}`}
          />
          {showError ? "Opnieuw proberen" : "QR vernieuwen"}
        </button>
      </div>
    </div>
  );
}
