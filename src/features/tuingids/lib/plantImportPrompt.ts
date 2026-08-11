// Bouwt de "JSON ophalen"-ChatGPT-prompt uitsluitend uit
// PLANT_IMPORT_FIELDS (plantImportSchema.ts) — geen los, met de hand
// bijgehouden veldenoverzicht. Alleen de omringende instructietekst
// (toon, uitleg, vuistregels per onderwerp) is hier handgeschreven, zoals
// bewust toegestaan: dat kan niet zinvol uit een datamodel worden
// afgeleid. De veldenlijst zelf — namen/types/nullable/enumwaarden/
// soort-vs-exemplaar — komt altijd rechtstreeks uit het schema, dus een
// toekomstige schemawijziging werkt hier automatisch door.
import {
  MONTH_OPTIONS,
  getInstanceImportFields,
  getSpeciesImportFields,
  type PlantImportFieldSchema,
} from "./plantImportSchema";

function formatOptionsList(options: readonly string[] | undefined): string {
  return (options ?? []).map((o) => `"${o}"`).join(" | ");
}

function typeLabel(field: PlantImportFieldSchema): string {
  switch (field.kind) {
    case "string":
      return field.nullable ? "string of null" : "string";
    case "number":
      return field.nullable
        ? "getal (JSON-number) of null"
        : "getal (JSON-number)";
    case "boolean":
      return field.nullable
        ? "true of false, of null"
        : "true of false (nooit null)";
    case "enum":
      return `exact één van: ${formatOptionsList(field.enumOptions)}${
        field.nullable ? ", of null" : ""
      }`;
    case "enum_array":
      return `array met 0 of meer van: ${formatOptionsList(field.enumOptions)}`;
    case "month_array":
      return `array met 0 of meer maanden uit: ${formatOptionsList(MONTH_OPTIONS)}`;
    case "iso_datetime":
      return "ISO-datumtijd-string of null";
    case "date":
      return "datum-string (YYYY-MM-DD) of null";
    default: {
      // Compile-time exhaustiveness: een nieuw PlantImportFieldKind zonder
      // bijbehorende tak hierboven laat dit niet meer typechecken.
      const exhaustive: never = field.kind;
      throw new Error(`Onbekend PlantImportFieldKind: ${String(exhaustive)}`);
    }
  }
}

function describeFieldForPrompt(field: PlantImportFieldSchema): string {
  const marker = field.required ? " — VERPLICHT" : "";
  const description = field.description ? ` ${field.description}` : "";
  return `- ${field.key}${marker}: ${typeLabel(field)}.${description}`;
}

// Runtime-zelfcontrole, uitgevoerd bij elke prompt-generatie (dus bij elke
// klik op "JSON ophalen") — dit project heeft geen testframework, dus dit
// is het lichtgewicht vangnet dat er wél voor zorgt dat een kapotte/
// gedrifte prompt nooit stilzwijgend gekopieerd wordt: bij een mismatch
// gooit deze functie, en de aanroeper (handleCopyImportPrompt in
// Tuinieren.tsx) toont dan de bestaande foutmelding i.p.v. een verouderde
// prompt naar het klembord te kopiëren.
function verifyPlantImportPromptSchema(
  prompt: string,
  fieldLines: string,
  speciesFields: readonly PlantImportFieldSchema[],
): void {
  if (speciesFields.length === 0) {
    throw new Error(
      "plantImportPrompt: geen enkel soortveld gevonden in PLANT_IMPORT_FIELDS.",
    );
  }

  const missing = speciesFields
    .filter((f) => !fieldLines.includes(f.key))
    .map((f) => f.key);
  if (missing.length > 0) {
    throw new Error(
      `plantImportPrompt: veld(en) ontbreken in de gegenereerde schema-sectie: ${missing.join(", ")}.`,
    );
  }

  const wronglyIncluded = getInstanceImportFields()
    .map((f) => f.key)
    .filter((key) => fieldLines.includes(key));
  if (wronglyIncluded.length > 0) {
    throw new Error(
      `plantImportPrompt: exemplaar-specifieke velden staan onterecht in de soort-schema-sectie: ${wronglyIncluded.join(", ")}.`,
    );
  }

  if (!prompt.includes("JSON-array")) {
    throw new Error(
      "plantImportPrompt: de JSON-array-outputinstructie ontbreekt.",
    );
  }
}

