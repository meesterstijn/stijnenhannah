import { useState } from "react";
import { Sun, Camera, Aperture } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModernPageHeader } from "@/components/modern-page-header";
import { ModernSection, cardSurface } from "@/components/modern-surfaces";

const conditions = [
  { emoji: "☀️", label: "Felle zon", f200: "f/22", f40: "f/45" },
  { emoji: "🌤️", label: "Zonnig", f200: "f/16", f40: "f/32" },
  { emoji: "⛅", label: "Lichte bewolking", f200: "f/11", f40: "f/22" },
  { emoji: "🌥️", label: "Bewolkt", f200: "f/8", f40: "f/16" },
  { emoji: "☁️", label: "Zwaar bewolkt", f200: "f/5.6", f40: "f/11" },
  { emoji: "🌫️", label: "Schaduw", f200: "f/4", f40: "f/8" },
];

export default function Fotografie() {
  const [showCamera, setShowCamera] = useState(false);
  const [shutter, setShutter] = useState<"1/200" | "1/40">("1/200");

  return (
    <div className="space-y-8">
      <ModernPageHeader
        icon={Aperture}
        eyebrow="Onze beelden"
        title="Fotografie"
        description="Tips, regels en inspiratie voor mooie foto's."
      />

      <ModernSection title="Sunny 16 regel">
        <div className={`${cardSurface({ padding: "lg" })} space-y-5`}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sun className="h-5 w-5" strokeWidth={1.6} />
            </div>
            <div>
              <p className="font-serif text-xl font-semibold">Sunny 16 regel</p>
              <p className="text-xs text-muted-foreground">
                Sluitertijd = <strong className="text-foreground">1/ISO</strong>
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Pas alleen de f-stop aan op het weer.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-4 border-t border-border/40">
            {conditions.map((c) => (
              <div
                key={c.label}
                className="flex flex-col items-center text-center gap-1 rounded-xl bg-background/50 py-2.5"
              >
                <span className="text-2xl">{c.emoji}</span>
                <p className="text-[10px] text-muted-foreground leading-tight px-1">
                  {c.label}
                </p>
                <p className="font-serif text-lg font-semibold text-primary">
                  {c.f200}
                </p>
              </div>
            ))}
          </div>
        </div>
      </ModernSection>

      <ModernSection title="Analoge camera">
        <Button
          variant={showCamera ? "default" : "outline"}
          className="rounded-xl gap-2"
          onClick={() => setShowCamera((v) => !v)}
        >
          <Camera className="h-4 w-4" />
          Analoge camera
        </Button>

        {showCamera && (
          <div className={`${cardSurface({ padding: "lg" })} space-y-5`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Camera className="h-5 w-5" strokeWidth={1.6} />
                </div>
                <div>
                  <p className="font-serif text-xl font-semibold">
                    Analoge camera
                  </p>
                  <p className="text-xs text-muted-foreground">ISO 200</p>
                </div>
              </div>
              {/* Sluitertijd toggle */}
              <div className="flex rounded-xl border border-border overflow-hidden text-sm">
                <button
                  onClick={() => setShutter("1/200")}
                  className={`px-4 py-2 transition-colors ${
                    shutter === "1/200"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  1/200s
                </button>
                <button
                  onClick={() => setShutter("1/40")}
                  className={`px-4 py-2 transition-colors border-l border-border ${
                    shutter === "1/40"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  1/40s
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-4 border-t border-border/40">
              {conditions.map((c) => (
                <div
                  key={c.label}
                  className="flex flex-col items-center text-center gap-1 rounded-xl bg-background/50 py-2.5"
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <p className="text-[10px] text-muted-foreground leading-tight px-1">
                    {c.label}
                  </p>
                  <p className="font-serif text-lg font-semibold text-primary">
                    {shutter === "1/200" ? c.f200 : c.f40}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {shutter === "1/40"
                ? "Bij 1/40s laat je ~2⅓ stops meer licht binnen — gebruik een smallere opening."
                : "Standaard Sunny 16 op ISO 200."}
            </p>
          </div>
        )}
      </ModernSection>
    </div>
  );
}
