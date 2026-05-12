import { useEffect, useState } from "react";
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Loader2 } from "lucide-react";

type Weather = {
  temp: number;
  code: number;
  city: string;
  daily: { date: string; max: number; min: number; code: number }[];
};

function iconFor(code: number) {
  if ([0, 1].includes(code)) return Sun;
  if ([2, 3, 45, 48].includes(code)) return Cloud;
  if (code >= 51 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

function descFor(code: number) {
  if (code === 0) return "Helder";
  if ([1, 2].includes(code)) return "Deels bewolkt";
  if (code === 3) return "Bewolkt";
  if ([45, 48].includes(code)) return "Mistig";
  if (code >= 51 && code <= 57) return "Motregen";
  if (code >= 61 && code <= 67) return "Regen";
  if (code >= 71 && code <= 77) return "Sneeuw";
  if (code >= 80 && code <= 82) return "Buien";
  if (code >= 95) return "Onweer";
  return "—";
}

export function WeatherWidget() {
  const [data, setData] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(lat: number, lon: number, city: string) {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`,
        );
        const j = await r.json();
        if (cancelled) return;
        setData({
          temp: Math.round(j.current.temperature_2m),
          code: j.current.weather_code,
          city,
          daily: j.daily.time.slice(1, 4).map((d: string, i: number) => ({
            date: d,
            max: Math.round(j.daily.temperature_2m_max[i + 1]),
            min: Math.round(j.daily.temperature_2m_min[i + 1]),
            code: j.daily.weather_code[i + 1],
          })),
        });
      } catch {
        setError("Weer kon niet geladen worden");
      }
    }

    if (!navigator.geolocation) {
      load(52.37, 4.89, "Amsterdam");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => load(pos.coords.latitude, pos.coords.longitude, "Bij jullie"),
      () => load(52.37, 4.89, "Amsterdam"),
      { timeout: 4000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="text-sm text-muted-foreground">{error}</div>;
  if (!data)
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Weer laden…
      </div>
    );

  const Icon = iconFor(data.code);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-accent/40 to-secondary/60 border border-border/50 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {data.city}
          </p>
          <p className="font-serif text-5xl font-semibold mt-2">{data.temp}°</p>
          <p className="text-sm text-muted-foreground mt-1">{descFor(data.code)}</p>
        </div>
        <Icon className="h-14 w-14 text-primary" strokeWidth={1.5} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 pt-4 border-t border-border/40">
        {data.daily.map((d) => {
          const DI = iconFor(d.code);
          const day = new Date(d.date).toLocaleDateString("nl-NL", { weekday: "short" });
          return (
            <div key={d.date} className="text-center">
              <p className="text-xs text-muted-foreground capitalize">{day}</p>
              <DI className="h-5 w-5 mx-auto my-1 text-primary/80" strokeWidth={1.5} />
              <p className="text-xs">
                <span className="font-medium">{d.max}°</span>{" "}
                <span className="text-muted-foreground">{d.min}°</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
