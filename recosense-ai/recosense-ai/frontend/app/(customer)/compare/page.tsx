"use client";

import { useQuery } from "@tanstack/react-query";
import { Columns3, Plus, ThumbsDown, ThumbsUp, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Price, ProductImage, RatingStars } from "@/components/products/product-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Badge, Card } from "@/components/ui/primitives";
import { EmptyState, ErrorState, PageHeader, Spinner } from "@/components/ui/states";
import { MAX_COMPARE, useCompare } from "@/hooks/use-compare";
import { useDebounce } from "@/hooks/use-debounce";
import { cn, errorMessage, formatPrice } from "@/lib/utils";
import { compareService, productService } from "@/services";

function AddProduct({ onAdd, exclude }: { onAdd: (id: number) => void; exclude: number[] }) {
  const [q, setQ] = React.useState("");
  const d = useDebounce(q, 250);
  const { data } = useQuery({ queryKey: ["compare-search", d], queryFn: () => productService.list({ q: d, page_size: 6 }), enabled: d.length >= 2 });
  return (
    <div className="relative">
      <Input placeholder="Search a product to add…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search product to compare" />
      {d.length >= 2 && data && (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lift">
          {data.items.filter((p) => !exclude.includes(p.id)).map((p) => (
            <li key={p.id}>
              <button className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2" onClick={() => { onAdd(p.id); setQ(""); }}>
                <ProductImage src={p.image_url} alt="" className="size-10 rounded-lg" />
                <span className="flex-1 truncate">{p.name}</span><span className="text-xs text-muted">{formatPrice(p.final_price)}</span>
              </button>
            </li>
          ))}
          {data.items.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matches</li>}
        </ul>
      )}
    </div>
  );
}

