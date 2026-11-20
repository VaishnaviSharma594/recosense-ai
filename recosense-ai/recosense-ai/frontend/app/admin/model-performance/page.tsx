"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Database, FileUp, Loader2, Play, XCircle } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { PALETTE, SimpleBarChart } from "@/components/charts/charts";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { ErrorState, PageHeader, Spinner } from "@/components/ui/states";
import { cn, errorMessage, formatDate, titleCase } from "@/lib/utils";
import { adminService, type Job, type ModelRow } from "@/services/admin";

const pct = (v: number | undefined) => (v === undefined ? "—" : `${(v * 100).toFixed(1)}%`);

function ConfusionMatrix({ matrix, labels }: { matrix: number[][]; labels: string[] }) {
  const max = Math.max(...matrix.flat());
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead><tr><th className="p-1.5 text-left text-muted">actual ↓ / predicted →</th>{labels.map((l) => <th key={l} className="p-1.5 capitalize text-muted">{l}</th>)}</tr></thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={labels[i]}>
              <th className="p-1.5 text-left capitalize text-muted">{labels[i]}</th>
              {row.map((v, j) => (
                <td key={j} className="p-0.5">
                  <div className={cn("grid h-12 w-20 place-items-center rounded-lg font-semibold tabular-nums", i === j ? "text-white" : v / max > 0.4 ? "text-white" : "")}
                    style={{ background: i === j ? `rgba(37,99,235,${0.35 + 0.65 * (v / max)})` : `rgba(239,68,68,${0.08 + 0.7 * (v / max)})` }}>{v}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SentimentModelCard({ m }: { m: ModelRow }) {
  if (m.status === "not_trained") {
    return (
      <Card className="border-dashed p-5">
        <div className="flex items-center gap-2"><Clock className="size-4 text-muted" /><h3 className="font-semibold">{m.model_name}</h3><Badge variant="muted">Pending</Badge></div>
        <p className="mt-2 text-sm text-muted">{m.notes}</p>
      </Card>
    );
  }
  const r = m.metrics;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2"><CardTitle>{m.model_name}</CardTitle>{m.is_active && <Badge variant="success">Production</Badge>}<Badge variant="muted">v{m.model_version}</Badge></div>
        <CardDescription>Trained {m.trained_at && formatDate(m.trained_at, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {m.dataset_size?.toLocaleString()} reviews ({r.train_size?.toLocaleString()} train / {r.test_size?.toLocaleString()} test) · {m.latency_ms} ms/review</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Accuracy", r.accuracy], ["Precision (macro)", r.precision_macro], ["Recall (macro)", r.recall_macro], ["F1 (macro)", r.f1_macro]].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">{k as string}</p><p className="font-display text-xl font-bold">{pct(v as number)}</p></div>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div><h4 className="mb-2 text-sm font-semibold">Confusion matrix</h4><ConfusionMatrix matrix={r.confusion_matrix} labels={r.labels} /></div>
          <div>
            <h4 className="mb-2 text-sm font-semibold">Classification report</h4>
            <table className="w-full text-xs">
              <thead className="text-left text-muted"><tr>{["Class", "Precision", "Recall", "F1", "Support"].map((h) => <th key={h} className="py-1.5">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {[...r.labels, "macro avg", "weighted avg"].map((l: string) => {
                  const row = r.classification_report[l];
                  return <tr key={l}><td className="py-1.5 capitalize">{l}</td><td>{pct(row.precision)}</td><td>{pct(row.recall)}</td><td className="font-semibold">{pct(row["f1-score"])}</td><td>{row.support}</td></tr>;
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-muted">{m.notes}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobStatus({ job }: { job: Job }) {
  const Icon = job.status === "completed" ? CheckCircle2 : job.status === "failed" ? XCircle : Loader2;
  return (
    <div className={cn("flex items-start gap-2 rounded-xl border p-3 text-sm", job.status === "failed" ? "border-danger/30 bg-danger/5" : job.status === "completed" ? "border-success/30 bg-success/5" : "border-primary/30 bg-primary/5")}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", job.status === "running" || job.status === "queued" ? "animate-spin text-primary" : job.status === "failed" ? "text-danger" : "text-success")} />
      <div><p className="font-medium">{titleCase(job.target)} training — {job.status}</p><p className="text-xs text-muted">{job.error ?? job.step}</p></div>
    </div>
  );
}

export default function ModelPerformancePage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["admin", "model-metrics"], queryFn: adminService.modelMetrics });
  const [jobId, setJobId] = React.useState<string | null>(null);
  const job = useQuery({
    queryKey: ["admin", "job", jobId], queryFn: () => adminService.job(jobId!), enabled: !!jobId,
    refetchInterval: (q) => (q.state.data && ["completed", "failed"].includes(q.state.data.status) ? false : 1500),
  });
  React.useEffect(() => {
    if (job.data?.status === "completed") { toast.success("Training finished — metrics updated"); qc.invalidateQueries({ queryKey: ["admin"] }); }
    if (job.data?.status === "failed") toast.error(job.data.error ?? "Training failed");
  }, [job.data?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const train = useMutation({ mutationFn: (t: "sentiment" | "recommendation" | "all") => adminService.train(t), onSuccess: (j) => setJobId(j.id), onError: (e) => toast.error(errorMessage(e)) });
  const fileRef = React.useRef<HTMLInputElement>(null);
  const upload = useMutation({ mutationFn: adminService.upload, onSuccess: () => { toast.success("Dataset imported"); qc.invalidateQueries({ queryKey: ["admin"] }); }, onError: (e) => toast.error(errorMessage(e)) });
  const running = job.data && ["queued", "running"].includes(job.data.status);

  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const rec = data?.recommendation ?? [];
  const recChart = rec.map((m) => ({ name: m.model_name.split(" (")[0], "Precision@10": m.metrics["@10"].precision, "Recall@10": m.metrics["@10"].recall, "NDCG@10": m.metrics["@10"].ndcg }));
  const hybrid = rec.find((m) => m.metrics.strategy === "hybrid");
  const bestNdcg = rec.reduce<ModelRow | null>((b, m) => (!b || m.metrics["@10"].ndcg > b.metrics["@10"].ndcg ? m : b), null);

  return (
    <>
      <PageHeader eyebrow="Admin" title="Model performance" description="Evaluation results stored in the model_metrics table at training time. Nothing here is hard-coded."
        actions={<>
          <Button variant="outline" disabled={!!running} loading={train.isPending && train.variables === "recommendation"} onClick={() => train.mutate("recommendation")}><Play /> Re-evaluate recommender</Button>
          <Button variant="gradient" disabled={!!running} loading={train.isPending && train.variables === "all"} onClick={() => train.mutate("all")}><Play /> Retrain all</Button>
        </>} />
      {job.data && <div className="mb-6"><JobStatus job={job.data} /></div>}
      {isLoading || !data ? <Spinner /> : (
        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-center gap-2"><h2 className="text-lg font-semibold">Sentiment classification</h2><Badge variant={data.sentiment_status === "trained" ? "success" : "warning"}>{data.sentiment_status}</Badge>
              {data.dataset && <span className="flex items-center gap-1 text-xs text-muted"><Database className="size-3.5" />{data.dataset}</span>}</div>
            {data.sentiment_status !== "trained" ? <Card className="p-6 text-sm text-muted">No sentiment model trained yet. Click “Retrain all”.</Card> : (
              <div className="space-y-5">
                {(() => {
                  const trained = data.sentiment.filter((m) => m.status === "trained");
                  return trained.length > 1 && (
                    <Card>
                      <CardHeader><CardTitle>Model comparison</CardTitle><CardDescription>Same stratified test split. Macro-F1 weights the hard neutral class equally — that&apos;s why the production model is chosen on macro-F1, not accuracy.</CardDescription></CardHeader>
                      <CardContent>
                        <SimpleBarChart ratio height={220} data={trained.map((m) => ({ name: m.model_name.replace("TF-IDF + ", ""), Accuracy: m.metrics.accuracy, "Macro F1": m.metrics.f1_macro, "Weighted F1": m.metrics.f1_weighted }))}
                          x="name" series={[{ key: "Accuracy", label: "Accuracy", color: PALETTE.primary }, { key: "Macro F1", label: "Macro F1", color: PALETTE.secondary }, { key: "Weighted F1", label: "Weighted F1", color: PALETTE.success }]} />
                      </CardContent>
                    </Card>
                  );
                })()}
                {data.sentiment.map((m) => <SentimentModelCard key={m.model_name} m={m} />)}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-center gap-2"><h2 className="text-lg font-semibold">Recommendation evaluation</h2><Badge variant={rec.length ? "success" : "warning"}>{data.recommendation_status}</Badge></div>
            {!rec.length ? <Card className="p-6 text-sm text-muted">Not evaluated yet. Click “Re-evaluate recommender”.</Card> : (
              <div className="space-y-5">
                <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <p>{rec[0].notes} {hybrid && bestNdcg && bestNdcg.metrics.strategy !== "hybrid" &&
                    <strong> On this data the hybrid model does not outperform {bestNdcg.model_name} on NDCG@10 ({bestNdcg.metrics["@10"].ndcg} vs {hybrid.metrics["@10"].ndcg}).</strong>}</p>
                </div>
                <Card>
                  <CardHeader><CardTitle>Content vs collaborative vs hybrid</CardTitle><CardDescription>Leave-latest-out evaluation on {rec[0].metrics.users_evaluated} users · {rec[0].dataset_size?.toLocaleString()} interactions</CardDescription></CardHeader>
                  <CardContent>
                    <SimpleBarChart ratio data={recChart} x="name" series={[{ key: "Precision@10", label: "Precision@10", color: PALETTE.primary }, { key: "Recall@10", label: "Recall@10", color: PALETTE.secondary }, { key: "NDCG@10", label: "NDCG@10", color: PALETTE.success }]} />
                  </CardContent>
                </Card>
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr>{["Strategy", "P@5", "R@5", "NDCG@5", "P@10", "R@10", "NDCG@10", "Hit@10", "Coverage@10", "Latency"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-border">
                      {rec.map((m) => {
                        const a = m.metrics["@5"], b = m.metrics["@10"];
                        return (
                          <tr key={m.model_name} className={cn(m.is_active && "bg-primary/5")}>
                            <td className="px-4 py-2.5 font-medium">{m.model_name}{m.is_active && <Badge className="ml-2">active</Badge>}</td>
                            <td className="px-4">{a.precision}</td><td className="px-4">{a.recall}</td><td className="px-4">{a.ndcg}</td>
                            <td className="px-4">{b.precision}</td><td className="px-4">{b.recall}</td><td className={cn("px-4", bestNdcg?.model_name === m.model_name && "font-bold text-success")}>{b.ndcg}</td>
                            <td className="px-4">{b.hit_rate}</td><td className="px-4">{pct(b.coverage)}</td><td className="px-4 text-muted">{m.latency_ms} ms</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
                {hybrid?.metrics.weights && <p className="text-xs text-muted">Hybrid weights at evaluation: {Object.entries(hybrid.metrics.weights as Record<string, number>).map(([k, v]) => `${k} ${v}`).join(" · ")}</p>}
              </div>
            )}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileUp className="size-4" /> Upload review dataset</CardTitle>
                <CardDescription>CSV with “Review Text” and “Rating” columns, plus “product_id” or “Clothing ID” to link products. Validated, de-duplicated, preprocessed and sentiment-scored on import.</CardDescription></CardHeader>
              <CardContent>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
                <Button variant="outline" loading={upload.isPending} onClick={() => fileRef.current?.click()}><FileUp /> Choose CSV</Button>
                {upload.data && (
                  <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl bg-surface-2 p-4 text-sm">
                    {Object.entries(upload.data).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-muted">{titleCase(k)}</dt><dd className="font-semibold">{String(v)}</dd></div>)}
                  </dl>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Training history</CardTitle></CardHeader>
              <CardContent>
                <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                  {data.history.map((h, i) => (
                    <li key={i} className="flex items-center justify-between gap-2"><span className="truncate">{h.model_name} <span className="text-xs text-muted">({h.model_type})</span></span>
                      <span className="shrink-0 text-xs text-muted">{formatDate(h.trained_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </>
  );
}
