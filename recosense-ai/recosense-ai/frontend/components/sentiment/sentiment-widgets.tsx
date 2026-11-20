"use client";

import { BadgeCheck, Bot, Quote, ThumbsDown, ThumbsUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { RatingStars } from "@/components/products/product-bits";
import { Badge } from "@/components/ui/primitives";
import { cn, formatDate } from "@/lib/utils";
import type { AspectStat, Review, ReviewSummary, TrendPoint } from "@/types";

export const SENTIMENT_COLORS = { positive: "#10B981", neutral: "#F59E0B", negative: "#EF4444" };

export function SentimentBadge({ label, mixed }: { label: string; mixed?: boolean }) {
  if (mixed) return <Badge variant="secondary">Mixed</Badge>;
  const v = label === "positive" ? "success" : label === "negative" ? "danger" : "warning";
  return <Badge variant={v} className="capitalize">{label}</Badge>;
}

export function AspectBars({ aspects, limit = 8 }: { aspects: AspectStat[]; limit?: number }) {
  if (!aspects.length) return <p className="text-sm text-muted">No product aspects detected yet.</p>;
  return (
    <ul className="space-y-3">
      {aspects.slice(0, limit).map((a) => {
        const pos = (a.positive / a.total) * 100, neg = (a.negative / a.total) * 100, neu = 100 - pos - neg;
        return (
          <li key={a.aspect}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium">{a.aspect}</span>
              <span className="text-xs text-muted">{a.total} mentions · {pos.toFixed(0)}% positive</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" role="img"
              aria-label={`${a.aspect}: ${a.positive} positive, ${a.neutral} neutral, ${a.negative} negative mentions`}>
              <div className="bg-success" style={{ width: `${pos}%` }} />
              <div className="bg-warning/70" style={{ width: `${neu}%` }} />
              <div className="bg-danger" style={{ width: `${neg}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SentimentTrendChart({ data, height = 240 }: { data: TrendPoint[]; height?: number }) {
  if (data.length < 2) return <p className="py-8 text-center text-sm text-muted">Not enough history for a trend yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        {(["positive", "neutral", "negative"] as const).map((k) => (
          <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={SENTIMENT_COLORS[k]} fill={SENTIMENT_COLORS[k]} fillOpacity={0.25} strokeWidth={2} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ReviewCard({ review }: { review: Review }) {
  const s = review.sentiment;
  const pos = review.aspects.filter((a) => a.sentiment === "positive");
  const neg = review.aspects.filter((a) => a.sentiment === "negative");
  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RatingStars rating={review.rating} />
          {s && <SentimentBadge label={s.label} mixed={s.is_mixed} />}
        </div>
        <span className="text-xs text-muted">{formatDate(review.created_at)}</span>
      </div>
      {review.title && <h4 className="mt-3 font-semibold">{review.title}</h4>}
      <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{review.body}</p>
      {(pos.length > 0 || neg.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pos.map((a) => <span key={`p${a.aspect}`} className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"><ThumbsUp className="size-3" />{a.aspect}</span>)}
          {neg.map((a) => <span key={`n${a.aspect}`} className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-400"><ThumbsDown className="size-3" />{a.aspect}</span>)}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1"><BadgeCheck className="size-3.5 text-primary" />
          {review.source === "customer" ? review.reviewer_name || "Customer" : `${review.reviewer_name}${review.reviewer_age ? `, age ${review.reviewer_age}` : ""}`}
        </span>
        {review.source !== "customer" && <span>Source: public review dataset</span>}
        {review.helpful_count > 0 && <span>{review.helpful_count} found this helpful</span>}
        {s && <span>Model confidence {(s.confidence * 100).toFixed(0)}%</span>}
      </div>
    </article>
  );
}

export function SummaryPanel({ summary, className }: { summary: ReviewSummary; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-secondary/[0.06] p-5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-gradient text-white"><Bot className="size-4" /></span>
        <h3 className="font-semibold">AI review summary</h3>
        <Badge variant="secondary">AI-generated</Badge>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed">{summary.overall_opinion}</p>
      {summary.sufficient_data && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[{ title: "Customers like", items: summary.positive_points, tone: "text-emerald-600", Icon: ThumbsUp },
              { title: "Common complaints", items: summary.negative_points, tone: "text-red-600", Icon: ThumbsDown }].map(({ title, items, tone, Icon }) => (
              <div key={title}>
                <h4 className={cn("mb-2 flex items-center gap-1.5 text-sm font-semibold", tone)}><Icon className="size-4" />{title}</h4>
                {items.length === 0 ? <p className="text-sm text-muted">Nothing recurring.</p> : (
                  <ul className="space-y-2.5">
                    {items.map((p) => (
                      <li key={p.aspect} className="text-sm">
                        <span className="font-medium">{p.aspect}</span>
                        <span className="text-muted"> — {p.mentions} of {p.total_mentions} mentions</span>
                        {p.customer_quote && (
                          <blockquote className="mt-1 flex gap-1.5 border-l-2 border-border pl-2 text-xs italic text-muted">
                            <Quote className="size-3 shrink-0" />“{p.customer_quote}”
                          </blockquote>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-surface/70 p-3 text-sm font-medium">{summary.recommendation_summary}</p>
        </>
      )}
      <p className="mt-3 text-[11px] text-muted">Generated by {summary.method} from {summary.review_count} reviews. Quoted phrases are verbatim customer words; the summary text is machine-generated.</p>
    </section>
  );
}
