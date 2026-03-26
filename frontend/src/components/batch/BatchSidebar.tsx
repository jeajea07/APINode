import { FileText, Plus } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import type { Batch } from "@/lib/batch-data";

interface BatchSidebarProps {
  batches: Batch[];
  selectedId: string;
  onSelect: (id: string) => void;
  onNewBatch: () => void;
}

export function BatchSidebar({ batches, selectedId, onSelect, onNewBatch }: BatchSidebarProps) {
  return (
    <aside className="w-72 min-h-screen border-r border-border bg-sidebar flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Batches récents
        </h2>
        <Button
          size="sm"
          onClick={onNewBatch}
          className="bg-[hsl(187,94%,43%)] hover:bg-[hsl(187,94%,38%)] text-white h-8 px-3"
        >
          <Plus className="h-4 w-4 mr-1" />
          Nouveau
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {batches.map((batch) => (
          <button
            key={batch.id}
            onClick={() => onSelect(batch.id)}
            className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
              selectedId === batch.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate">{batch.name}</span>
              <StatusBadge status={batch.status} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono-data">
              <span>{batch.id}</span>
              <span>{Math.round(((batch.completedItems + batch.errorItems) / batch.totalItems) * 100)}%</span>
            </div>
          </button>
        ))}
      </nav>
    </aside>
  );
}
