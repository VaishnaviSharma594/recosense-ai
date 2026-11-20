"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, RefreshCw, SlidersHorizontal, Wand2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ProductCard, ProductCardSkeleton } from "@/components/products/product-card";
import { PreferencesDialog } from "@/components/recommendations/preferences-dialog";
import { ReasonList, ScoreBreakdown } from "@/components/recommendations/reason-list";
import { Button } from "@/components/ui/button";
import { Badge, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage, formatDate } from "@/lib/utils";
import { recService } from "@/services";

const ALGOS = [
  { id: "hybrid", label: "Hybrid", text: "Weighted blend: 35% content · 30% collaborative · 25% sentiment · 10% rating (admin-configurable)." },
  { id: "content", label: "Content-based", text: "TF-IDF over name, category, brand, material, colour, tags & price band; cosine similarity to items you interacted with." },
  { id: "collaborative", label: "Collaborative", text: "Item-based KNN on the user–item interaction matrix (views, clicks, wishlist, cart, purchases, ratings)." },
  { id: "sentiment", label: "Sentiment", text: "Ranks by smoothed product sentiment score computed from model predictions on real reviews." },
];

export default function RecommendationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [algo, setAlgo] = React.useState("hybrid");
  const [details, setDetails] = React.useState(false);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["recommendations", user?.id, algo, 16],
    queryFn: () => recService.forUser(user!.id, algo, 16),
    enabled: !!user,
  });
  const refresh = useMutation({
    mutationFn: recService.refresh,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recommendations"] }); toast.success("Models rebuilt with your latest activity"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const current = ALGOS.find((a) => a.id === algo)!;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader eyebrow="Hybrid recommendation engine" title="Recommended for you"
        description="Every product is scored by four signals and comes with an explanation. Switch strategies to see how each approach ranks differently."
        actions={<>
          <PreferencesDialog trigger={<Button variant="outline"><SlidersHorizontal /> Preferences</Button>} />
          <Button variant="gradient" loading={refresh.isPending} onClick={() => refresh.mutate()}><RefreshCw /> Refresh</Button>
        </>} />

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={algo} onValueChange={setAlgo}>
          <TabsList>{ALGOS.map((a) => <TabsTrigger key={a.id} value={a.id}>{a.label}</TabsTrigger>)}</TabsList>
        </Tabs>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={details} onChange={(e) => setDetails(e.target.checked)} />
          Show score breakdown
        </label>
      </div>
      <p className="mb-6 flex gap-2 text-sm text-muted"><Info className="mt-0.5 size-4 shrink-0 text-primary" />{current.text}</p>

      {data?.cold_start && (
        <div className="mb-6 flex flex-col items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p><Badge variant="warning" className="mr-2">Cold start</Badge>We don&apos;t know your taste yet, so these use your preferences, trending items and review sentiment. Browse or save a few products to personalise.</p>
          <PreferencesDialog trigger={<Button size="sm" variant="outline">Set preferences</Button>} />
        </div>
      )}

      {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        : isLoading ? <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}</div>
          : !data?.items.length ? <EmptyState icon={Wand2} title="No recommendations available" description="Everything in stock is already in your purchase history — check back after new arrivals." />
            : (
              <div className={`grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4 ${isFetching ? "opacity-60" : ""}`}>
                {data.items.map((r) => (
                  <ProductCard key={r.product.id} product={r.product}>
                    <ReasonList reasons={r.reasons} />
                    {details && <ScoreBreakdown components={r.components} score={r.score} />}
                  </ProductCard>
                ))}
              </div>
            )}
      {data && <p className="mt-6 text-center text-xs text-muted">Generated {formatDate(data.generated_at, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })} · strategy: {data.algorithm.replace("_", " ")} · component scores are min-max normalised to 0–100 across candidates</p>}
    </div>
  );
}
