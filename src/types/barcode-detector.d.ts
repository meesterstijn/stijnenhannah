// Minimale ambient-declaratie voor de native Barcode Detection API
// (window.BarcodeDetector). Nog niet onderdeel van TypeScript's lib.dom.d.ts;
// ondersteund in Chrome/Edge/Android, NIET in Safari/iOS — QrScanner.tsx
// detecteert de afwezigheid via `"BarcodeDetector" in window` en valt dan
// terug op jsQR. Alleen de subset die QrScanner.tsx gebruikt is getypt.
interface BarcodeDetectorOptions {
  formats?: string[];
}

interface DetectedBarcode {
  rawValue: string;
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(image: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector;
}
