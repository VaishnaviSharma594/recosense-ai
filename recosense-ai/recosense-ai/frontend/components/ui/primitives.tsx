"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { Dialog as D, DropdownMenu as DM, Slider as S, Switch as Sw, Tabs as T } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/* ---------------- Card ---------------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-surface shadow-soft", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold", className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

/* ---------------- Badge ---------------- */
const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", {
  variants: {
    variant: {
      default: "bg-primary/10 text-primary",
      secondary: "bg-secondary/10 text-secondary",
      success: "bg-success/12 text-emerald-700 dark:text-emerald-400",
      warning: "bg-warning/15 text-amber-700 dark:text-amber-400",
      danger: "bg-danger/12 text-red-700 dark:text-red-400",
      muted: "bg-surface-2 text-muted",
      outline: "border border-border text-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});
export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn(
      "animate-shimmer rounded-xl bg-[linear-gradient(90deg,var(--surface-2)_0%,var(--border)_50%,var(--surface-2)_100%)] bg-[length:800px_100%]",
      className)} />
  );
}

/* ---------------- Progress ---------------- */
export function Progress({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar"
      aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full bg-primary transition-all duration-500", barClassName)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ---------------- Dialog ---------------- */
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;
export function DialogContent({ className, children, title, description }: {
  className?: string; children: React.ReactNode; title: string; description?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm data-[state=open]:animate-fade-up" />
      <D.Content className={cn(
        "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-lift focus:outline-none",
        className)}>
        <div className="mb-4 pr-8">
          <D.Title className="text-lg font-semibold">{title}</D.Title>
          {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>
            : <D.Description className="sr-only">{title}</D.Description>}
        </div>
        {children}
        <D.Close className="absolute right-4 top-4 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

/* ---------------- Dropdown ---------------- */
export const Dropdown = DM.Root;
export const DropdownTrigger = DM.Trigger;
export function DropdownContent({ className, children, align = "end" }: { className?: string; children: React.ReactNode; align?: "start" | "end" | "center" }) {
  return (
    <DM.Portal>
      <DM.Content align={align} sideOffset={8} className={cn(
        "z-50 min-w-52 rounded-xl border border-border bg-surface p-1.5 shadow-lift data-[state=open]:animate-fade-up", className)}>
        {children}
      </DM.Content>
    </DM.Portal>
  );
}
export function DropdownItem({ className, ...props }: React.ComponentProps<typeof DM.Item>) {
  return <DM.Item className={cn(
    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted", className)} {...props} />;
}
export const DropdownSeparator = () => <DM.Separator className="my-1 h-px bg-border" />;
export const DropdownLabel = ({ children }: { children: React.ReactNode }) => (
  <DM.Label className="px-2.5 py-1.5 text-xs text-muted">{children}</DM.Label>
);

/* ---------------- Tabs ---------------- */
export const Tabs = T.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("inline-flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return <T.Trigger className={cn(
    "cursor-pointer rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted transition data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-soft", className)} {...props} />;
}
export const TabsContent = ({ className, ...props }: React.ComponentProps<typeof T.Content>) => (
  <T.Content className={cn("mt-5 focus:outline-none", className)} {...props} />
);

/* ---------------- Slider ---------------- */
export function Slider({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  const count = (props.value ?? props.defaultValue ?? [0]).length;
  return (
    <S.Root className={cn("relative flex h-5 w-full touch-none select-none items-center", className)} {...props}>
      <S.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-2">
        <S.Range className="absolute h-full bg-brand-gradient" />
      </S.Track>
      {Array.from({ length: count }).map((_, i) => (
        <S.Thumb key={i} aria-label={count > 1 ? (i === 0 ? "Minimum" : "Maximum") : "Value"}
          className="block size-4 cursor-grab rounded-full border-2 border-primary bg-white shadow-soft focus:outline-none focus:ring-4 focus:ring-primary/20" />
      ))}
    </S.Root>
  );
}

/* ---------------- Switch ---------------- */
export function Switch(props: React.ComponentProps<typeof Sw.Root>) {
  return (
    <Sw.Root className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-border transition data-[state=checked]:bg-primary" {...props}>
      <Sw.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[22px]" />
    </Sw.Root>
  );
}
