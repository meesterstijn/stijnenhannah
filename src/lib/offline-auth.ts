import type { Session } from "@supabase/supabase-js";
import { SUPABASE_AUTH_STORAGE_KEY } from "@/lib/supabase-config";

// Offline-ondersteuning voor AuthContext. Puur client-side UI-gating: alle
// data blijft op databaseniveau door RLS beschermd, een gecachete rol geeft
// dus nooit toegang tot iets wat de server zelf niet toestaat.

// supabase-js geeft bij een verlopen access token zonder netwerk `session:
// null` terug, maar laat de opgeslagen sessie bewust staan (alleen een
// niet-retrybare refreshfout, bv. een ingetrokken refresh token, verwijdert
// 'm — zie GoTrueClient._callRefreshToken / _recoverAndRefresh). Staat er
// dus nog een sessie in storage terwijl de client `null` meldt, dan is dat
// precies de offline-situatie. Zodra er weer netwerk is ververst de
// auto-refresh-ticker het token en volgt een gewone TOKEN_REFRESHED.
export function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    if (parsed?.user?.id && parsed.refresh_token) return parsed as Session;
  } catch {
    // Geblokkeerde/kapotte storage: gedraag je alsof er niets opgeslagen is.
  }
  return null;
}

const PROFILE_CACHE_PREFIX = "auth:last-profile:";

export function readCachedProfile<T>(userId: string): T | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_PREFIX + userId);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCachedProfile(userId: string, profile: unknown) {
  try {
    localStorage.setItem(
      PROFILE_CACHE_PREFIX + userId,
      JSON.stringify(profile),
    );
  } catch {
    // Niet kunnen cachen is geen fout; online werkt alles gewoon.
  }
}

export function clearCachedProfiles() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PROFILE_CACHE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // idem
  }
}
