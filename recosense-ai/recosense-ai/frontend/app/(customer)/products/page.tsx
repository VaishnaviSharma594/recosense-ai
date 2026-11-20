"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { ProductGrid } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { Label, NativeSelect } from "@/components/ui/form";
import { Slider } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn, errorMessage, formatPrice } from "@/lib/utils";
import { productService } from "@/services";

const SORTS = [
  ["popularity", "Most popular"], ["relevance", "Relevance"], ["sentiment", "Best sentiment"], ["rating", "Top rated"],
  ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["newest", "Newest"],
];

function PriceFilter({ initial, max, onCommit }: { initial: [number, number]; max: number; onCommit: (v: number[]) => void }) {
  const [price, setPrice] = React.useState<[number, number]>(initial);
  return (
    <div>
      <div className="flex items-center justify-between"><Label>Price</Label><span className="text-xs font-medium text-muted">{formatPrice(price[0])} – {formatPrice(price[1])}</span></div>
      <Slider min={0} max={max} step={100} value={price} onValueChange={(v) => setPrice([v[0], v[1]])} onValueCommit={onCommit} className="mt-3" />
    </div>
  );
}

function Filters({ params, set, onDone }: { params: URLSearchParams; set: (k: Record<string, string | string[] | null>) => void; onDone?: () => void }) {
  const category = params.get("category") ?? undefined;
  const cats = useQuery({ queryKey: ["categories"], queryFn: productService.categories });
  const facets = useQuery({ queryKey: ["facets", category ?? "all"], queryFn: () => productService.facets(category) });
  const brands = params.getAll("brand");
  const maxP = Math.ceil((facets.data?.max_price ?? 5000) / 100) * 100;
  const lo = Number(params.get("min_price") ?? 0), hi = Number(params.get("max_price") ?? maxP);

  return (
    <div className="space-y-7">
      <div>
        <Label>Category</Label>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => set({ category: null, brand: null })} className={cn("chip", !category && "chip-on")}>All</button>
          {cats.data?.map((c) => (
            <button key={c.slug} onClick={() => set({ category: c.slug, brand: null })} className={cn("chip", category === c.slug && "chip-on")}>{c.name}</button>
          ))}
        </div>
      </div>
      <PriceFilter key={`${lo}-${hi}-${maxP}`} initial={[lo, hi]} max={maxP}
        onCommit={(v) => set({ min_price: v[0] > 0 ? String(v[0]) : null, max_price: v[1] < maxP ? String(v[1]) : null })} />
      <div>
        <Label>Brand</Label>
        <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
          {facets.data?.brands.map((b) => (
            <label key={b} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={brands.includes(b)}
                onChange={() => set({ brand: brands.includes(b) ? brands.filter((x) => x !== b) : [...brands, b] })} />
              {b}
            </label>
          ))}
        </div>
      </div>
      <div>
        <Label>Customer rating</Label>
        <div className="flex flex-wrap gap-1.5">
          {[["", "Any"], ["3", "3★ +"], ["4", "4★ +"], ["4.5", "4.5★ +"]].map(([v, l]) => (
            <button key={l} onClick={() => set({ min_rating: v || null })} className={cn("chip", (params.get("min_rating") ?? "") === v && "chip-on")}>{l}</button>
          ))}
        </div>
      </div>
      <div>
        <Label>Positive sentiment</Label>
        <div className="flex flex-wrap gap-1.5">
          {[["", "Any"], ["60", "60%+"], ["75", "75%+"], ["85", "85%+"]].map(([v, l]) => (
            <button key={l} onClick={() => set({ min_sentiment: v || null })} className={cn("chip", (params.get("min_sentiment") ?? "") === v && "chip-on")}>{l}</button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">Share of reviews our model classifies as positive.</p>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={params.get("in_stock") === "true"}
          onChange={(e) => set({ in_stock: e.target.checked ? "true" : null })} /> In stock only
      </label>
      {onDone && <Button className="w-full" onClick={onDone}>Show results</Button>}
    </div>
  );
}

function ProductsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileFilters, setMobileFilters] = React.useState(false);

  const set = React.useCallback((updates: Record<string, string | string[] | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      sp.delete(k);
      if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
      else if (v) sp.set(k, v);
    }
    if (!("page" in updates)) sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  }, [params, router, pathname]);

  const query = {
    q: params.get("q") ?? undefined, category: params.get("category") ?? undefined, brand: params.getAll("brand"),
    min_price: params.get("min_price") ? Number(params.get("min_price")) : undefined,
    max_price: params.get("max_price") ? Number(params.get("max_price")) : undefined,
    min_rating: params.get("min_rating") ? Number(params.get("min_rating")) : undefined,
    min_sentiment: params.get("min_sentiment") ? Number(params.get("min_sentiment")) : undefined,
    in_stock: params.get("in_stock") === "true" || undefined,
    sort: params.get("sort") ?? (params.get("q") ? "relevance" : "popularity"),
    page: Number(params.get("page") ?? 1), page_size: 12,
  };
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["products", query], queryFn: () => productService.list(query), placeholderData: keepPreviousData,
  });
  const cats = useQuery({ queryKey: ["categories"], queryFn: productService.categories });
  const catName = cats.data?.find((c) => c.slug === query.category)?.name;
  const active = ["q", "category", "brand", "min_price", "max_price", "min_rating", "min_sentiment", "in_stock"].filter((k) => params.has(k));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{query.q ? `Results for “${query.q}”` : catName ?? "All products"}</h1>
        <p className="mt-1 text-sm text-muted">{data ? `${data.total} product${data.total === 1 ? "" : "s"}` : "Loading…"} · ranked with real review sentiment</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block"><div className="sticky top-32"><Filters params={params} set={set} /></div></aside>
        <section>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setMobileFilters(true)}><SlidersHorizontal /> Filters</Button>
            {active.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}><X /> Clear filters</Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <label htmlFor="sort" className="text-sm text-muted">Sort</label>
              <NativeSelect id="sort" className="h-9 w-48" value={query.sort} onChange={(e) => set({ sort: e.target.value })}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </NativeSelect>
            </div>
          </div>
          {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
            : !isLoading && data?.items.length === 0 ? (
              <EmptyState title="No products match these filters" description="Try widening the price range or removing a filter."
                action={{ label: "Clear all filters", onClick: () => router.push(pathname) }} />
            ) : (
              <div className={cn("transition-opacity", isFetching && !isLoading && "opacity-60")}>
                <ProductGrid products={data?.items} loading={isLoading} count={12} className="xl:grid-cols-3" />
              </div>
            )}
          {data && data.pages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
              <Button variant="outline" size="icon-sm" disabled={data.page <= 1} onClick={() => set({ page: String(data.page - 1) })} aria-label="Previous page"><ChevronLeft /></Button>
              {Array.from({ length: data.pages }).map((_, i) => (
                <Button key={i} size="icon-sm" variant={data.page === i + 1 ? "default" : "ghost"} aria-current={data.page === i + 1 ? "page" : undefined}
                  onClick={() => set({ page: String(i + 1) })}>{i + 1}</Button>
              ))}
              <Button variant="outline" size="icon-sm" disabled={data.page >= data.pages} onClick={() => set({ page: String(data.page + 1) })} aria-label="Next page"><ChevronRight /></Button>
            </nav>
          )}
        </section>
      </div>
      {mobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setMobileFilters(false)} />
          <div className="absolute inset-y-0 right-0 w-80 max-w-[90%] overflow-y-auto bg-surface p-5 shadow-lift animate-fade-up">
            <div className="mb-5 flex items-center justify-between"><h2 className="font-semibold">Filters</h2>
              <Button variant="ghost" size="icon-sm" aria-label="Close filters" onClick={() => setMobileFilters(false)}><X /></Button></div>
            <Filters params={params} set={set} onDone={() => setMobileFilters(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return <React.Suspense><ProductsInner /></React.Suspense>;
}
