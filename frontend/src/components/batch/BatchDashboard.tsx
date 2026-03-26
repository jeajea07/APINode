import { useState, useEffect, useCallback } from "react";
import { FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toBatchView, type Batch } from "@/lib/batch-data";
import { BatchSidebar } from "./BatchSidebar";
import { StatCard } from "./StatCard";
import { BatchProgressBar } from "./BatchProgressBar";
import { StatusBadge } from "./StatusBadge";
import { DocumentTable } from "./DocumentTable";
import { NewBatchDialog } from "./NewBatchDialog";
import { useToast } from "@/hooks/use-toast";
import { createBatch, generateUserIds, getBatch, getDocumentDownloadUrl } from "@/lib/api";
import { BATCH_LIMITS } from "@/lib/batch-limits";

export function BatchDashboard() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const selected = batches.find((b) => b.id === selectedId);
  const emptySelected: Batch = {
    id: "—",
    name: "Aucun batch",
    status: "pending",
    totalItems: 0,
    completedItems: 0,
    errorItems: 0,
    avgTimeMs: 0,
    createdAt: new Date().toISOString(),
    documents: [],
  };
  const current = selected ?? emptySelected;
  const defaultCount = Math.min(Math.max(1000, BATCH_LIMITS.MIN), BATCH_LIMITS.MAX);

  const refreshBatch = useCallback(async (batchId: string) => {
    setLoading(true);
    try {
      const apiBatch = await getBatch(batchId);
      setBatches((prev) => {
        const existing = prev.find((b) => b.id === batchId);
        const name = existing?.name ?? `Batch ${batchId.slice(-6)}`;
        const createdAt = existing?.createdAt ?? new Date().toISOString();
        const updated = toBatchView(name, createdAt, apiBatch);
        if (!existing) return [updated, ...prev];
        return prev.map((b) => (b.id === batchId ? updated : b));
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    if (selected.status !== "pending" && selected.status !== "processing") return;
    const interval = setInterval(() => {
      void refreshBatch(selected.id);
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshBatch, selected]);

  const handleCreateBatch = async (name: string, docCount: number) => {
    if (docCount < BATCH_LIMITS.MIN || docCount > BATCH_LIMITS.MAX) {
      toast({
        title: "Nombre de documents invalide",
        description: `Utilise entre ${BATCH_LIMITS.MIN} et ${BATCH_LIMITS.MAX} documents.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const ids = generateUserIds(docCount);
      const created = await createBatch(ids);
      const newBatch: Batch = {
        id: created.batchId,
        name,
        status: "pending",
        totalItems: docCount,
        completedItems: 0,
        errorItems: 0,
        avgTimeMs: 0,
        createdAt: new Date().toISOString(),
        documents: [],
      };
      setBatches((prev) => [newBatch, ...prev]);
      setSelectedId(newBatch.id);
      setDialogOpen(false);
      toast({
        title: "Batch lancé avec succès",
        description: `${name} — ${docCount} documents en cours de traitement.`,
      });
      await refreshBatch(newBatch.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Impossible de créer le batch";
      toast({
        title: "Erreur API",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDownload = (documentId: string): void => {
    window.open(getDocumentDownloadUrl(documentId), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <BatchSidebar
        batches={batches}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNewBatch={() => setDialogOpen(true)}
      />

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{current.name}</h1>
            <p className="text-sm text-muted-foreground font-mono-data">
              {current.id} · {new Date(current.createdAt).toLocaleDateString("fr-FR")}
              {loading && selected ? " · rafraichissement..." : ""}
            </p>
          </div>
          {selected ? <StatusBadge status={selected.status} /> : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total PDF" value={current.totalItems} icon={FileText} variant="accent" />
          <StatCard label="Succès" value={current.completedItems} icon={CheckCircle2} variant="success" />
          <StatCard label="Échecs" value={current.errorItems} icon={XCircle} variant="error" />
          <StatCard label="Temps moyen" value={`${current.avgTimeMs} ms`} icon={Clock} />
        </div>

        <div className="glass-card p-4">
          <BatchProgressBar
            completed={current.completedItems}
            errors={current.errorItems}
            total={current.totalItems}
          />
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Documents ({current.documents.length})
          </h2>
          <DocumentTable documents={current.documents} onDownload={handleDownload} />
        </div>
      </main>

      <NewBatchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleCreateBatch}
        minCount={BATCH_LIMITS.MIN}
        maxCount={BATCH_LIMITS.MAX}
        defaultCount={defaultCount}
      />
    </div>
  );
}
