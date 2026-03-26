interface BatchProgressBarProps {
  completed: number;
  errors: number;
  total: number;
}

export function BatchProgressBar({ completed, errors, total }: BatchProgressBarProps) {
  const successPct = (completed / total) * 100;
  const errorPct = (errors / total) * 100;
  const totalPct = successPct + errorPct;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground font-mono-data">
        <span>{Math.round(totalPct)}% traité</span>
        <span>{completed + errors} / {total}</span>
      </div>
      <div className="h-3 rounded-full bg-secondary overflow-hidden">
        <div className="h-full flex transition-all duration-700 ease-out">
          <div
            className="bg-success transition-all duration-700"
            style={{ width: `${successPct}%` }}
          />
          <div
            className="bg-destructive transition-all duration-700"
            style={{ width: `${errorPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
