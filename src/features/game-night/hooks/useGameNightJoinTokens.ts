import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type GameNightJoinToken } from "@/lib/supabase";

// Game Night V2.4 — owner-kant van QR-join: token opzoeken/genereren/
// intrekken. Alleen owner heeft ooit SELECT-toegang tot
// game_night_join_tokens (RLS) — deze hooks zijn dus uitsluitend zinvol
// vanuit owner-only UI (het tablet-QR-paneel).

const ACTIVE_TOKEN_KEY = (sessionId: string | undefined) =>
  ["game-night", "active-join-token", sessionId] as const;

// Het huidige geldige token voor deze avond, als dat bestaat — zodat het
// QR-paneel een al-gegenereerd token hergebruikt i.p.v. bij elke keer
// openen meteen te regenereren (dat zou een QR die een vriend net aan het
// scannen is onnodig laten verlopen).
export function useActiveJoinToken(sessionId: string | undefined) {
  return useQuery({
    queryKey: ACTIVE_TOKEN_KEY(sessionId),
    queryFn: async (): Promise<GameNightJoinToken | null> => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from("game_night_join_tokens")
        .select("*")
        .eq("game_night_session_id", sessionId)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });
}

export function useGenerateJoinToken(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<GameNightJoinToken> => {
      if (!sessionId) throw new Error("Geen actieve Game Night");
      const { data, error } = await supabase.rpc(
        "game_night_generate_join_token",
        { p_game_night_session_id: sessionId },
      );
      if (error) throw error;
      return data as GameNightJoinToken;
    },
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({
          queryKey: ACTIVE_TOKEN_KEY(sessionId),
        });
      }
    },
  });
}

export function useRevokeJoinToken(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tokenId: string): Promise<void> => {
      const { error } = await supabase.rpc("game_night_revoke_join_token", {
        p_token_id: tokenId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({
          queryKey: ACTIVE_TOKEN_KEY(sessionId),
        });
      }
    },
  });
}
