import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCodeStyling from "qr-code-styling";
import { Wifi, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
        className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-3 sm:min-h-[100px] w-full text-left"
      >
        <Wifi className="h-5 w-5 text-primary shrink-0" strokeWidth={1.6} />
        <div className="flex-1 min-w-0">
          <p className="font-serif text-base font-semibold leading-tight">Wifi</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-tight">Toon QR code</p>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background rounded-3xl p-8 flex flex-col items-center gap-5 shadow-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <div>
                <p className="font-serif text-xl font-semibold">{data?.ssid ?? "Wifi"}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Scan om te verbinden</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div ref={qrRef} />
                <p className="text-xs text-muted-foreground">{data?.password}</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
