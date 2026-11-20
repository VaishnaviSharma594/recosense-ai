"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Brain, Gauge, ThumbsDown, ThumbsUp, Timer } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ProductImage, SentimentBar } from "@/components/products/product-bits";
import { AspectBars, SentimentBadge, SentimentTrendChart, SummaryPanel } from "@/components/sentiment/sentiment-widgets";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea } from "@/components/ui/form";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from "@/components/ui/primitives";
import { ErrorState, PageHeader, Spinner } from "@/components/ui/states";
import { cn, errorMessage } from "@/lib/utils";
import { productService, reviewService } from "@/services";

const EXAMPLES = [
  "The dress is beautiful and the fabric quality is excellent, but the fitting is disappointing.",
  "Runs small and the material is see through. Sent it back.",
  "So comfortable and true to size — I bought it in two colours!",
  "It's okay. Nice colour but too long for me and a bit pricey.",
];

function Analyzer() {
  const [text, setText] = React.useState(EXAMPLES[0]);
  const m = useMutation({ mutationFn: reviewService.analyze });
  const r = m.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Brain className="size-5 text-primary" /> Live review analyzer</CardTitle>
        <CardDescription>Runs the trained TF-IDF + Logistic Regression model and the aspect extraction pipeline on any review text.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={5000} aria-label="Review text to analyse" />
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e, i) => <button key={i} onClick={() => setText(e)} className="chip text-xs">Example {i + 1}</button>)}
        </div>
        <Button variant="gradient" loading={m.isPending} disabled={text.trim().length < 3} onClick={() => m.mutate(text)}>Analyse sentiment</Button>
        {m.isError && <p className="text-sm text-danger">{errorMessage(m.error)}</p>}
        {r && (
          <div className="space-y-4 rounded-2xl border border-border bg-surface-2/50 p-4 animate-fade-up">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted">Overall:</span>
              <span className={cn("rounded-full px-3 py-1 text-sm font-bold capitalize",
                r.overall === "positive" ? "bg-success/15 text-emerald-700 dark:text-emerald-400" : r.overall === "negative" ? "bg-danger/15 text-red-700 dark:text-red-400"
                  : r.overall === "mixed" ? "bg-secondary/15 text-secondary" : "bg-warning/15 text-amber-700")}>{r.overall}</span>
              <span className="flex items-center gap-1 text-xs text-muted"><Gauge className="size-3.5" /> Document label: {r.label} ({(r.confidence * 100).toFixed(0)}%)</span>
              <span className="flex items-center gap-1 text-xs text-muted"><Timer className="size-3.5" /> {r.latency_ms} ms</span>
            </div>
            <div className="space-y-2">
              {(["positive", "neutral", "negative"] as const).map((k) => (
                <div key={k} className="grid grid-cols-[80px_1fr_44px] items-center gap-3 text-xs">
                  <span className="capitalize text-muted">{k}</span>
                  <Progress value={r.probabilities[k] * 100} barClassName={k === "positive" ? "bg-success" : k === "negative" ? "bg-danger" : "bg-warning"} />
                  <span className="text-right font-semibold">{(r.probabilities[k] * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-600"><ThumbsUp className="size-4" />Positive aspects</p>
                {r.positive_aspects.length ? r.positive_aspects.map((a) => <Badge key={a} variant="success" className="mr-1 mb-1">{a}</Badge>) : <p className="text-xs text-muted">None detected</p>}</div>
              <div><p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-red-600"><ThumbsDown className="size-4" />Negative aspects</p>
                {r.negative_aspects.length ? r.negative_aspects.map((a) => <Badge key={a} variant="danger" className="mr-1 mb-1">{a}</Badge>) : <p className="text-xs text-muted">None detected</p>}</div>
            </div>
            {r.aspects.length > 0 && (
              <ul className="space-y-1.5 border-t border-border pt-3">
                {r.aspects.map((a) => (
                  <li key={a.aspect + a.snippet} className="flex items-start gap-2 text-xs">
                    <SentimentBadge label={a.sentiment} /><span className="font-medium">{a.aspect}</span><span className="text-muted">“{a.snippet}”</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-muted">Model: {r.model_name} v{r.model_version}. Clause polarity blends model probabilities with a small negation-aware opinion lexicon.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProductExplorer() {
  const products = useQuery({ queryKey: ["products", "reviewed"], queryFn: () => productService.list({ sort: "sentiment", page_size: 100, min_rating: 0.1 }) });
  const [picked, setId] = React.useState<number | null>(null);
  const id = picked ?? products.data?.items[0]?.id ?? null;
  const s = useQuery({ queryKey: ["sentiment", id], queryFn: () => reviewService.sentiment(id!), enabled: !!id });
  const sum = useQuery({ queryKey: ["summary", id], queryFn: () => reviewService.summary(id!), enabled: !!id });
  const p = products.data?.items.find((x) => x.id === id);
  if (products.isError) return <ErrorState message={errorMessage(products.error)} onRetry={() => products.refetch()} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Product sentiment explorer</CardTitle>
        <CardDescription>Aggregated from stored predictions — no hard-coded values.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <NativeSelect aria-label="Choose product" value={id ?? ""} onChange={(e) => setId(Number(e.target.value))}>
          {products.data?.items.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.positive_pct.toFixed(0)}% positive ({x.review_count})</option>)}
        </NativeSelect>
        {!s.data || !p ? <Spinner /> : (
          <>
            <div className="flex gap-4">
              <ProductImage src={p.image_url} alt={p.name} className="h-28 w-24 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Link href={`/products/${p.id}`} className="font-semibold hover:text-primary">{p.name}</Link>
                <p className="text-xs text-muted">{s.data.analysed_count} reviews · {s.data.rating_avg.toFixed(1)}★ · {s.data.mixed_count} mixed</p>
                <SentimentBar positive={s.data.positive_pct} neutral={s.data.neutral_pct} negative={s.data.negative_pct} />
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div><h4 className="mb-3 text-sm font-semibold">Aspects</h4><AspectBars aspects={s.data.aspects} limit={6} /></div>
              <div><h4 className="mb-3 text-sm font-semibold">Trend</h4><SentimentTrendChart data={s.data.trend} height={200} /></div>
            </div>
            {sum.data && <SummaryPanel summary={sum.data} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function SentimentAnalysisPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader eyebrow="NLP module" title="Sentiment insights"
        description="Reviews are classified as positive, neutral or negative, then split into clauses to detect sentiment about fit, fabric, comfort, design, colour, length, value and durability." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <Analyzer />
        <ProductExplorer />
      </div>
    </div>
  );
}
