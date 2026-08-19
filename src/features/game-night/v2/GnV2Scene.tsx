import type { ReactNode } from "react";
import { Club, Diamond, Heart, Spade } from "lucide-react";

// Gedeelde scene-chrome voor de hele V2-fullscreen-app (V2.5-lobby +
// V2.6-Game Select): dezelfde achtergrond/korrel/suit-watermerk overal, zo
// blijft de wisseling tussen schermen één samenhangende wereld i.p.v. een
// nieuwe achtergrond per stap. Eerst alleen in GameNightV2Lobby.tsx gebruikt
// — nu een eigen component omdat Game Select 'm ook nodig heeft (sectie 4
// V2.6: "blijf in dezelfde wereld als V2.5").
export function GnV2Scene({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`gnv2-scene ${className ?? ""}`}>
      <div className="gnv2-suits" aria-hidden="true">
        <Spade className="gnv2-suit gnv2-suit-1" />
        <Heart className="gnv2-suit gnv2-suit-2" />
        <Diamond className="gnv2-suit gnv2-suit-3" />
        <Club className="gnv2-suit gnv2-suit-4" />
      </div>
      {children}
    </div>
  );
}
