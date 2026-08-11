import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCodeStyling from "qr-code-styling";
import { Wifi, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cardSurface } from "@/components/modern-surfaces";

async function fetchWifiSettings(): Promise<{ ssid: string; password: string }> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["wifi_ssid", "wifi_password"]);
  if (error) throw error;
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return { ssid: map.wifi_ssid ?? "", password: map.wifi_password ?? "" };
}

const qrCode = new QRCodeStyling({
  width: 240,
  height: 240,
  type: "svg",
  dotsOptions: { type: "rounded", color: "#000000" },
  cornersSquareOptions: { type: "extra-rounded", color: "#000000" },
  cornersDotOptions: { type: "dot", color: "#000000" },
  backgroundOptions: { color: "#f8f3e6" },
  qrOptions: { errorCorrectionLevel: "M" },
});

export function WifiWidget() {
  const [open, setOpen] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["wifi_settings"],
    queryFn: fetchWifiSettings,
    enabled: open,
  });

  const wifiString = data ? `WIFI:T:WPA;S:${data.ssid};P:${data.password};;` : "";

  useEffect(() => {
    if (!open || !data || !qrRef.current) return;
    qrCode.update({ data: wifiString });
    qrRef.current.innerHTML = "";
    qrCode.append(qrRef.current);
  }, [open, data, wifiString]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="sv-panel group p-4 hover:-translate-y-0.5 transition-transform flex items-center gap-3 sm:min-h-[100px] w-full text-left"
      >
        <div className="sv-icon-slot h-10 w-10 flex items-center justify-center shrink-0">
          <Wifi className="h-5 w-5" strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="sv-heading text-2xl leading-tight">Wifi</p>
          <p className="text-xs sv-muted mt-0.5 leading-tight">Toon QR code</p>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className={`${cardSurface({ padding: "lg" })} w-full max-w-sm flex flex-col items-center gap-5`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Wifi className="h-5 w-5" strokeWidth={1.7} />
                </div>
                <div className="min-w-0">
                  <p className="font-serif text-xl font-semibold truncate">
                    {data?.ssid ?? "Wifi"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Scan om te verbinden
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div
                  ref={qrRef}
                  className="rounded-2xl border border-border/60 bg-white p-3"
                />
                <p className="text-xs text-muted-foreground tracking-wide">
                  {data?.password}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
