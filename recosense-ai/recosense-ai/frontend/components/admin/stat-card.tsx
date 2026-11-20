import type { LucideIcon } from "lucide-react";

import { Card, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, hint, icon: Icon, tone = "primary", loading }: {
  label: string; value: React.ReactNode; hint?: string; icon: LucideIcon; tone?: "primary" | "secondary" | "success" | "warning" | "danger"; loading?: boolean;
}) {
  const tones = { primary: "bg-primary/10 text-primary", secondary: "bg-secondary/10 text-secondary", success: "bg-success/12 text-success", warning: "bg-warning/15 text-warning", danger: "bg-danger/10 text-danger" };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className={cn("grid size-9 place-items-center rounded-xl", tones[tone])}><Icon className="size-4" /></span>
      </div>
      {loading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-1 font-display text-2xl font-bold">{value}</p>}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}
