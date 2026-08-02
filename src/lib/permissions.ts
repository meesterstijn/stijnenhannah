import { useAuth } from "@/contexts/AuthContext";

// Eén centrale plek voor "mag deze gebruiker actie X uitvoeren" — gebruikt
// door de UI om owner-only knoppen/acties te verbergen (nooit als enige
// bescherming: de database-RLS uit de rollenmigraties dwingt exact dezelfde
// grenzen ook af, dus zelfs een rechtstreekse API-aanroep die deze laag
// omzeilt wordt alsnog geweigerd). Elke flag is hier vandaag gelijk aan
// `isOwner` — dat is de uitkomst van de gekozen rechtenmatrix, niet een
// toevallige samenvatting; losse, benoemde flags houden de aanroepplekken
// leesbaar en maken een toekomstige verfijning (bv. een derde rol) een
// lokale wijziging i.p.v. een zoek-en-vervang van `appRole === "owner"`
// door de hele codebase.
export function useR6Permissions() {
  const { isOwner } = useAuth();
  return {
    /** Beide rollen mogen de R6-module gebruiken — toegang zelf wordt al op
     * routeniveau afgedwongen (RequireAppAccess), dit is puur voor UI-plekken
     * die expliciet willen tonen "dit mag altijd". */
    canAccessR6: true,
    canManageR6Rules: isOwner,
    canDeleteR6Session: isOwner,
    canReopenR6Session: isOwner,
    canDeleteR6Match: isOwner,
    canRemoveR6SessionPlayer: isOwner,
    canManageUsers: isOwner,
    canAccessPrivateModules: isOwner,
  };
}
