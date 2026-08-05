import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import { fetchCocktailIngredients } from "@/features/cocktail-bar/lib/reference";
import type {
  IngredientRowDraft,
  VariantDraft,
} from "@/features/cocktail-bar/components/CocktailWizard";

function IngredientRow({
  row,
  onUpdate,
  onRemove,
}: {
  row: IngredientRowDraft;
  onUpdate: (patch: Partial<IngredientRowDraft>) => void;
  onRemove: () => void;
}) {
  // Slepen i.p.v. een handmatig volgordegetal — de opslagvolgorde (sort_order)
  // wordt bij opslaan gewoon afgeleid uit de array-volgorde, zie
  // resolveIngredients() in CocktailWizard.tsx.
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--cb-border)] p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cb-muted flex touch-none items-center justify-center rounded-md p-1"
        aria-label={`${row.name || "Ingrediënt"} verslepen om te herordenen`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <input
        value={row.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        list="cocktail-ingredient-suggestions"
        placeholder="Ingrediënt"
        className="min-w-[8rem] flex-1 rounded-md px-2 py-1.5 text-sm"
      />
      <input
        value={row.amount}
        onChange={(e) => onUpdate({ amount: e.target.value })}
        placeholder="50"
        inputMode="decimal"
        className="w-16 rounded-md px-2 py-1.5 text-sm"
      />
      <input
        value={row.unit}
        onChange={(e) => onUpdate({ unit: e.target.value })}
        placeholder="ml"
        className="w-16 rounded-md px-2 py-1.5 text-sm"
      />
      <input
        value={row.note}
        onChange={(e) => onUpdate({ note: e.target.value })}
        placeholder="notitie (optioneel)"
        className="min-w-[6rem] flex-1 rounded-md px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Ingrediënt verwijderen"
        className="cb-button-ghost rounded-full p-1.5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Gedeeld tussen stap 4 (alcoholische variant) en stap 7 (alcoholvrije
// variant). Ingrediëntnaam is vrije tekst met een <datalist>-suggestielijst
// uit de bestaande catalogus — bestaat de naam nog niet, dan maakt
// createIngredient() 'm pas aan bij het opslaan (zie CocktailWizard.tsx),
// niet hier al.
export function WizardStepIngredients({
  variant,
  onChange,
}: {
  variant: VariantDraft;
  onChange: (v: VariantDraft) => void;
}) {
  const { data: ingredients = [] } = useQuery({
    queryKey: ["cocktail_bar", "ingredients"],
    queryFn: fetchCocktailIngredients,
  });

  // 5px drempel voorkomt dat een gewone tik op een invoerveld al als
  // sleep-actie wordt opgevat — belangrijk op de tablet-wizard.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function updateRow(id: string, patch: Partial<IngredientRowDraft>) {
    onChange({
      ...variant,
      ingredients: variant.ingredients.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      ),
    });
  }

  function addRow() {
    onChange({
      ...variant,
      ingredients: [
        ...variant.ingredients,
        { id: crypto.randomUUID(), name: "", amount: "", unit: "", note: "" },
      ],
    });
  }

  function removeRow(id: string) {
    onChange({
      ...variant,
      ingredients: variant.ingredients.filter((row) => row.id !== id),
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = variant.ingredients.findIndex(
      (row) => row.id === active.id,
    );
    const newIndex = variant.ingredients.findIndex((row) => row.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange({
      ...variant,
      ingredients: arrayMove(variant.ingredients, oldIndex, newIndex),
    });
  }

  return (
    <div className="space-y-4">
      <p className="cb-muted text-xs uppercase tracking-wide">Ingrediënten</p>

      <datalist id="cocktail-ingredient-suggestions">
        {ingredients.map((i) => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={variant.ingredients.map((row) => row.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {variant.ingredients.map((row) => (
              <IngredientRow
                key={row.id}
                row={row}
                onUpdate={(patch) => updateRow(row.id, patch)}
                onRemove={() => removeRow(row.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addRow}
        className="cb-button-ghost flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
      >
        <Plus className="h-3.5 w-3.5" /> Ingrediënt toevoegen
      </button>
    </div>
  );
}
