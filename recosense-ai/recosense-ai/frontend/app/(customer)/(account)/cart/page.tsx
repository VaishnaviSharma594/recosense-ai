"use client";

import { AlertTriangle, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";

import { ProductImage } from "@/components/products/product-bits";
import { Button } from "@/components/ui/button";
import { OrderSummary } from "@/components/commerce/order-summary";
import { Skeleton } from "@/components/ui/primitives";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { useCart } from "@/hooks/use-shop";
import { cn, errorMessage, formatPrice } from "@/lib/utils";

export default function CartPage() {
  const { data: cart, isLoading, isError, error, refetch, update, remove } = useCart();
  if (isError) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState message={errorMessage(error)} onRetry={() => refetch()} /></div>;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader title="Shopping cart" description={cart ? `${cart.item_count} item${cart.item_count === 1 ? "" : "s"}` : undefined} />
      {isLoading || !cart ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]"><div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-32" />)}</div><Skeleton className="h-64" /></div>
      ) : cart.items.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Your cart is empty" description="Explore recommendations picked for you or browse the collection." action={{ label: "Start shopping", href: "/products" }} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <ul className="space-y-3">
            {cart.has_unavailable && (
              <li className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />Some items are unavailable and are excluded from the total. Remove or adjust them to check out.
              </li>
            )}
            {cart.items.map((it) => (
              <li key={it.id} className={cn("flex gap-4 rounded-2xl border border-border bg-surface p-4", !it.available && "opacity-75")}>
                <Link href={`/products/${it.product.id}`}><ProductImage src={it.product.image_url} alt={it.product.name} className="h-28 w-24 rounded-xl" /></Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/products/${it.product.id}`} className="line-clamp-1 font-semibold hover:text-primary">{it.product.name}</Link>
                      <p className="text-xs text-muted">{it.product.brand}{it.variant && ` · Size ${it.variant.size} · ${it.variant.color}`}</p>
                    </div>
                    <p className="font-bold">{formatPrice(it.line_total)}</p>
                  </div>
                  {it.issue && <p className="mt-1 text-xs font-medium text-danger">{it.issue}</p>}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center rounded-xl border border-border">
                      <Button variant="ghost" size="icon-sm" aria-label="Decrease quantity" disabled={it.quantity <= 1 || update.isPending}
                        onClick={() => update.mutate({ itemId: it.id, quantity: it.quantity - 1 })}><Minus /></Button>
                      <span className="w-8 text-center text-sm font-semibold">{it.quantity}</span>
                      <Button variant="ghost" size="icon-sm" aria-label="Increase quantity" disabled={it.quantity >= 20 || update.isPending}
                        onClick={() => update.mutate({ itemId: it.id, quantity: it.quantity + 1 })}><Plus /></Button>
                    </div>
                    <Button variant="ghost" size="sm" className="text-danger" onClick={() => remove.mutate(it.id)}><Trash2 /> Remove</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="lg:sticky lg:top-32 lg:self-start">
            <OrderSummary cart={cart}>
              <Button asChild variant="gradient" size="lg" className={cn("mt-5 w-full", (cart.has_unavailable || cart.total === 0) && "pointer-events-none opacity-50")}>
                <Link href="/checkout" aria-disabled={cart.has_unavailable}>Proceed to checkout <ArrowRight /></Link>
              </Button>
              <Button asChild variant="link" className="mt-2 w-full"><Link href="/products">Continue shopping</Link></Button>
            </OrderSummary>
          </div>
        </div>
      )}
    </div>
  );
}
