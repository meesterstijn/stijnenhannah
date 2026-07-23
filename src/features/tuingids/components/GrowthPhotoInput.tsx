import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

type Props = {
  file: File | null;
  onFileSelected: (file: File | null) => void;
  disabled?: boolean;
};

// File input with local preview. Manages the ObjectURL lifecycle internally.
// Pass file=null + onFileSelected to let the parent own the File state.
export function GrowthPhotoInput({ file, onFileSelected, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // inputKey reset forces the browser to clear the file input after removal,
  // so the same file can be selected again.
  const [inputKey, setInputKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    onFileSelected(selected);
  }

  function handleRemove() {
    onFileSelected(null);
    setInputKey((k) => k + 1);
  }

  return (
    <div className="space-y-2">
      <input
        key={inputKey}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      {previewUrl ? (
        <div className="relative inline-block max-w-full">
          <img
            src={previewUrl}
            alt="Voorvertoning"
            className="max-h-40 max-w-full rounded-lg object-contain"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1 right-1 bg-black/60 text-white rounded-full h-5 w-5 flex items-center justify-center"
            aria-label="Foto verwijderen"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="sv-button sv-button-thin-border flex items-center gap-2 px-3 py-2 text-sm"
        >
          <Camera className="h-4 w-4" />
          Foto toevoegen
        </button>
      )}
    </div>
  );
}
