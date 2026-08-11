// Plant-import schema is the shared source of truth for validation and the
// generated ChatGPT JSON prompt. Keep import behavior and prompt generation
// derived from this definition.
//
// Waarom dit bestand bestaat: vóór deze refactor stonden de toegestane
// enum-waarden, de veldenlijst en de validatielogica alleen hardcoded in
// Tuinieren.tsx (validatePlantImportEntry + losse *_OPTIONS-constanten).
// Een nieuwe "JSON ophalen"-knop die daar een losse, met de hand
// overgetypte ChatGPT-prompt van zou maken, zou bij de eerstvolgende
// schemawijziging (nieuw veld, andere enum-waarde, ander datatype)
// ongemerkt verouderd raken. PLANT_IMPORT_FIELDS hieronder is daarom de
// ENIGE plek waar veldnamen/types/enums/nullable-gedrag/soort-vs-exemplaar-
// classificatie worden vastgelegd; zowel validatePlantImportEntry hieronder
// als de promptgenerator in plantImportPrompt.ts lezen uitsluitend hiervan.
//
// Het type PlantImportData (src/lib/supabase.ts) blijft de canonieke
// TypeScript-vorm van een import-entry — bewust NIET herschreven om hiervan
// afgeleid te worden (dat zou een te risicovolle refactor zijn voor een
// type dat op meerdere plekken in de app wordt gebruikt). In plaats daarvan
// dwingt _assertNoMissingFields/_assertNoUnknownFields hieronder via het
// TypeScript-typesysteem af dat PLANT_IMPORT_FIELDS exact dezelfde
// sleutelverzameling heeft als PlantImportData — een build-/typecheck-fout
// als de twee ooit uit elkaar lopen.
import type { PlantImportData } from "@/lib/supabase";
import { MONTH_OPTIONS } from "./plantStatus";

export { MONTH_OPTIONS };

// ─── Enum-opties (verplaatst uit Tuinieren.tsx, nu de enige bron) ─────────
export const SUN_OPTIONS = [
  "Volle zon",
  "Halfvolle zon",
  "Half schaduw",
  "Schaduw",
] as const;

export const GREENHOUSE_PREF_OPTIONS = [
  "Kas liefhebber",
  "Kas of buiten",
  "Alleen buiten",
] as const;

export const PLANT_CATEGORY_OPTIONS = [
  "🍅 Moestuin",
  "🍓 Fruit",
  "🌿 Kruiden",
  "🌸 Sierplanten",
  "🌳 Bomen & Mediterrane planten",
] as const;

export const LIFECYCLE_OPTIONS = ["Eenjarig", "Meerjarig"] as const;

export const GROWING_METHOD_OPTIONS = ["Volle grond", "Pot"] as const;

export const GROWTH_HABIT_OPTIONS = [
  "Omhoog",
  "Steun nodig",
  "Langs de grond",
  "Bosvormend",
] as const;

export const WATERING_METHOD_OPTIONS = [
  "Onder de voet (weken)",
  "Over de plant (bladbesproeiing)",
  "Op de bodem bij de wortels",
] as const;

export const HEALTH_STATUS_OPTIONS = [
  "Zaailing",
  "Net geplant",
  "Gezond",
  "In bloei",
  "Vruchten",
  "Stress",
  "Ziek",
  "Afgestorven",
] as const;

export const POT_MATERIAL_OPTIONS = [
  "Terracotta",
  "Kunststof",
  "Keramiek",
  "Metaal",
  "Hout",
  "Textiel",
  "Steen",
  "Biologisch afbreekbaar",
  "Anders",
] as const;

export const WINTER_HARDINESS_OPTIONS = [
  "Winterhard",
  "Beperkt winterhard",
  "Niet winterhard",
] as const;

export const PROPAGATION_OPTIONS = [
  "Stekken",
  "Zaad",
  "Scheuren / delen",
  "Uitlopers",
  "Bladstek",
  "Knollen / bollen",
] as const;

// ─── Veldmetadata ───────────────────────────────────────────────────────
//
// `kind` stuurt zowel de validatie hieronder als de typebeschrijving in de
// gegenereerde prompt. `kind` bepaalt NIET vanzelf of enumOptions ook
// daadwerkelijk hard gevalideerd worden — health_status/pot_material/
// growing_method hebben bijvoorbeeld wél enumOptions (voor de prompt/
// documentatie) maar staan als kind "string" (niet "enum"), omdat de
// bestaande validatePlantImportEntry deze drie nooit heeft afgedwongen —
// dat bestaande gedrag blijft hier bewust ongewijzigd (zie sectie
// "Discrepanties" in het opleverrapport).
export type PlantImportFieldKind =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "enum_array"
  | "month_array"
  | "iso_datetime"
  | "date";

