import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Components } from "@/types";

export function ReasonList({ reasons, className }: { reasons: string[]; className?: string }) {
  return (
    <ul className={cn("mt-2 space-y-1 rounded-xl bg-primary/5 p-2.5", className)} aria-label="Why this was recommended">
      {reasons.slice(0, 2).map((r) => (
        <li key={r} className="flex gap-1.5 text-[11px] leading-snug text-foreground/80">
          <Sparkles className="mt-0.5 size-3 shrink-0 text-primary" /> {r}
        </li>
      ))}
    </ul>
  );
}

const COMPONENT_LABELS: Record<keyof Components, string> = {
  content: "Content similarity", collaborative: "Collaborative", sentiment: "Sentiment", rating: "Rating",
};
const COMPONENT_COLORS: Record<keyof Components, string> = {
  content: "bg-primary", collaborative: "bg-secondary", sentiment: "bg-success", rating: "bg-warning",
};

export function ScoreBreakdown({ components, score }: { components: Components; score: number }) {
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold"><span>Hybrid score</span><span>{(score * 100).toFixed(0)}/100</span></div>
      {(Object.keys(COMPONENT_LABELS) as (keyof Components)[]).map((k) => (
        <div key={k} className="grid grid-cols-[1fr_auto] items-center gap-2 text-[10px] text-muted">
          <div>
            <div className="flex justify-between"><span>{COMPONENT_LABELS[k]}</span><span>{(components[k] * 100).toFixed(0)}</span></div>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-surface-2">
              <div className={cn("h-full rounded-full", COMPONENT_COLORS[k])} style={{ width: `${components[k] * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
