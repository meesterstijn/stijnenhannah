// QR-label identifiers en deeplink-encodering.
//
// De code zelf is bewust een ondoorzichtige, willekeurige token — géén
// plantnaam/soort-ID/volgnummer, en niet oplopend (crypto.randomUUID() is
// een cryptografisch willekeurige v4 UUID, geen sequentie). De QR-afbeelding
// codeert een volledige deeplink-URL (huidige origin + hash-route +
// ?qr=<code>) i.p.v. de kale code, zodat een gewone telefooncamera de app
// ook rechtstreeks kan openen (zie handling van de qr-queryparam op
// /tuinieren in Tuinieren.tsx). De QR-code is een identificatiemiddel, geen
// authenticatiemiddel: het openen van de deeplink vereist nog altijd de
// bestaande login/RLS — er staat geen gevoelige data in de token of de URL.
export function generateQrLabelCode(): string {
  return crypto.randomUUID();
}

/** Volledige deeplink die in de QR-afbeelding wordt gecodeerd. */
export function buildQrLabelDeepLink(code: string): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return `${base}#/tuinieren?qr=${encodeURIComponent(code)}`;
}

/**
 * Haalt de opaque code uit gescande QR-tekst. Ondersteunt zowel de
 * deeplink-vorm (?qr=<code> ergens in de URL) als een kale code (voor QR-
 * afbeeldingen die ooit zonder deeplink zijn gegenereerd, of gescand met een
 * decoder die alleen platte tekst teruggeeft). Geeft null terug als er geen
 * bruikbare code uit te halen valt.
 */
export function parseQrScanText(rawText: string): string | null {
  const text = rawText.trim();
  if (!text) return null;

  try {
    // Werkt zowel voor "https://host/#/tuinieren?qr=xyz" (querystring zit
    // dan ná de hash, dus in de URL-parser als search van het hash-fragment)
    // als voor een kale "?qr=xyz".
    const hashIndex = text.indexOf("#");
    const queryPart = hashIndex >= 0 ? text.slice(hashIndex + 1) : text;
    const qIndex = queryPart.indexOf("?");
    if (qIndex >= 0) {
      const params = new URLSearchParams(queryPart.slice(qIndex + 1));
      const code = params.get("qr");
      if (code) return code;
    }
  } catch {
    // Geen geldige URL-structuur — val terug op de kale tekst hieronder.
  }

  return text;
}