// species  = generieke botanische/teeltinformatie van de SOORT.
// instance = eigenschap van een individueel, fysiek exemplaar (wanneer
//            gekocht/geplant, actuele gezondheid, welke pot het nu heeft,
//            wat het gekost heeft, ...) — nooit iets voor ChatGPT om voor
//            een botanische naam te verzinnen.
export type PlantImportFieldClassification = "species" | "instance";

export type PlantImportFieldSchema = {
  key: keyof PlantImportData;
  kind: PlantImportFieldKind;
  required: boolean;
  nullable: boolean;
  classification: PlantImportFieldClassification;
  enumOptions?: readonly string[];
  description?: string;
  // Alleen gezet voor de twee velden die validatePlantImportEntry al vóór
  // deze refactor hard controleerde (toxic_to_humans/toxic_to_cats) — de
  // overige booleans (reminders_enabled, feeding_reminders_enabled,
  // planted) werden nooit gevalideerd; dat bestaande gedrag blijft intact.
  strictBoolean?: boolean;
};

export const PLANT_IMPORT_FIELDS = [
  {
    key: "name",
    kind: "string",
    required: true,
    nullable: false,
    classification: "species",
    description:
      "Duidelijke Nederlandse weergavenaam. Verplicht, mag niet leeg zijn.",
  },
  {
    key: "species",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
    description: "Botanische (Latijnse) naam.",
  },
  {
    key: "fun_fact",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
    description: "Eén kort, leuk weetje over de soort.",
  },
  {
    key: "location",
    kind: "string",
    required: false,
    nullable: true,
    // Exemplaar-specifiek (waar STAAT dít exemplaar) ondanks dat het veld
    // technisch in het importschema van de soort-catalogus zit — zie ook
    // PlantInstance.location, dat exact dezelfde betekenis heeft voor een
    // individueel exemplaar.
    classification: "instance",
    description: "Waar dit fysieke exemplaar staat — geen soorteigenschap.",
  },
  {
    key: "category",
    kind: "enum",
    required: false,
    nullable: true,
    classification: "species",
    enumOptions: PLANT_CATEGORY_OPTIONS,
  },
  {
    key: "lifecycle",
    kind: "enum",
    required: false,
    nullable: true,
    classification: "species",
    enumOptions: LIFECYCLE_OPTIONS,
  },
  {
    key: "size_cm",
    kind: "number",
    required: false,
    nullable: true,
    classification: "species",
    description: "Volwassen hoogte in cm.",
  },
  {
    key: "spacing_cm",
    kind: "number",
    required: false,
    nullable: true,
    classification: "species",
    description: "Aanbevolen plantafstand in cm.",
  },
  {
    key: "growth_habit",
    kind: "enum_array",
    required: false,
    nullable: true,
    classification: "species",
    enumOptions: GROWTH_HABIT_OPTIONS,
  },
  {
    key: "sun_needs",
    kind: "enum_array",
    required: false,
    nullable: true,
    classification: "species",
    enumOptions: SUN_OPTIONS,
    description: "Genereer altijd als array (ook bij één waarde).",
  },
  {
    key: "season_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "water_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
    description:
      "Maak duidelijk dat werkelijke waterbehoefte mede afhangt van temperatuur, regen, potgrootte en grondvocht.",
  },
  {
    key: "watering_method",
    kind: "enum_array",
    required: false,
    nullable: true,
    classification: "species",
    enumOptions: WATERING_METHOD_OPTIONS,
  },
  {
    key: "watering_soak_minutes",
    kind: "number",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "growing_method",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
    enumOptions: GROWING_METHOD_OPTIONS,
  },
  {
    key: "pot_min_liters",
    kind: "number",
    required: false,
    nullable: true,
    classification: "species",
    description: "Absoluut praktisch minimum voor potteelt, in liters.",
  },
  {
    key: "pot_recommended_liters",
    kind: "number",
    required: false,
    nullable: true,
    classification: "species",
    description: "Aanbevolen potgrootte voor een volwassen plant, in liters.",
  },
  {
    key: "pot_min_depth_cm",
    kind: "number",
    required: false,
    nullable: true,
    classification: "species",
    description: "Absoluut praktisch minimum potdiepte in cm.",
  },
  {
    key: "pot_recommended_depth_cm",
    kind: "number",
    required: false,
    nullable: true,
    classification: "species",
    description: "Aanbevolen potdiepte voor een volwassen plant, in cm.",
  },
  {
    key: "pot_water_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "water_interval_days",
    kind: "number",
    required: false,
    nullable: true,
    classification: "species",
    description: "Richtwaarde in dagen tussen water geven bij volle grond.",
  },
  {
    key: "pot_water_interval_days",
    kind: "number",
    required: false,
    nullable: true,
    classification: "species",
    description: "Richtwaarde in dagen tussen water geven bij potteelt.",
  },
  {
    key: "last_watered_at",
    kind: "iso_datetime",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "reminders_enabled",
    kind: "boolean",
    required: false,
    nullable: false,
    classification: "species",
    description: "Weglaten = standaard true.",
  },
  {
    key: "greenhouse_pref",
    kind: "enum",
    required: false,
    nullable: true,
    classification: "species",
    enumOptions: GREENHOUSE_PREF_OPTIONS,
  },
  {
    key: "greenhouse_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "feeding_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "feeding_interval_days",
    kind: "number",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "last_fed_at",
    kind: "iso_datetime",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "feeding_reminders_enabled",
    kind: "boolean",
    required: false,
    nullable: false,
    classification: "species",
    description: "Weglaten = standaard true.",
  },
  {
    key: "feeding_months",
    kind: "month_array",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "soil_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "soil_ph_min",
    kind: "number",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "soil_ph_max",
    kind: "number",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "temperature_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "humidity_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "winter_hardiness",
    kind: "enum",
    required: false,
    nullable: true,
    classification: "species",
    enumOptions: WINTER_HARDINESS_OPTIONS,
  },
  {
    key: "winter_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "pruning_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "pest_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "toxic_to_humans",
    kind: "boolean",
    required: false,
    nullable: false,
    classification: "species",
    strictBoolean: true,
    description: "Weglaten = standaard false. Nooit null.",
  },
  {
    key: "toxic_to_cats",
    kind: "boolean",
    required: false,
    nullable: false,
    classification: "species",
    strictBoolean: true,
    description: "Weglaten = standaard false. Nooit null.",
  },
  {
    key: "toxicity_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "sow_months",
    kind: "month_array",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "sow_week",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
    description:
      'Bv. "week 12-14". Alleen invullen als een weekrange redelijk betrouwbaar is, anders null.',
  },
  {
    key: "sow_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "bloom_months",
    kind: "month_array",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "bloom_week",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "bloom_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "propagation_methods",
    kind: "enum_array",
    required: false,
    nullable: true,
    classification: "species",
    enumOptions: PROPAGATION_OPTIONS,
  },
  {
    key: "propagation_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "harvest_months",
    kind: "month_array",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "harvest_week",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
    description:
      "Alleen invullen als een weekrange redelijk betrouwbaar is, anders null.",
  },
  {
    key: "harvest_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "general_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
  },
  {
    key: "photo_url",
    kind: "string",
    required: false,
    nullable: true,
    classification: "species",
    description:
      "Laat altijd op null staan — verzin nooit een afbeeldings-URL.",
  },
  {
    key: "planted",
    kind: "boolean",
    required: false,
    nullable: false,
    classification: "instance",
  },
  {
    key: "planted_at",
    kind: "iso_datetime",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "health_status",
    kind: "string",
    required: false,
    nullable: true,
    classification: "instance",
    enumOptions: HEALTH_STATUS_OPTIONS,
  },
  {
    key: "last_checked_at",
    kind: "date",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "water_skip_until",
    kind: "date",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "first_flower_at",
    kind: "date",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "first_fruit_at",
    kind: "date",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "pot_size_liters",
    kind: "number",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "pot_material",
    kind: "string",
    required: false,
    nullable: true,
    classification: "instance",
    enumOptions: POT_MATERIAL_OPTIONS,
  },
  {
    key: "pot_color",
    kind: "string",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "soil_type",
    kind: "string",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "soil_mix_notes",
    kind: "string",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "last_repotted_at",
    kind: "date",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "acquired_at",
    kind: "date",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "source",
    kind: "string",
    required: false,
    nullable: true,
    classification: "instance",
  },
  {
    key: "price",
    kind: "number",
    required: false,
    nullable: true,
    classification: "instance",
  },
] as const satisfies readonly PlantImportFieldSchema[];