function CompareInner() {
  const compare = useCompare();
  const params = useSearchParams();
  const router = useRouter();
  React.useEffect(() => {
    const fromUrl = params.get("ids")?.split(",").map(Number).filter(Number.isInteger);
    if (fromUrl?.length) { compare.set(fromUrl); router.replace("/compare"); }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const ids = compare.ids;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["compare", ids], queryFn: () => compareService.compare(ids), enabled: ids.length >= 2,
  });
  const winners = new Map<string, number>(data?.best_for.map((b) => [b.attribute, b.product_id]) ?? []);
  const isBest = (attr: string, id: number) => winners.get(attr) === id;

  const rows: { label: string; attr?: string; render: (r: NonNullable<typeof data>["products"][number]) => React.ReactNode }[] = [
    { label: "Brand", render: (r) => r.product.brand },
    { label: "Price", attr: "Lowest price", render: (r) => <Price price={r.product.price} finalPrice={r.product.final_price} discount={r.product.discount_percent} /> },
    { label: "Discount", attr: "Biggest discount", render: (r) => (r.product.discount_percent ? `${r.product.discount_percent}%` : "—") },
    { label: "Rating", attr: "Highest rating", render: (r) => <RatingStars rating={r.product.rating_avg} count={r.product.review_count} /> },
    { label: "Reviews", render: (r) => r.product.review_count },
    { label: "Positive sentiment", attr: "Most positive reviews", render: (r) => (r.product.review_count ? `${r.product.positive_pct.toFixed(0)}%` : "—") },
    { label: "Negative sentiment", render: (r) => (r.product.review_count ? `${r.product.negative_pct.toFixed(0)}%` : "—") },
    ...(["fabric_quality", "comfort", "fit"] as const).map((k) => ({
      label: { fabric_quality: "Fabric quality sentiment", comfort: "Comfort sentiment", fit: "Fitting sentiment" }[k],
      attr: { fabric_quality: "Best fabric quality", comfort: "Best comfort", fit: "Best fit & sizing" }[k],
      render: (r: NonNullable<typeof data>["products"][number]) => {
        const a = r.aspects[k];
        return a.positive_pct === null ? <span className="text-xs text-muted">Not enough data ({a.mentions})</span>
          : <span>{a.positive_pct.toFixed(0)}% <span className="text-xs text-muted">positive · {a.mentions} mentions</span></span>;
      },
    })),
    { label: "AI pros", render: (r) => r.pros.length ? <ul className="space-y-1">{r.pros.map((x) => <li key={x} className="flex gap-1.5 text-xs"><ThumbsUp className="mt-0.5 size-3 shrink-0 text-success" />{x}</li>)}</ul> : <span className="text-xs text-muted">—</span> },
    { label: "AI cons", render: (r) => r.cons.length ? <ul className="space-y-1">{r.cons.map((x) => <li key={x} className="flex gap-1.5 text-xs"><ThumbsDown className="mt-0.5 size-3 shrink-0 text-danger" />{x}</li>)}</ul> : <span className="text-xs text-muted">—</span> },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader eyebrow="Side-by-side" title="Compare products" description={`Compare 2–${MAX_COMPARE} products on price, ratings and aspect-level review sentiment.`}
        actions={ids.length > 0 && <Button variant="outline" onClick={compare.clear}><X /> Clear all</Button>} />
      {ids.length < MAX_COMPARE && <div className="mb-6 max-w-md"><AddProduct onAdd={compare.toggle} exclude={ids} /></div>}
      {ids.length < 2 ? (
        <EmptyState icon={Columns3} title={ids.length ? "Add one more product" : "Nothing to compare yet"}
          description="Use the compare button on any product card, or search above." action={{ label: "Browse products", href: "/products" }} />
      ) : isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        : isLoading || !data ? <Spinner label="Comparing" /> : (
          <>
            {data.overall && (
              <Card className="mb-6 flex items-center gap-3 border-primary/30 bg-primary/5 p-4">
                <Trophy className="size-6 shrink-0 text-primary" />
                <div><p className="font-semibold">{data.overall.text}</p><p className="text-xs text-muted">Computed from catalogue data and stored review-sentiment predictions.</p></div>
              </Card>
            )}
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr>
                    <th className="w-44 p-4" />
                    {data.products.map((r) => (
                      <th key={r.product.id} className="p-4 align-top font-normal">
                        <div className="relative text-left">
                          <button onClick={() => compare.toggle(r.product.id)} aria-label={`Remove ${r.product.name}`}
                            className="absolute right-0 top-0 z-10 grid size-7 cursor-pointer place-items-center rounded-full bg-surface shadow-soft hover:bg-surface-2"><X className="size-3.5" /></button>
                          <Link href={`/products/${r.product.id}`}>
                            <ProductImage src={r.product.image_url} alt={r.product.name} className="aspect-[4/5] w-full rounded-xl" />
                            <p className="mt-2 line-clamp-2 font-semibold hover:text-primary">{r.product.name}</p>
                          </Link>
                          {data.overall?.product_id === r.product.id && <Badge className="mt-1"><Trophy className="size-3" /> Overall leader</Badge>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-t border-border">
                      <th scope="row" className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-muted">{row.label}</th>
                      {data.products.map((r) => (
                        <td key={r.product.id} className={cn("p-4 align-top", row.attr && isBest(row.attr, r.product.id) && "bg-success/8")}>
                          <div className="flex items-start gap-1.5">{row.render(r)}{row.attr && isBest(row.attr, r.product.id) && <Trophy className="size-3.5 shrink-0 text-success" aria-label="Best" />}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2 className="mt-10 text-lg font-semibold">Comparison summary</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.best_for.map((b) => {
                const prod = data.products.find((r) => r.product.id === b.product_id)!.product;
                return (
                  <div key={b.attribute} className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{b.attribute}</p>
                    <p className="mt-1 font-semibold">{prod.name}</p>
                    <p className="text-sm text-success">{b.value}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-muted">{data.note}</p>
          </>
        )}
      {ids.length >= 2 && ids.length < MAX_COMPARE && <p className="mt-4 flex items-center gap-1 text-xs text-muted"><Plus className="size-3" />You can add {MAX_COMPARE - ids.length} more.</p>}
    </div>
  );
}

export default function ComparePage() {
  return <React.Suspense><CompareInner /></React.Suspense>;
}
