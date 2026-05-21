import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Wifi, X } from "lucide-react";

const SSID = "WiFiesta";
const PASSWORD = "JezusisKoning";
const WIFI_STRING = `WIFI:T:WPA;S:${SSID};P:${PASSWORD};;`;

export function WifiWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-3 sm:min-h-[100px] w-full text-left"
      >
        <Wifi className="h-5 w-5 text-primary shrink-0" strokeWidth={1.6} />
        <div className="flex-1 min-w-0">
          <p className="font-serif text-base font-semibold leading-tight">Gastnetwerk</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-tight">Toon QR code</p>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card rounded-3xl p-8 flex flex-col items-center gap-5 shadow-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <div>
                <p className="font-serif text-xl font-semibold">{SSID}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Scan om te verbinden</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <QRCodeSVG value={WIFI_STRING} size={240} bgColor="transparent" fgColor="currentColor" className="text-foreground" />
            <p className="text-xs text-muted-foreground">{PASSWORD}</p>
          </div>
        </div>
      )}
    </>
  );
}