// ─── Compile-time bescherming tegen schema-drift ──────────────────────────
// Geen testframework in dit project — dit is het structurele vangnet
// i.p.v. een los testbestand: als PlantImportData een veld wint of
// verliest zonder dat PLANT_IMPORT_FIELDS wordt bijgewerkt, faalt
// `tsc --noEmit`/`npm run build` met de ontbrekende/overtollige veldnaam
// in de typefout hieronder — dus nooit een stille drift tussen de
// importer en de ChatGPT-prompt.
type SchemaKeys = (typeof PLANT_IMPORT_FIELDS)[number]["key"];
type MissingFromSchema = Exclude<keyof PlantImportData, SchemaKeys>;
type UnknownInSchema = Exclude<SchemaKeys, keyof PlantImportData>;

const _assertNoMissingFields: MissingFromSchema extends never
  ? true
  : [
      "PLANT_IMPORT_FIELDS mist velden uit PlantImportData:",
      MissingFromSchema,
    ] = true;
const _assertNoUnknownFields: UnknownInSchema extends never
  ? true
  : [
      "PLANT_IMPORT_FIELDS bevat velden die niet in PlantImportData bestaan:",
      UnknownInSchema,
    ] = true;
void _assertNoMissingFields;
void _assertNoUnknownFields;

