// Losse fysieke tafelobjecten rond de compositie — echte, uit de
// aangeleverde asset-sheet uitgesneden fotoassets, gegroepeerd in een paar
// natuurlijke hoekclusters i.p.v. gelijkmatig verspreide losse eilandjes.
// Bewust NIET de volledige "pionnenrij"/"meeples-rij" gebruikt: die oogde
// als een rechtstreekse asset-sheet-demonstratie (geel-rood-blauw-groen
// netjes op een rij) — in plaats daarvan losse individuele stukken
// (pawn-*.webp, chip-*.webp, die-single.webp; zie ook GameNightHome.tsx
// voor de stukken die letterlijk op het bord liggen). meeple-yellow.webp
// en de overige pawn-kleuren staan als losse assets klaar voor later maar
// worden hier niet allemaal tegelijk ingezet ("niet te veel"). Zie het
// opleverrapport voor welke meeple-crops niet schoon genoeg werden en
// daarom niet gebruikt zijn. Lege tafelruimte (bv. linksonder, bij de
// kampioenskaart) is bewust leeg gelaten.
type Obj = {
  src: string;
  alt: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  width: string;
  rotate: number;
  shadow: "card" | "dice" | "pawn" | "bowl";
};

const OBJECTS: Obj[] = [
  // linksboven cluster: kaartenstapel + onderzetter + dobbelsteen
  {
    src: "/game-night/assets/cards-stack-red.webp",
    alt: "",
    top: "3%",
    left: "-2%",
    width: "6.5rem",
    rotate: -11,
    shadow: "card",
  },
  {
    src: "/game-night/assets/coaster.webp",
    alt: "",
    top: "0%",
    left: "21%",
    width: "3.6rem",
    rotate: -5,
    shadow: "pawn",
  },
  {
    src: "/game-night/assets/die-single.webp",
    alt: "",
    top: "19%",
    left: "10%",
    width: "2.6rem",
    rotate: 18,
    shadow: "dice",
  },

  // rechtsboven cluster: fichenkom (hoog) en kaartenwaaier + pion (lager,
  // met duidelijke verticale afstand zodat het geen opeenhoping wordt).
  // Iets kleiner (~18%) en verder van de kaars vandaan (was right:-3%) dan
  // voorheen — de kaars ernaast overlapte zichtbaar met de rand van de kom.
  // De asset zelf (chip-bowl.webp) is gecontroleerd en is een volledige,
  // schone crop; dit was uitsluitend een positioneringsprobleem.
  {
    src: "/game-night/assets/chip-bowl.webp",
    alt: "",
    top: "4%",
    right: "-1%",
    width: "5.6rem",
    rotate: 3,
    shadow: "bowl",
  },
  {
    src: "/game-night/assets/cards-fan.webp",
    alt: "",
    top: "36%",
    right: "11%",
    width: "5.25rem",
    rotate: 12,
    shadow: "card",
  },
  {
    src: "/game-night/assets/pawn-green.webp",
    alt: "",
    top: "33%",
    right: "27%",
    width: "2.4rem",
    rotate: -9,
    shadow: "pawn",
  },

  // onderhoek: één gedeeltelijk afgesneden kaartenstapel, verder blijft de
  // tafel hier bewust leeg
  {
    src: "/game-night/assets/cards-stack-blue.webp",
    alt: "",
    bottom: "-4%",
    right: "19%",
    width: "5rem",
    rotate: 9,
    shadow: "card",
  },
];

export function ScatteredTableObjects() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 hidden lg:block"
      aria-hidden
    >
      {OBJECTS.map((obj, i) => (
        <img
          key={i}
          src={obj.src}
          alt={obj.alt}
          className={`gn-tableobj gn-tableobj-${obj.shadow}`}
          style={{
            top: obj.top,
            bottom: obj.bottom,
            left: obj.left,
            right: obj.right,
            width: obj.width,
            transform: `rotate(${obj.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
