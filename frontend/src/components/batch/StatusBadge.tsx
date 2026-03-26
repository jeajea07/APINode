import type { BatchStatus, DocStatus } from "@/lib/batch-data";

type Status = BatchStatus | DocStatus;

const config: Record<Status, { label: string; classes: string }> = {
  pending: { label: "En attente", classes: "bg-muted text-muted-foreground" },
  processing: { label: "En cours", classes: "bg-primary/20 text-primary pulse-blue" },
  completed: { label: "Terminé", classes: "bg-success/20 text-success" },
  failed: { label: "Erreur", classes: "bg-destructive/20 text-destructive" },
};

export function StatusBadge({ status }: { status: Status }) {
  const { label, classes } = config[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${classes} transition-all duration-300 animate-status-change`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {label}
    </span>
  );
}
