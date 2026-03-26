import { Download } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { BatchDocument } from "@/lib/batch-data";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DocumentTableProps {
  documents: BatchDocument[];
  onDownload: (documentId: string) => void;
}

export function DocumentTable({ documents, onDownload }: DocumentTableProps) {
  const handleDownload = (docId: string) => {
    onDownload(docId);
    toast.success("Téléchargement lancé");
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-auto max-h-[480px] scrollbar-thin">
        <table className="w-full">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left p-3 font-medium">ID</th>
              <th className="text-left p-3 font-medium">Statut</th>
              <th className="text-right p-3 font-medium">Tentatives</th>
              <th className="text-right p-3 font-medium">Temps (ms)</th>
              <th className="text-right p-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.id}
                className="border-b border-border/50 hover:bg-secondary/50 transition-colors duration-150"
              >
                <td className="p-3 font-mono-data">{doc.id}</td>
                <td className="p-3">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="p-3 text-right font-mono-data">{doc.retries}</td>
                <td className="p-3 text-right font-mono-data">
                  {doc.timeMs > 0 ? doc.timeMs : "—"}
                </td>
                <td className="p-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                    onClick={() => handleDownload(doc.id)}
                    disabled={doc.status !== "completed"}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