export function getSpeciesImportFields(): PlantImportFieldSchema[] {
  return PLANT_IMPORT_FIELDS.filter((f) => f.classification === "species");
}

export function getInstanceImportFields(): PlantImportFieldSchema[] {
  return PLANT_IMPORT_FIELDS.filter((f) => f.classification === "instance");
}

// ─── Validator ─────────────────────────────────────────────────────────
//
// Verplaatst uit Tuinieren.tsx, gedrag ongewijzigd — nu gedreven door
// PLANT_IMPORT_FIELDS in plaats van losse, parallelle enumChecks/
// arrayEnumChecks/monthArrayFields/numericFields-arrays. Elke tak hieronder
// komt exact overeen met de oorspronkelijke, losse implementatie.
export type PlantImportValidationResult =
  | { ok: true; data: PlantImportData }
  | { ok: false; errors: string[] };

export function validatePlantImportEntry(
  value: unknown,
): PlantImportValidationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      ok: false,
      errors: ["Geen geldig plantobject (verwacht een JSON-object)."],
    };
  }

  const p = value as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof p.name !== "string" || !p.name.trim()) {
    errors.push(
      "Plant mist een geldige naam (name is verplicht en mag niet leeg zijn).",
    );
  }

  // Expliciet verbreed naar de algemene PlantImportFieldSchema: elk
  // entry-object hierboven is met `as const` getypeerd op zijn eigen exacte
  // vorm (alleen de properties die dat specifieke veld ook echt heeft), dus
  // zonder deze cast zou bv. `field.strictBoolean` niet bestaan op entries
  // die dat optionele veld niet specificeren.
  for (const field of PLANT_IMPORT_FIELDS as readonly PlantImportFieldSchema[]) {
    if (field.key === "name") continue;
    const v = p[field.key];
    if (v === undefined || v === null) continue;

    switch (field.kind) {
      case "enum": {
        const allowed = field.enumOptions as readonly string[];
        if (!allowed.includes(v as string)) {
          errors.push(
            `Ongeldige waarde voor ${field.key}: "${v}". Toegestaan: ${allowed.join(" | ")}.`,
          );
        }
        break;
      }
      case "enum_array": {
        const allowed = field.enumOptions as readonly string[];
        // sun_needs mag ook een enkele string zijn (legacy export-formaat).
        const items = Array.isArray(v)
          ? v
          : field.key === "sun_needs"
            ? [v]
            : null;
        if (items === null) {
          errors.push(`${field.key} moet een array zijn.`);
        } else {
          for (const item of items) {
            if (!allowed.includes(item as string)) {
              errors.push(
                `${field.key} bevat een onbekende waarde: "${item}". Toegestaan: ${allowed.join(" | ")}.`,
              );
            }
          }
        }
        break;
      }
      case "month_array": {
        if (!Array.isArray(v)) {
          errors.push(`${field.key} moet een array zijn.`);
        } else {
          for (const item of v) {
            if (
              !(MONTH_OPTIONS as readonly string[]).includes(item as string)
            ) {
              errors.push(
                `${field.key} bevat een ongeldige maand: "${item}". Gebruik volledige Nederlandse namen.`,
              );
            }
          }
        }
        break;
      }
      case "number": {
        if (typeof v === "string" && v.trim() !== "" && isNaN(Number(v))) {
          errors.push(`${field.key} is geen geldig getal: "${v}".`);
        } else if (typeof v !== "number" && typeof v !== "string") {
          errors.push(
            `${field.key} moet een getal zijn, maar is: ${typeof v}.`,
          );
        }
        break;
      }
      case "boolean": {
        if (field.strictBoolean && typeof v !== "boolean") {
          errors.push(
            `${field.key} moet true of false zijn (gevonden: "${v}").`,
          );
        }
        break;
      }
      // "string" / "iso_datetime" / "date": geen aanvullende validatie,
      // exact zoals in de oorspronkelijke implementatie.
      default:
        break;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: p as PlantImportData };
}
