import { AlertTriangle, Loader2, type LucideIcon, PackageOpen } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon = PackageOpen, title, description, action, className }: {
  icon?: LucideIcon; title: string; description?: string; action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-14 text-center", className)}>
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-7" /></div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted">{description}</p>}
      {action && (
        <div className="mt-5">
          {action.href ? <Button asChild variant="gradient"><Link href={action.href}>{action.label}</Link></Button>
            : <Button variant="gradient" onClick={action.onClick}>{action.label}</Button>}
        </div>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center rounded-2xl border border-danger/30 bg-danger/5 px-6 py-10 text-center", className)}>
      <AlertTriangle className="mb-3 size-8 text-danger" />
      <p className="font-semibold">We couldn&apos;t load this</p>
      <p className="mt-1 max-w-md text-sm text-muted">{message}</p>
      {onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-10 text-sm text-muted", className)} role="status">
      <Loader2 className="size-5 animate-spin text-primary" /> {label}…
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: {
  title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
