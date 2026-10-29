import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { optimizeImage } from "@/lib/optimizeImage";
import {
  WEAPON_TYPES,
  type Weapon,
  type WeaponType,
} from "@/features/schietsport/domain/model";
import {
  createWeapon,
  removeWeaponPhoto,
  setWeaponPhoto,
  updateWeapon,
  type WeaponInput,
} from "@/features/schietsport/db/repository";
import { useSchietsport } from "@/features/schietsport/hooks/SchietsportProvider";
import { useWeaponPhotoUrl } from "@/features/schietsport/hooks/useSchietsportData";
import {
  Button,
  Field,
  NativeSelect,
  Segmented,
  TextArea,
  TextInput,
} from "@/features/schietsport/components/form";

export const WEAPON_TYPE_LABELS: Record<WeaponType, string> = {
  pistool: "Pistool",
  revolver: "Revolver",
  karabijn: "Karabijn",
  geweer: "Geweer",
  luchtpistool: "Luchtpistool",
  luchtgeweer: "Luchtgeweer",
  anders: "Anders",
};

const empty: WeaponInput = {
  name: "",
  brand: "",
  model: "",
  weaponType: "pistool",
  caliber: ".22 LR",
  ownership: "eigen",
  notes: "",
};

// Aanmaken of bewerken van een wapenprofiel. Bewust geen velden voor
// serienummers of vergunningsgegevens.
export function WeaponForm({
  weapon,
  onDone,
}: {
  weapon?: Weapon;
  onDone: (weapon: Weapon) => void;
}) {
  const { db, userId } = useSchietsport();
  const [values, setValues] = useState<WeaponInput>(
    weapon
      ? {
          name: weapon.name,
          brand: weapon.brand ?? "",
          model: weapon.model ?? "",
          weaponType: weapon.weaponType,
          caliber: weapon.caliber ?? "",
          ownership: weapon.ownership,
          notes: weapon.notes ?? "",
        }
      : empty,
  );
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const existingPhoto = useWeaponPhotoUrl(weapon?.id);
  const shownPhoto = photoPreview ?? (removePhoto ? null : existingPhoto);

  const set = <K extends keyof WeaponInput>(key: K, value: WeaponInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const nameError =
    values.name.trim().length === 0 ? "Geef het wapen een naam." : null;

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const optimized = await optimizeImage(file, {
        maxSidePx: 1200,
        quality: 0.8,
        maxFileBytes: 25 * 1024 * 1024,
      });
      setPhoto(optimized.blob);
      setPhotoPreview(URL.createObjectURL(optimized.blob));
      setRemovePhoto(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Foto mislukt");
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (nameError || saving) return;
    setSaving(true);
    try {
      const saved = weapon
        ? (await updateWeapon(db, weapon.id, values), { ...weapon, ...values })
        : await createWeapon(db, userId, values);
      if (photo) await setWeaponPhoto(db, saved.id, photo);
      else if (removePhoto && weapon) await removeWeaponPhoto(db, weapon.id);
      toast.success(weapon ? "Wapen bijgewerkt" : "Wapen toegevoegd");
      onDone(saved as Weapon);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-black/25 text-muted-foreground transition-colors hover:border-[var(--ss-copper)]"
          aria-label="Foto kiezen"
        >
          {shownPhoto ? (
            <img
              src={shownPhoto}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Camera className="h-6 w-6" strokeWidth={1.5} />
          )}
        </button>
        <div className="space-y-1.5 text-sm">
          <p className="font-medium">Foto (optioneel)</p>
          <p className="text-xs text-muted-foreground">
            Wordt verkleind en alleen privé bewaard.
          </p>
          {shownPhoto && (
            <button
              type="button"
              onClick={() => {
                setPhoto(null);
                setPhotoPreview(null);
                setRemovePhoto(true);
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" /> Foto verwijderen
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void onPickPhoto(e.target.files?.[0])}
        />
      </div>

      <Field
        label="Naam"
        hint="Bijvoorbeeld “Walther GSP (eigen)” of “Clubpistool 3”."
      >
        <TextInput
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Naam van dit wapen"
          maxLength={80}
          autoFocus={!weapon}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Merk">
          <TextInput
            value={values.brand ?? ""}
            onChange={(e) => set("brand", e.target.value)}
            maxLength={80}
          />
        </Field>
        <Field label="Model">
          <TextInput
            value={values.model ?? ""}
            onChange={(e) => set("model", e.target.value)}
            maxLength={80}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <NativeSelect
            value={values.weaponType}
            onChange={(e) => set("weaponType", e.target.value as WeaponType)}
          >
            {WEAPON_TYPES.map((type) => (
              <option key={type} value={type}>
                {WEAPON_TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Kaliber">
          <TextInput
            value={values.caliber ?? ""}
            onChange={(e) => set("caliber", e.target.value)}
            placeholder=".22 LR"
            maxLength={40}
          />
        </Field>
      </div>

      <Field label="Eigendom">
        <Segmented
          ariaLabel="Eigendom"
          value={values.ownership}
          onChange={(value) => set("ownership", value)}
          options={[
            { value: "eigen", label: "Eigen wapen" },
            { value: "geleend", label: "Geleend / club" },
          ]}
        />
      </Field>

      <Field label="Opmerkingen">
        <TextArea
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={2000}
          placeholder="Vizierinstelling, munitie, bijzonderheden…"
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        className="w-full py-3"
        disabled={!!nameError || saving}
      >
        {weapon ? "Wijzigingen opslaan" : "Wapen toevoegen"}
      </Button>
    </form>
  );
}
