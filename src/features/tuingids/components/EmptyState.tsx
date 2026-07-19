interface EmptyStateProps {
  emoji: string;
  title: string;
  description?: string;
}

export function EmptyState({ emoji, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-4xl mb-3">{emoji}</span>
      <p className="font-serif text-lg font-semibold">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>}
    </div>
  );
}
