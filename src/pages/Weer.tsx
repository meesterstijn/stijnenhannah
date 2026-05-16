import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind, Droplets, Thermometer, LocateFixed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT = { lat: 51.7722, lon: 4.6156, city: "'s-Gravendeel" };

type WeatherDetail = {
  city: string;
  current: {
    temp: number;
    feels_like: number;
    humidity: number;
    wind_speed: number;
    code: number;
  };
  hourly: { time: string; temp: number; code: number; precip_prob: number }[];
  daily: { date: string; max: number; min: number; code: number; precip_prob: number; wind_max: number }[];
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

function formatHour(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(dateStr: string, i: number) {
  if (i === 0) return "Vandaag";
  if (i === 1) return "Morgen";
  return new Date(dateStr).toLocaleDateString("nl-NL", { weekday: "long" });
}

async function loadWeather(lat: number, lon: number, city: string): Promise<WeatherDetail> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=auto&forecast_days=7`
  );
  const j = await res.json();

  const nowHour = new Date().toISOString().slice(0, 13);
  const start = Math.max(0, j.hourly.time.findIndex((t: string) => t.startsWith(nowHour)));

  return {
    city,
    current: {
      temp: Math.round(j.current.temperature_2m),
      feels_like: Math.round(j.current.apparent_temperature),
      humidity: j.current.relative_humidity_2m,
      wind_speed: Math.round(j.current.wind_speed_10m),
      code: j.current.weather_code,
    },
    hourly: j.hourly.time.slice(start, start + 24).map((t: string, i: number) => ({
      time: t,
      temp: Math.round(j.hourly.temperature_2m[start + i]),
      code: j.hourly.weather_code[start + i],
      precip_prob: j.hourly.precipitation_probability[start + i],
    })),
    daily: j.daily.time.map((d: string, i: number) => ({
      date: d,
      max: Math.round(j.daily.temperature_2m_max[i]),
      min: Math.round(j.daily.temperature_2m_min[i]),
      code: j.daily.weather_code[i],
      precip_prob: j.daily.precipitation_probability_max[i],
      wind_max: Math.round(j.daily.wind_speed_10m_max[i]),
    })),
  };
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: { "Accept-Language": "nl" } }
  );
  const j = await res.json();
  return j.address?.city ?? j.address?.town ?? j.address?.village ?? j.address?.county ?? "Jouw locatie";
}

export default function Weer() {
  const [data, setData] = useState<WeatherDetail | null>(null);
  const [error, setError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [usingCustom, setUsingCustom] = useState(false);

  useEffect(() => {
    loadWeather(DEFAULT.lat, DEFAULT.lon, DEFAULT.city)
      .then(setData)
      .catch(() => setError(true));
  }, []);

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setLocError("Locatie wordt niet ondersteund door jouw browser.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const city = await reverseGeocode(latitude, longitude);
          const weather = await loadWeather(latitude, longitude, city);
          setData(weather);
          setUsingCustom(true);
        } catch {
          setLocError("Kon weerdata voor jouw locatie niet laden.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocError("Locatietoegang geweigerd of niet beschikbaar.");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }

  const CurrentIcon = data ? iconFor(data.current.code) : Cloud;

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-serif text-3xl font-semibold">Weer</h1>
        </div>
        <div className="flex items-center gap-2">
          {usingCustom && (
            <span className="text-xs text-muted-foreground">Jouw locatie</span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2 text-xs"
            onClick={useMyLocation}
            disabled={locating}
          >
            {locating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LocateFixed className="h-3.5 w-3.5" />
            )}
            {locating ? "Zoeken…" : "Mijn locatie"}
          </Button>
        </div>
      </div>

      {locError && (
        <p className="text-sm text-destructive">{locError}</p>
      )}

      {error && (
        <p className="text-sm text-muted-foreground">Weerdata kon niet geladen worden.</p>
      )}

      {!data && !error && (
        <div className="space-y-4 animate-pulse">
          <div className="rounded-2xl bg-card border border-border/60 p-6 h-40" />
          <div className="rounded-2xl bg-card border border-border/60 p-6 h-32" />
          <div className="rounded-2xl bg-card border border-border/60 p-6 h-64" />
        </div>
      )}

      {data && (
        <>
          {/* Current */}
          <div className="rounded-2xl bg-gradient-to-br from-accent/40 to-secondary/60 border border-border/50 p-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">{data.city}</p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-serif text-7xl font-semibold leading-none">{data.current.temp}°</p>
                <p className="text-lg text-muted-foreground mt-2">{descFor(data.current.code)}</p>
              </div>
              <CurrentIcon className="h-20 w-20 text-primary opacity-80" strokeWidth={1.2} />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border/40">
              <div className="flex flex-col items-center gap-1 text-center">
                <Thermometer className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">{data.current.feels_like}°</p>
                <p className="text-xs text-muted-foreground">Voelt als</p>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <Droplets className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">{data.current.humidity}%</p>
                <p className="text-xs text-muted-foreground">Luchtvochtigheid</p>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <Wind className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">{data.current.wind_speed} km/u</p>
                <p className="text-xs text-muted-foreground">Wind</p>
              </div>
            </div>
          </div>

          {/* Hourly */}
          <div className="rounded-2xl bg-card border border-border/60 p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Per uur</p>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {data.hourly.map((h, i) => {
                const HIcon = iconFor(h.code);
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-14">
                    <p className="text-xs text-muted-foreground">{i === 0 ? "Nu" : formatHour(h.time)}</p>
                    <HIcon className="h-5 w-5 text-primary/80" strokeWidth={1.5} />
                    <p className="text-sm font-medium">{h.temp}°</p>
                    {h.precip_prob > 0 && (
                      <p className="text-xs text-blue-500">{h.precip_prob}%</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily */}
          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            <p className="text-xs uppercase tracking-widest text-muted-foreground px-5 pt-5 pb-3">7-daagse voorspelling</p>
            <div className="divide-y divide-border/50">
              {data.daily.map((d, i) => {
                const DIcon = iconFor(d.code);
                return (
                  <div key={d.date} className="flex items-center gap-4 px-5 py-3">
                    <p className="text-sm w-20 capitalize">{formatDay(d.date, i)}</p>
                    <DIcon className="h-5 w-5 text-primary/80 shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 flex items-center gap-2">
                      {d.precip_prob > 0 && (
                        <span className="text-xs text-blue-500">{d.precip_prob}%</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{d.max}°</span>
                      <span className="text-muted-foreground">{d.min}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
