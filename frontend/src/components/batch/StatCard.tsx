import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: "default" | "success" | "error" | "accent";
}

const variantStyles = {
  default: "text-foreground",
  success: "text-success",
  error: "text-destructive",
  accent: "text-primary",
};

export function StatCard({ label, value, icon: Icon, variant = "default" }: StatCardProps) {
  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg bg-secondary ${variantStyles[variant]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-semibold font-mono-data ${variantStyles[variant]}`}>{value}</p>
      </div>
    </div>
  );
}
