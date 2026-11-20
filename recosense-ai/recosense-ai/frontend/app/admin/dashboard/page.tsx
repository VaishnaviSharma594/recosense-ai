"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, Info, MessageSquareText, ShoppingCart, Smile, Star, Users } from "lucide-react";
import Link from "next/link";

import { StatCard } from "@/components/admin/stat-card";
import { DonutChart, PALETTE, SimpleBarChart } from "@/components/charts/charts";
import { ProductImage } from "@/components/products/product-bits";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { ErrorState, PageHeader, Spinner } from "@/components/ui/states";
import { errorMessage, formatDate, formatPrice } from "@/lib/utils";
import { adminService } from "@/services/admin";

export default function AdminDashboard() {
  const { data: d, isLoading, isError, error, refetch } = useQuery({ queryKey: ["admin", "dashboard"], queryFn: adminService.dashboard });
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const t = d?.totals;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Dashboard" description="Live metrics computed from the database — users, catalogue, reviews, orders and model predictions." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={isLoading} label="Total users" value={t?.users} hint={t ? `${t.real_users} registered · ${t.demo_users} demo` : undefined} icon={Users} />
        <StatCard loading={isLoading} label="Products" value={t?.products} icon={Boxes} tone="secondary" />
        <StatCard loading={isLoading} label="Reviews analysed" value={t?.analysed_reviews.toLocaleString()} hint={t ? `${t.reviews.toLocaleString()} visible reviews` : undefined} icon={MessageSquareText} tone="success" />
        <StatCard loading={isLoading} label="Orders" value={t?.orders} hint={t ? `${formatPrice(t.revenue)} demo revenue` : undefined} icon={ShoppingCart} tone="warning" />
        <StatCard loading={isLoading} label="Average rating" value={t?.average_rating ? `${t.average_rating}★` : "—"} icon={Star} tone="warning" />
        <StatCard loading={isLoading} label="Positive sentiment" value={d ? `${d.sentiment.positive}%` : ""} icon={Smile} tone="success" />
        <StatCard loading={isLoading} label="Neutral sentiment" value={d ? `${d.sentiment.neutral}%` : ""} icon={Smile} tone="warning" />
        <StatCard loading={isLoading} label="Negative sentiment" value={d ? `${d.sentiment.negative}%` : ""} icon={Smile} tone="danger" />
      </div>
      {d && <p className="mt-4 flex items-start gap-2 text-xs text-muted"><Info className="mt-0.5 size-3.5 shrink-0" />{d.data_notice}</p>}

      {isLoading || !d ? <Spinner /> : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Sentiment distribution</CardTitle><CardDescription>All analysed reviews</CardDescription></CardHeader>
            <CardContent>
              <DonutChart centerLabel={`${d.sentiment.positive.toFixed(0)}%`} data={[
                { name: "Positive", value: d.sentiment.positive, color: PALETTE.success },
                { name: "Neutral", value: d.sentiment.neutral, color: PALETTE.warning },
                { name: "Negative", value: d.sentiment.negative, color: PALETTE.danger }]} />
              <div className="mt-2 flex justify-center gap-4 text-xs text-muted">
                {[["Positive", PALETTE.success], ["Neutral", PALETTE.warning], ["Negative", PALETTE.danger]].map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: c }} />{l}</span>)}
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Top-performing categories</CardTitle><CardDescription>Interactions and purchases by category</CardDescription></CardHeader>
            <CardContent>
              <SimpleBarChart data={d.top_categories} x="category" series={[{ key: "interactions", label: "Interactions", color: PALETTE.primary }, { key: "purchases", label: "Purchases", color: PALETTE.secondary }]} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Most recommended products</CardTitle><CardDescription>Times shown in hybrid recommendation lists</CardDescription></CardHeader>
            <CardContent>
              {d.most_recommended.length === 0 ? <p className="text-sm text-muted">No recommendations generated yet.</p> : (
                <ul className="divide-y divide-border">
                  {d.most_recommended.map(({ product: p, count }, i) => (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-5 text-sm font-bold text-muted">{i + 1}</span>
                      <ProductImage src={p.image_url} alt="" className="size-11 rounded-lg" />
                      <div className="min-w-0 flex-1"><Link href={`/products/${p.id}`} className="truncate text-sm font-medium hover:text-primary">{p.name}</Link><p className="text-xs text-muted">{p.category.name} · {p.positive_pct.toFixed(0)}% positive</p></div>
                      <Badge variant="muted">{count}×</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
            <CardContent>
              {d.recent_orders.length === 0 ? <p className="text-sm text-muted">No orders yet. Orders appear after a customer checks out.</p> : (
                <ul className="space-y-3">
                  {d.recent_orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between text-sm">
                      <div><p className="font-medium">{o.order_number}</p><p className="text-xs text-muted">{formatDate(o.created_at)}</p></div>
                      <div className="text-right"><p className="font-semibold">{formatPrice(o.total)}</p><Badge variant={o.status === "cancelled" ? "danger" : "success"} className="capitalize">{o.status}</Badge></div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
