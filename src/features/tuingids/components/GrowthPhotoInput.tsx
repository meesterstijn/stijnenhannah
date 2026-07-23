import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, X } from "lucide-react";

type Props = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
};

// Two separate hidden inputs: one with capture="environment" for the camera
// (back camera hint on mobile), one without capture for the gallery.
// Both call the shared processIncoming() logic so upload handling is identical.
// ObjectURLs are created/revoked in sync with the files prop via useEffect.
export function GrowthPhotoInput({ files, onFilesChange, disabled }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [galleryKey, setGalleryKey] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  function processIncoming(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    onFilesChange([...files, ...Array.from(fileList)]);
  }

  function handleCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    processIncoming(e.target.files);
    e.currentTarget.value = "";
    setCameraKey((k) => k + 1);
  }

  function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    processIncoming(e.target.files);
    e.currentTarget.value = "";
    setGalleryKey((k) => k + 1);
  }

  function handleRemove(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {/* Camera input — capture="environment" hints the back camera on mobile */}
      <input
        key={cameraKey}
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
        disabled={disabled}
      />
      {/* Gallery input — no capture so the user can pick existing photos */}
      <input
        key={galleryKey}
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleGalleryChange}
        disabled={disabled}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled}
          className="sv-button sv-button-thin-border flex items-center gap-2 px-3 py-2 text-sm"
        >
          <Camera className="h-4 w-4" />
          Foto maken
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={disabled}
          className="sv-button sv-button-thin-border flex items-center gap-2 px-3 py-2 text-sm"
        >
          <ImageIcon className="h-4 w-4" />
          Uit galerij
        </button>
      </div>

      {previewUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previewUrls.map((url, i) => (
            <div key={url} className="relative shrink-0">
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                className="h-20 w-20 object-cover rounded-lg sv-icon-slot"
              />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                disabled={disabled}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full h-5 w-5 flex items-center justify-center"
                aria-label={`Foto ${i + 1} verwijderen`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
