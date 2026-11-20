"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, RefreshCw, RotateCcw, Save, Search, Users, Wand2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { StatCard } from "@/components/admin/stat-card";
import { ProductImage } from "@/components/products/product-bits";
import { ScoreBreakdown } from "@/components/recommendations/reason-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Slider } from "@/components/ui/primitives";
import { ErrorState, PageHeader, Spinner } from "@/components/ui/states";
import { errorMessage, formatDate } from "@/lib/utils";
import { adminService, type Weights } from "@/services/admin";


const LABELS: Record<keyof Weights, string> = { content: "Content similarity", collaborative: "Collaborative filtering", sentiment: "Sentiment score", rating: "Rating score" };
const DEFAULTS: Weights = { content: 0.35, collaborative: 0.3, sentiment: 0.25, rating: 0.1 };

function WeightsCard({ initial }: { initial: Weights }) {
  const qc = useQueryClient();
  const [w, setW] = React.useState<Weights>(initial);
  const total = Object.values(w).reduce((s, v) => s + v, 0) || 1;
  const save = useMutation({
    mutationFn: () => adminService.saveWeights(w),
    onSuccess: () => { toast.success("Weights saved (normalised to sum to 1)"); qc.invalidateQueries({ queryKey: ["admin", "recs"] }); qc.invalidateQueries({ queryKey: ["recommendations"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
        <Card>
          <CardHeader><CardTitle>Hybrid weights</CardTitle><CardDescription>Hybrid = Σ weight × normalised component (0–1).</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            {(Object.keys(LABELS) as (keyof Weights)[]).map((k) => (
              <div key={k}>
                <div className="mb-2 flex justify-between text-sm"><span className="font-medium">{LABELS[k]}</span><span className="tabular-nums text-muted">{w[k].toFixed(2)} → {((w[k] / total) * 100).toFixed(0)}%</span></div>
                <Slider min={0} max={1} step={0.05} value={[w[k]]} onValueChange={(v) => setW({ ...w, [k]: v[0] })} aria-label={LABELS[k]} />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="gradient" className="flex-1" loading={save.isPending} disabled={total === 0} onClick={() => save.mutate()}><Save /> Save</Button>
              <Button variant="outline" onClick={() => setW(DEFAULTS)}><RotateCcw /> Default</Button>
            </div>
            <p className="text-xs text-muted">Weights affect live recommendations immediately. Re-run evaluation on the Model performance page to measure the impact.</p>
          </CardContent>
        </Card>
  );
}

function Inner() {
  const qc = useQueryClient();
  const initialUser = Number(useSearchParams().get("user")) || undefined;
  const [userId, setUserId] = React.useState<number | undefined>(initialUser);
  const [userInput, setUserInput] = React.useState(initialUser ? String(initialUser) : "");
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["admin", "recs", userId], queryFn: () => adminService.recOverview(userId) });
  const rebuild = useMutation({ mutationFn: adminService.rebuild, onSuccess: (r) => { toast.success(r.message); qc.invalidateQueries({ queryKey: ["admin", "recs"] }); }, onError: (e) => toast.error(errorMessage(e)) });

  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Recommendation engine" description="Tune the hybrid weights, rebuild models with the latest interactions and inspect any user's recommendations."
        actions={<Button variant="outline" loading={rebuild.isPending} onClick={() => rebuild.mutate()}><RefreshCw /> Rebuild models</Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={isLoading} label="Recommendations stored" value={data?.total_generated.toLocaleString()} hint="Rolling 30-day history" icon={Wand2} />
        <StatCard loading={isLoading} label="Users served" value={data?.users_served} icon={Users} tone="secondary" />
        <StatCard loading={isLoading} label="Products in model" value={data?.engine.products} icon={Boxes} tone="success" />
        <StatCard loading={isLoading} label="Users in matrix" value={data?.engine.users} hint={data?.engine.built_at ? `Built ${formatDate(data.engine.built_at, { hour: "2-digit", minute: "2-digit" })}` : "Not built yet"} icon={RefreshCw} tone="warning" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        {data ? <WeightsCard key={JSON.stringify(data.weights)} initial={data.weights} /> : <Card className="p-6"><Spinner /></Card>}
        <Card>
          <CardHeader><CardTitle>Inspect a user</CardTitle><CardDescription>Preview hybrid recommendations with component scores and explanations.</CardDescription></CardHeader>
          <CardContent>
            <form className="mb-5 flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); setUserId(Number(userInput) || undefined); }}>
              <Input type="number" min={1} placeholder="User ID (e.g. 2)" value={userInput} onChange={(e) => setUserInput(e.target.value)} aria-label="User ID" />
              <Button type="submit" variant="outline"><Search /> Preview</Button>
            </form>
            {isLoading ? <Spinner /> : !data?.preview ? <p className="text-sm text-muted">Enter a user ID (see the Users page) to preview their recommendations.</p> : (
              <>
                <p className="mb-3 text-sm">For <span className="font-semibold">{data.preview.user.full_name}</span> <span className="text-muted">({data.preview.user.email})</span>
                  {data.preview.items[0] && <Badge variant={data.preview.items[0].algorithm === "cold_start" ? "warning" : "default"} className="ml-2">{data.preview.items[0].algorithm.replace("_", " ")}</Badge>}</p>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {data.preview.items.map((i) => (
                    <li key={i.product.id} className="flex gap-3 rounded-xl border border-border p-3">
                      <ProductImage src={i.product.image_url} alt="" className="h-24 w-20 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{i.product.name}</p>
                        <p className="text-[11px] text-muted">{i.reasons.join(" · ")}</p><ScoreBreakdown components={i.components} score={i.score} /></div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function AdminRecommendationsPage() {
  return <React.Suspense fallback={<Spinner />}><Inner /></React.Suspense>;
}
