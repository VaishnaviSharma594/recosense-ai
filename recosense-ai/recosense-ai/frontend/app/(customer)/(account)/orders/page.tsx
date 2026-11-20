"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Package } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ProductImage } from "@/components/products/product-bits";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/primitives";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { cn, errorMessage, formatDate, formatPrice } from "@/lib/utils";
import { orderService } from "@/services";

const STATUS: Record<string, "success" | "default" | "danger" | "warning"> = { confirmed: "default", placed: "warning", shipped: "default", delivered: "success", cancelled: "danger" };
const STEPS = ["placed", "confirmed", "shipped", "delivered"];

function OrdersInner() {
  const placed = Number(useSearchParams().get("placed"));
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["orders"], queryFn: orderService.list });
  const [open, setOpen] = React.useState<number | null>(placed || null);
  const cancel = useMutation({
    mutationFn: orderService.cancel,
    onSuccess: () => { toast.success("Order cancelled"); qc.invalidateQueries({ queryKey: ["orders"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader title="Your orders" description="Order history from the demo checkout." />
      {placed > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 p-4">
          <CheckCircle2 className="size-6 text-success" /><div><p className="font-semibold">Thank you — your order is confirmed!</p><p className="text-sm text-muted">This was a demo checkout; no payment was taken.</p></div>
        </div>
      )}
      {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        : isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
          : data!.length === 0 ? <EmptyState icon={Package} title="No orders yet" description="When you place an order it'll show up here." action={{ label: "Start shopping", href: "/products" }} />
            : (
              <ul className="space-y-3">
                {data!.map((o) => {
                  const expanded = open === o.id;
                  const stepIndex = STEPS.indexOf(o.status);
                  return (
                    <li key={o.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
                      <button className="flex w-full cursor-pointer flex-wrap items-center gap-x-6 gap-y-2 p-4 text-left hover:bg-surface-2/50" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : o.id)}>
                        <div><p className="text-xs text-muted">Order</p><p className="font-semibold">{o.order_number}</p></div>
                        <div><p className="text-xs text-muted">Placed</p><p className="text-sm">{formatDate(o.created_at)}</p></div>
                        <div><p className="text-xs text-muted">Total</p><p className="text-sm font-semibold">{formatPrice(o.total)}</p></div>
                        <Badge variant={STATUS[o.status] ?? "muted"} className="capitalize">{o.status}</Badge>
                        <div className="ml-auto flex -space-x-2">{o.items.slice(0, 3).map((i) => <ProductImage key={i.id} src={i.image_url} alt="" className="size-10 rounded-lg border-2 border-surface" />)}</div>
                        <ChevronDown className={cn("size-4 transition", expanded && "rotate-180")} />
                      </button>
                      {expanded && (
                        <div className="space-y-5 border-t border-border p-4 animate-fade-up">
                          {o.status !== "cancelled" && (
                            <ol className="grid grid-cols-4 gap-2 text-center text-xs">
                              {STEPS.map((s, i) => (
                                <li key={s} className="space-y-1.5"><div className={cn("h-1.5 rounded-full", i <= stepIndex ? "bg-brand-gradient" : "bg-surface-2")} /><span className={cn("capitalize", i <= stepIndex ? "font-semibold" : "text-muted")}>{s}</span></li>
                              ))}
                            </ol>
                          )}
                          <ul className="space-y-3">
                            {o.items.map((i) => (
                              <li key={i.id} className="flex items-center gap-3 text-sm">
                                <ProductImage src={i.image_url} alt="" className="h-16 w-14 rounded-lg" />
                                <div className="flex-1">
                                  {i.product_id ? <Link href={`/products/${i.product_id}`} className="font-medium hover:text-primary">{i.product_name}</Link> : <span className="font-medium">{i.product_name}</span>}
                                  <p className="text-xs text-muted">{[i.size && `Size ${i.size}`, i.color, `Qty ${i.quantity}`].filter(Boolean).join(" · ")}</p>
                                </div>
                                <span className="font-semibold">{formatPrice(i.unit_price * i.quantity)}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="grid gap-4 text-sm sm:grid-cols-2">
                            <div><p className="text-xs font-semibold uppercase text-muted">Ship to</p><p className="mt-1">{o.shipping_name} · {o.shipping_phone}</p><p className="text-muted">{o.shipping_address}, {o.shipping_city} {o.shipping_postal_code}</p></div>
                            <dl className="space-y-1">
                              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatPrice(o.subtotal)}</dd></div>
                              <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="text-success">−{formatPrice(o.discount)}</dd></div>
                              <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{o.shipping_fee ? formatPrice(o.shipping_fee) : "Free"}</dd></div>
                              <div className="flex justify-between font-semibold"><dt>Total ({o.payment_method.replace("demo_", "").toUpperCase()} · demo)</dt><dd>{formatPrice(o.total)}</dd></div>
                            </dl>
                          </div>
                          {["placed", "confirmed"].includes(o.status) && (
                            <Button variant="outline" size="sm" className="text-danger" loading={cancel.isPending} onClick={() => cancel.mutate(o.id)}>Cancel order</Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
    </div>
  );
}

export default function OrdersPage() {
  return <React.Suspense><OrdersInner /></React.Suspense>;
}