export function buildPlantImportChatGptPrompt(): string {
  const speciesFields = getSpeciesImportFields();
  const fieldLines = speciesFields.map(describeFieldForPrompt).join("\n");

  const sections = [
    `Je genereert importeerklare plantdata voor mijn Tuingids-app.`,

    `OUTPUTVORM
Antwoord UITSLUITEND met geldige JSON — geen markdown-codeblok, geen uitleg, geen tekst vóór de JSON, geen tekst ná de JSON.
Geef ALTIJD een JSON-array terug, ook wanneer ik maar één plantsoort opgeef. Bij meerdere plantsoorten: één object per soort, in exact dezelfde volgorde als ik ze opgeef.`,

    `BOTANISCHE NAAM
- "species" bevat de correcte botanische (Latijnse) naam.
- "name" bevat een duidelijke Nederlandse weergavenaam.
- Nederlandse teeltomstandigheden zijn leidend voor zaai-, oogst-, winterhardheid- en kasadvies.
- Gebruik cultivar-specifieke eigenschappen alleen wanneer ik expliciet een cultivar opgeef; bij een kale soortnaam beschrijf je de soort in het algemeen.`,

    `GEEN VERZONNEN DATA
- Verzin geen gegevens wanneer betrouwbare soortinformatie ontbreekt.
- Gebruik null voor een onbekende of niet-toepasselijke waarde — nooit een gokwaarde.
- Gebruik een lege array ([]) wanneer geen enkele optie van een array-veld betrouwbaar van toepassing is.
- Voeg nooit zelf nieuwe enumwaarden toe en gebruik nooit alternatieve spellingen van de hieronder opgegeven enumwaarden — neem ze letterlijk over.
- Voeg geen velden toe die niet in het schema hieronder staan.`,

    `GETALLEN
Numerieke velden zijn echte JSON-getallen, bijvoorbeeld "spacing_cm": 15 — nooit "15" en nooit "15 cm". Geen eenheden in het getal zelf.`,

    `NULLS EN ARRAYS
- null voor een onbekende nullable scalaire waarde.
- [] voor een array-veld zonder betrouwbare waarden.
- Gebruik nooit teksten als "onbekend", "n.v.t." of "-" in plaats van null, tenzij het veld inhoudelijk om vrije tekst vraagt (zoals de *_notes-velden).`,

    `WATERGIFT
Geef bij water_interval_days/pot_water_interval_days realistische praktische waarden voor Nederlandse omstandigheden wanneer je die betrouwbaar weet. Maak in de bijbehorende tekstvelden (water_notes/pot_water_notes) duidelijk dat de werkelijke waterbehoefte mede afhangt van temperatuur, regen, potgrootte en grondvocht.`,

    `POTTEN
Deze Tuingids wordt veel gebruikt voor potteelt. Geef bij pot_min_liters/pot_recommended_liters/pot_min_depth_cm/pot_recommended_depth_cm realistische waarden voor een volwassen plant / normale teelt van deze soort, met een duidelijk onderscheid tussen het absolute praktische minimum en de aanbevolen maat. Vul pot_water_notes aanvullend in waar nuttig.`,

    `ZAAIEN EN OOGSTEN
Voor sow_months/sow_week/harvest_months/harvest_week zijn Nederlandse buiten-/moestuinomstandigheden leidend. Vul sow_week/harvest_week alleen in wanneer een bruikbare weekrange redelijk betrouwbaar is (bijvoorbeeld "week 12-14"); gebruik anders null.`,

    `AFBEELDING EN LOCATIE
- photo_url: laat dit altijd op null staan. Verzin nooit een afbeeldings-URL.
- Voeg GEEN "location"-veld toe — dat is een eigenschap van een individueel fysiek exemplaar in mijn tuin, niet van de plantsoort, en hoort niet in deze data.`,

    `BOOLEANS
Gebruik echte JSON-booleans (true/false), nooit strings zoals "true". Laat reminders_enabled/feeding_reminders_enabled weg als je geen reden hebt ze op false te zetten (worden dan standaard true). Zet toxic_to_humans/toxic_to_cats altijd expliciet op true of false op basis van wat je van de soort weet — nooit null.`,

    `SCHEMA
Elk veld hieronder mag in je JSON-object voorkomen. Velden die je niet met redelijke zekerheid weet, mag je weglaten (of op null/[] zetten, zie hierboven).
${fieldLines}`,

    `Genereer nu de JSON voor de volgende plantsoort(en), in dezelfde volgorde als hieronder opgegeven:
[HIER DE BOTANISCHE NAAM/NAMEN INVULLEN, BIJVOORBEELD:]
Valerianella locusta
Eruca sativa`,
  ];

  const prompt = sections.join("\n\n");
  verifyPlantImportPromptSchema(prompt, fieldLines, speciesFields);
  return prompt;
}
