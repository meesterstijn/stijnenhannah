// "Wat is er nieuw" in Training. Nieuwste bovenaan. Bij een nieuwe release
// een update BOVENAAN toevoegen met een nieuw, uniek id; elke gebruiker
// krijgt die dan één keer te zien (zie WhatsNew.tsx). Ids nooit wijzigen of
// hergebruiken: het laatst gezien id staat in de instellingen van iedereen.
//
// Schrijf voor de gebruiker: kort, wat je nu kunt en waar je het vindt.

export type UpdateItem = {
  title: string;
  text: string;
  // Gemaakt naar aanleiding van feedback van een gebruiker.
  fromFeedback?: boolean;
};

export type TrainingUpdate = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  items: UpdateItem[];
};

export const UPDATES: TrainingUpdate[] = [
  {
    id: "2026-11-08-testfase",
    date: "2026-11-08",
    title: "Nieuw in Training",
    items: [
      {
        title: "Per set instellen in je schema",
        text: "In Schema bewerken staat bij elke oefening de schakelaar 'Per set instellen'. Daarmee geef je elke set een eigen gewicht en aantal herhalingen, bijvoorbeeld 10 × 20 kg, 10 × 25 kg en 8 × 30 kg. Na je eerste training staat per set klaar wat je de vorige keer echt deed.",
        fromFeedback: true,
      },
      {
        title: "Feedback geven",
        text: "Rechtsonder op elke pagina staat de knop Feedback. Schrijf kort wat er misgaat, wat onduidelijk is of wat beter kan. De pagina waar je bent gaat automatisch mee. Zonder internet wordt je feedback later verstuurd.",
      },
      {
        title: "Eigen oefening toevoegen tijdens het kiezen",
        text: "Staat een oefening niet in de lijst? Zoek erop en tik op 'als eigen oefening toevoegen'. Bovenaan het kiesvenster staat ook 'Eigen oefening toevoegen'. Alleen jij ziet je eigen oefening, tot de beheerder hem voor iedereen beschikbaar maakt.",
      },
      {
        title: "Updates en reacties",
        text: "Onder Meer → Updates lees je de laatste wijzigingen terug, en zie je wat er met jouw feedback is gedaan.",
      },
      {
        title: "Kleine verbeteringen",
        text: "Typen in een venster tijdens een training werkt weer (de cursor sprong steeds weg). Op het inlogscherm staat 'Wachtwoord vergeten?'.",
      },
    ],
  },
];

export const MAX_UPDATES = 10;

export const recentUpdates = (list = UPDATES) => list.slice(0, MAX_UPDATES);

/**
 * Updates die deze gebruiker nog niet zag. Nog nooit iets gezien (nieuw
 * account of van vóór dit venster): alleen de nieuwste, niet de hele
 * geschiedenis.
 */
export function unseenUpdates(
  lastSeenId: string | null | undefined,
  list = UPDATES,
): TrainingUpdate[] {
  if (list.length === 0) return [];
  if (!lastSeenId) return [list[0]];
  const index = list.findIndex((u) => u.id === lastSeenId);
  // Onbekend id (bijv. verwijderde update): alleen de nieuwste.
  if (index === -1) return [list[0]];
  return list.slice(0, Math.min(index, MAX_UPDATES));
}

const dateFormat = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const formatUpdateDate = (date: string) =>
  dateFormat.format(new Date(`${date}T12:00:00`));
