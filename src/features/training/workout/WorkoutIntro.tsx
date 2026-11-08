import { Sheet } from "@/features/training/components/ui";

// Eenmalige uitleg bij de eerste training: de app slaat op wat je echt
// deed, en de trainer rekent daarmee. Als venster, zodat de setknop
// bovenaan blijft. Weg na "Begrepen" (instelling workoutIntroSeen,
// synchroniseert mee).
export function WorkoutIntro({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Zo werkt een training"
      footer={
        <button
          type="button"
          className="tr-btn tr-btn-primary"
          onClick={onClose}
        >
          Begrepen
        </button>
      }
    >
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Op de <strong>grote knop</strong> staat wat je bij deze set moet doen,
          bijvoorbeeld <span className="tr-num">40 kg × 10</span>.
        </li>
        <li>
          Klaar met je set? <strong>Tik op de knop.</strong> De set wordt
          opgeslagen en je rust begint.
        </li>
        <li>
          Minder of meer gedaan? Tik tijdens de rust op het{" "}
          <strong>aantal herhalingen dat je echt deed</strong>. Ander gewicht?
          Kies "Anders…".
        </li>
      </ol>
      <p className="tr-ink-2 text-sm">
        Waarom? De volgende keer staat per set klaar wat je echt deed. De
        trainer gebruikt het om te zien wanneer je zwaarder kunt: pas als je het
        maximum aan herhalingen op alle sets haalt.
      </p>
    </Sheet>
  );
}
