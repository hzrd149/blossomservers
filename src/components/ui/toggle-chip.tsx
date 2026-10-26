import { cn } from "@/lib/utils";

/** A pill shaped toggle used for filters */
export function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
