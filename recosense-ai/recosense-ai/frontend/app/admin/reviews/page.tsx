"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { RatingStars } from "@/components/products/product-bits";
import { SentimentBadge } from "@/components/sentiment/sentiment-widgets";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/form";
import { Badge, Card } from "@/components/ui/primitives";
import { EmptyState, ErrorState, PageHeader, Spinner } from "@/components/ui/states";
import { useDebounce } from "@/hooks/use-debounce";
import { cn, errorMessage, formatDate } from "@/lib/utils";
import { adminService } from "@/services/admin";

export default function AdminReviewsPage() {
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  const [sentiment, setSentiment] = React.useState("");
  const [source, setSource] = React.useState("");
  const [page, setPage] = React.useState(1);
  const dq = useDebounce(q, 300);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "reviews", dq, sentiment, source, page],
    queryFn: () => adminService.reviews({ q: dq || undefined, sentiment: sentiment || undefined, source: source || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const after = (msg: string) => { toast.success(msg); qc.invalidateQueries({ queryKey: ["admin"] }); };
  const moderate = useMutation({ mutationFn: (v: { id: number; hidden: boolean }) => adminService.moderateReview(v.id, v.hidden), onSuccess: (_, v) => after(v.hidden ? "Review hidden" : "Review restored"), onError: (e) => toast.error(errorMessage(e)) });
  const del = useMutation({ mutationFn: adminService.deleteReview, onSuccess: () => after("Review deleted"), onError: (e) => toast.error(errorMessage(e)) });

  return (
    <>
      <PageHeader eyebrow="Admin" title="Reviews" description="Moderate reviews. Hiding or deleting a review immediately recomputes the product's rating and sentiment." />
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input className="pl-9" placeholder="Search review text…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search reviews" /></div>
          <NativeSelect className="w-40" aria-label="Sentiment" value={sentiment} onChange={(e) => { setSentiment(e.target.value); setPage(1); }}>
            <option value="">All sentiment</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option><option value="mixed">Mixed</option>
          </NativeSelect>
          <NativeSelect className="w-40" aria-label="Source" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
            <option value="">All sources</option><option value="dataset">Dataset</option><option value="customer">Customer</option><option value="upload">CSV upload</option>
          </NativeSelect>
        </div>
        {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading ? <Spinner />
          : data!.items.length === 0 ? <EmptyState title="No reviews match" />
            : (
              <ul className="divide-y divide-border">
                {data!.items.map((r) => (
                  <li key={r.id} className={cn("flex flex-col gap-3 py-4 sm:flex-row", r.is_hidden && "opacity-50")}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <RatingStars rating={r.rating} />
                        {r.sentiment && <SentimentBadge label={r.sentiment.label} mixed={r.sentiment.is_mixed} />}
                        <Badge variant="muted">{r.source}</Badge>
                        {r.is_hidden && <Badge variant="danger">Hidden</Badge>}
                        <span className="text-xs text-muted">{formatDate(r.created_at)} · conf. {r.sentiment ? (r.sentiment.confidence * 100).toFixed(0) : "—"}%</span>
                      </div>
                      <Link href={`/products/${r.product_id}`} className="mt-1 block text-xs font-medium text-primary hover:underline">{r.product_name}</Link>
                      {r.title && <p className="mt-1 text-sm font-semibold">{r.title}</p>}
                      <p className="mt-0.5 line-clamp-3 text-sm text-foreground/80">{r.body}</p>
                      {r.aspects.length > 0 && <p className="mt-1.5 text-xs text-muted">Aspects: {r.aspects.map((a) => `${a.aspect} (${a.sentiment})`).join(" · ")}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1 sm:flex-col">
                      <Button size="sm" variant="outline" onClick={() => moderate.mutate({ id: r.id, hidden: !r.is_hidden })}>{r.is_hidden ? <><Eye /> Restore</> : <><EyeOff /> Hide</>}</Button>
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => { if (confirm("Delete this review permanently?")) del.mutate(r.id); }}><Trash2 /> Delete</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        {data && data.pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">{data.total.toLocaleString()} reviews</span>
            <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span>Page {data.page} / {data.pages}</span><Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
          </div>
        )}
      </Card>
    </>
  );
}
