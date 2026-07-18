import { useQuery } from "@tanstack/react-query";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
} from "lucide-react";

const LATITUDE = 51.7822;
const LONGITUDE = 4.6133;

type ForecastResponse = {
  daily: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
};

function iconForCode(code: number) {
  if (code === 0) return Sun;
  if (code <= 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 95) return CloudLightning;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))
    return CloudSnow;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
    return CloudRain;
  return Cloud;
}

async function fetchForecast(): Promise<ForecastResponse> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Europe%2FAmsterdam&forecast_days=3`,
  );
  if (!res.ok) throw new Error("Weerdata ophalen mislukt");
  return res.json();
}

export function WeatherForecast() {
  const { data } = useQuery({
    queryKey: ["weather-forecast"],
    queryFn: fetchForecast,
    staleTime: 30 * 60 * 1000,
  });

  if (!data) return null;

  const { time, weathercode, temperature_2m_max, temperature_2m_min } =
    data.daily;

  return (
    <div className="flex items-center justify-end gap-2 sm:gap-4">
      {time.map((day, i) => {
        const Icon = iconForCode(weathercode[i]);
        const label = new Date(day).toLocaleDateString("nl-NL", {
          weekday: "short",
        });
        return (
          <div
            key={day}
            className="flex items-center gap-1 sm:gap-1.5"
          >
            <span className="hidden sm:inline capitalize text-sm">{label}</span>
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-sm whitespace-nowrap">
              {Math.round(temperature_2m_max[i])}°/
              {Math.round(temperature_2m_min[i])}°
            </span>
          </div>
        );
      })}
    </div>
  );
}
