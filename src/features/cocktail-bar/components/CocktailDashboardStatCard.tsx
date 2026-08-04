export function CocktailDashboardStatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="cb-tile p-4">
      <p className="cb-muted text-xs uppercase tracking-wide">{label}</p>
      <p className="cb-heading font-serif text-3xl">{value}</p>
    </div>
  );
}
