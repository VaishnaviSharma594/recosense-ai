"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { PALETTE, SimpleBarChart, SimpleLineChart } from "@/components/charts/charts";
import { SentimentTrendChart } from "@/components/sentiment/sentiment-widgets";
import { NativeSelect } from "@/components/ui/form";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { ErrorState, PageHeader, Spinner } from "@/components/ui/states";
import { errorMessage } from "@/lib/utils";
import { adminService } from "@/services/admin";

const INTERACTIONS = [
  { key: "view", label: "Views", color: PALETTE.primary }, { key: "click", label: "Clicks", color: PALETTE.cyan },
  { key: "wishlist", label: "Wishlist", color: PALETTE.secondary }, { key: "cart", label: "Cart", color: PALETTE.warning },
  { key: "purchase", label: "Purchases", color: PALETTE.success },
];

export default function AnalyticsPage() {
  const [days, setDays] = React.useState(90);
  const { data: a, isLoading, isError, error, refetch } = useQuery({ queryKey: ["admin", "analytics", days], queryFn: () => adminService.analytics(days) });
  const report = useQuery({ queryKey: ["admin", "sentiment-report"], queryFn: adminService.sentimentReport });
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Analytics" description="Sentiment, reviews, category demand, recommendation activity and customer interactions."
        actions={<NativeSelect aria-label="Time range" className="w-40" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option></NativeSelect>} />
      {isLoading || !a ? <Spinner /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Sentiment trend</CardTitle><CardDescription>Monthly review sentiment (all time). Dataset reviews have no timestamps and were spread over the past year on import.</CardDescription></CardHeader>
            <CardContent><SentimentTrendChart data={a.sentiment_trend} height={280} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Review volume</CardTitle><CardDescription>Reviews per month</CardDescription></CardHeader>
            <CardContent><SimpleBarChart data={a.review_volume} x="period" series={[{ key: "reviews", label: "Reviews", color: PALETTE.primary }]} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Category popularity</CardTitle><CardDescription>Interactions by type</CardDescription></CardHeader>
            <CardContent><SimpleBarChart stacked data={a.category_popularity as never} x="category" series={INTERACTIONS} /></CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Customer interactions</CardTitle><CardDescription>Daily events in the selected range (demo shopper activity is synthetic)</CardDescription></CardHeader>
            <CardContent><SimpleLineChart data={a.customer_interactions as never} x="date" series={INTERACTIONS} height={280} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recommendation activity</CardTitle><CardDescription>Hybrid recommendations generated per day</CardDescription></CardHeader>
            <CardContent>{a.recommendation_activity.length ? <SimpleBarChart data={a.recommendation_activity} x="date" series={[{ key: "recommendations", label: "Recommendations", color: PALETTE.secondary }, { key: "users", label: "Users", color: PALETTE.primary }]} />
              : <p className="py-10 text-center text-sm text-muted">No recommendations generated in this range.</p>}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Product aspects</CardTitle><CardDescription>Aspect mentions across all reviews</CardDescription></CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {a.most_appreciated.map((x) => <Badge key={x} variant="success">Appreciated: {x}</Badge>)}
                {a.most_complained.map((x) => <Badge key={x} variant="danger">Complaint: {x}</Badge>)}
              </div>
              <SimpleBarChart horizontal stacked data={a.aspects} x="aspect" height={300} series={[
                { key: "positive", label: "Positive", color: PALETTE.success }, { key: "neutral", label: "Neutral", color: PALETTE.warning }, { key: "negative", label: "Negative", color: PALETTE.danger }]} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Product performance</CardTitle><CardDescription>Top 10 products by weighted popularity</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr>{["Product", "Category", "Popularity", "Rating", "Reviews", "Positive", "Negative"].map((h) => <th key={h} className="py-2 pr-4 font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-border">
                  {a.product_performance.map((p) => (
                    <tr key={p.id}><td className="py-2.5 pr-4"><Link href={`/products/${p.id}`} className="font-medium hover:text-primary">{p.name}</Link></td><td className="pr-4 text-muted">{p.category}</td>
                      <td className="pr-4">{p.popularity}</td><td className="pr-4">{p.reviews ? `${p.rating.toFixed(1)}★` : "—"}</td><td className="pr-4">{p.reviews}</td>
                      <td className="pr-4 text-success">{p.reviews ? `${p.positive_pct}%` : "—"}</td><td className="pr-4 text-danger">{p.reviews ? `${p.negative_pct}%` : "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Sentiment report</CardTitle><CardDescription>Products ordered by negative share — where to look first</CardDescription></CardHeader>
            <CardContent className="max-h-[480px] overflow-auto">
              {!report.data ? <Spinner /> : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-muted"><tr>{["Product", "Reviews", "Positive", "Neutral", "Negative", "Praised for", "Complaints"].map((h) => <th key={h} className="py-2 pr-4 font-semibold">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-border">
                    {report.data.map((r) => (
                      <tr key={r.id}><td className="py-2.5 pr-4"><Link href={`/products/${r.id}`} className="font-medium hover:text-primary">{r.name}</Link><p className="text-xs text-muted">{r.category}</p></td>
                        <td className="pr-4">{r.reviews}</td><td className="pr-4 text-success">{r.positive_pct}%</td><td className="pr-4 text-warning">{r.neutral_pct}%</td><td className="pr-4 font-semibold text-danger">{r.negative_pct}%</td>
                        <td className="pr-4 text-xs">{r.top_praise.join(", ") || "—"}</td><td className="pr-4 text-xs">{r.top_complaints.join(", ") || "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
