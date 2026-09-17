export const GUEST_FACES = {
  smile: { emoji: "😊", label: "Vrolijk" },
  cool: { emoji: "😎", label: "Zonnebril" },
  robot: { emoji: "🤖", label: "Robot" },
  fox: { emoji: "🦊", label: "Vos" },
  cat: { emoji: "🐱", label: "Kat" },
  alien: { emoji: "👽", label: "Alien" },
  bear: { emoji: "🐻", label: "Beer" },
  panda: { emoji: "🐼", label: "Panda" },
} as const;

export type GuestFace = keyof typeof GUEST_FACES;

export function guestFaceEmoji(face: string | null | undefined) {
  return face && Object.hasOwn(GUEST_FACES, face)
    ? GUEST_FACES[face as GuestFace].emoji
    : null;
}

const STORAGE_KEY = "game-night-guest-v1";

export function readGuestToken(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && /^[0-9a-f]{64}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

// Persist BEFORE joining: retrying a lost response then uses the same
// credential and cannot create a second player. Never put it in a URL.
export function ensureGuestToken(): string {
  const existing = readGuestToken();
  if (existing) return existing;
  return createGuestToken();
}

// An explicit player change gets a fresh credential. Never rebind a token
// that another tab/phone may still be using to a different player.
export function createGuestToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  try {
    localStorage.setItem(STORAGE_KEY, token);
    if (localStorage.getItem(STORAGE_KEY) !== token) throw new Error();
  } catch {
    throw new Error(
      "Je browser kan je speler niet bewaren. Sta websiteopslag toe en probeer opnieuw.",
    );
  }
  return token;
}

export function guestErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "PGRST202"
  ) {
    return "Gasttoegang is nog niet ingesteld. Vraag de host om de Game Night-update te installeren.";
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    if (/fetch|network|Load failed/i.test(error.message)) {
      return "Geen verbinding. Controleer je internet en probeer opnieuw; je speler blijft bewaard.";
    }
    return error.message;
  }
  return "Dat lukte niet. Probeer het opnieuw.";
}
