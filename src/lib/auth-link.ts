// Maillinks van Supabase (uitnodiging, wachtwoord vergeten) komen terug op de
// site met de tokens of een foutmelding in de hash, bv.
//   #access_token=…&type=invite
//   #error=access_denied&error_code=otp_expired&error_description=…
// supabase-js leest die hash bij het aanmaken van de client en wist 'm dan.
// lib/supabase.ts roept captureAuthLink() aan vlak vóór createClient en legt
// zo het type en een eventuele fout vast, zodat de app daarna weet dat de
// gebruiker nog een wachtwoord moet kiezen (een uitgenodigd account heeft er
// nog geen) of dat de link verlopen was.

export type AuthLinkInfo = {
  type: string | null;
  error: string | null;
};

function parseAuthLink(): AuthLinkInfo {
  const empty = { type: null, error: null };
  try {
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (!/(^|&)(access_token|error)=/.test(hash)) return empty;
    const params = new URLSearchParams(hash);
    return {
      type: params.get("type"),
      error: params.get("error_code") ?? params.get("error"),
    };
  } catch {
    return empty;
  }
}

let captured: AuthLinkInfo | null = null;

export function captureAuthLink(): AuthLinkInfo {
  if (!captured) captured = parseAuthLink();
  return captured;
}

/** Wat de maillink was waarmee deze pagina geopend werd (of niets). */
export function getInitialAuthLink(): AuthLinkInfo {
  return captured ?? { type: null, error: null };
}

/** Uitnodigings- en herstellinks loggen in zonder (bekend) wachtwoord. */
export const PASSWORD_LINK_TYPES = new Set(["invite", "recovery"]);

// Zodat herladen vóór het opslaan van het wachtwoord het formulier niet
// overslaat. sessionStorage: verdwijnt met het tabblad.
const NEEDS_PASSWORD_KEY = "auth:needs-password";

export function readNeedsPassword(): boolean {
  try {
    return sessionStorage.getItem(NEEDS_PASSWORD_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeNeedsPassword(value: boolean) {
  try {
    if (value) sessionStorage.setItem(NEEDS_PASSWORD_KEY, "1");
    else sessionStorage.removeItem(NEEDS_PASSWORD_KEY);
  } catch {
    // Geblokkeerde storage: alleen de herlaad-situatie werkt dan niet.
  }
}

/** Haalt een achtergebleven foutmelding uit de adresbalk. */
export function clearAuthLinkHash() {
  try {
    if (/(^|[#&/])error=/.test(window.location.hash)) {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  } catch {
    // Niet erg: de hash blijft dan gewoon staan.
  }
}
