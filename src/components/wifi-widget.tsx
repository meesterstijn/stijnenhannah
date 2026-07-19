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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="tuinieren-theme sv-panel p-8 flex flex-col items-center gap-5 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <div>
                <p className="sv-heading text-3xl">{data?.ssid ?? "Wifi"}</p>
                <p className="text-sm sv-muted mt-0.5">Scan om te verbinden</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="sv-icon-slot h-8 w-8 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin sv-muted" />
            ) : (
              <>
                <div ref={qrRef} />
                <p className="text-xs sv-muted">{data?.password}</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
