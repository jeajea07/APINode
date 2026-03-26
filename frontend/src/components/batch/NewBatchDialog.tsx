import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, docCount: number) => void | Promise<void>;
  minCount: number;
  maxCount: number;
  defaultCount: number;
}

export function NewBatchDialog({
  open,
  onOpenChange,
  onConfirm,
  minCount,
  maxCount,
  defaultCount,
}: NewBatchDialogProps) {
  const [name, setName] = useState("Factures_Avril_2026");
  const [docCount, setDocCount] = useState(defaultCount);

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm(name.trim(), docCount);
    setName("Factures_Avril_2026");
    setDocCount(defaultCount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau Batch</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="batch-name">Nom du batch</Label>
            <Input
              id="batch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Factures_Avril_2026"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-count">Nombre de documents</Label>
            <Input
              id="doc-count"
              type="number"
              min={minCount}
              max={maxCount}
              value={docCount}
              onChange={(e) => setDocCount(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-[hsl(187,94%,43%)] hover:bg-[hsl(187,94%,38%)] text-white"
          >
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
