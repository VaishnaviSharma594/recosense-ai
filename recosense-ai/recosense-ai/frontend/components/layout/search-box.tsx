"use client";

import { useQuery } from "@tanstack/react-query";
import { Folder, Search, ShoppingBag, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { productService } from "@/services";

const ICONS = { product: ShoppingBag, category: Folder, brand: Tag };

export function SearchBox({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const debounced = useDebounce(q.trim(), 200);
  const { data = [], isFetching } = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: () => productService.suggest(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });
  const listId = React.useId();

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    onNavigate?.();
    router.push(href);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && data[active]) return go(data[active].href);
    if (q.trim()) go(`/products?q=${encodeURIComponent(q.trim())}&sort=relevance`);
  };

  return (
    <form onSubmit={submit} className={cn("relative", className)} role="search">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, data.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search dresses, brands, fabrics…"
        aria-label="Search products"
        role="combobox"
        aria-expanded={open && data.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        className="h-10 w-full rounded-xl border border-border bg-surface-2/70 pl-10 pr-3 text-sm outline-none transition placeholder:text-muted focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
      />
      {open && debounced.length >= 2 && (
        <div id={listId} role="listbox"
          className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lift animate-fade-up">
          {data.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted">{isFetching ? "Searching…" : `No matches for “${debounced}”. Press Enter to search.`}</p>
          ) : data.map((s, i) => {
            const Icon = ICONS[s.type];
            return (
              <button type="button" key={`${s.type}-${s.label}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()} onClick={() => go(s.href)}
                className={cn("flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2",
                  i === active && "bg-surface-2")}>
                <Icon className="size-4 text-muted" />
                <span className="flex-1 truncate">{s.label}</span>
                <span className="text-xs capitalize text-muted">{s.type}</span>
              </button>
            );
          })}
        </div>
      )}
    </form>
  );
}
