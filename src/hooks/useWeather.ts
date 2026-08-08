import { useEffect, useState } from "react";
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning } from "lucide-react";

export type Weather = {
  temp: number;
  code: number;
  city: string;
  daily: { date: string; max: number; min: number; code: number }[];
};

export function iconFor(code: number) {
  if ([0, 1].includes(code)) return Sun;
  if ([2, 3, 45, 48].includes(code)) return Cloud;
  if (code >= 51 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

export function descFor(code: number) {
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

// 's-Gravendeel-coordinaten, gedeeld door WeatherWidget (homepage-hero) en de
// vroegere aparte weerkaart — één plek voor de fetch-/iconlogica zodat beide
// nooit uit de pas kunnen lopen.
const LAT = 51.7722;
const LON = 4.6156;
const CITY = "'s-Gravendeel";

export function useWeather() {
  const [data, setData] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`,
        );
        const j = await r.json();
        if (cancelled) return;
        setData({
          temp: Math.round(j.current.temperature_2m),
          code: j.current.weather_code,
          city: CITY,
          daily: j.daily.time.slice(1, 4).map((d: string, i: number) => ({
            date: d,
            max: Math.round(j.daily.temperature_2m_max[i + 1]),
            min: Math.round(j.daily.temperature_2m_min[i + 1]),
            code: j.daily.weather_code[i + 1],
          })),
        });
      } catch {
        if (!cancelled) setError("Weer kon niet geladen worden");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}
