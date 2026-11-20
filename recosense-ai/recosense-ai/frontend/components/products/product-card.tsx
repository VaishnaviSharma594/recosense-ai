"use client";

import { Columns3, Heart } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Price, ProductImage, RatingStars, SentimentPill } from "@/components/products/product-bits";
import { Skeleton } from "@/components/ui/primitives";
import { useCompare } from "@/hooks/use-compare";
import { useWishlist } from "@/hooks/use-shop";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

const reveal = "grid size-9 cursor-pointer place-items-center rounded-full bg-surface/90 shadow-soft backdrop-blur transition hover:scale-105 focus-visible:opacity-100 sm:translate-x-2 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100";

export function ProductCard({ product, children, className }: {
  product: Product; children?: React.ReactNode; className?: string;
}) {
  const wishlist = useWishlist();
  const compare = useCompare();
  const saved = wishlist.has(product.id);
  const comparing = compare.has(product.id);

  return (
    <article className={cn("group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift", className)}>
      <Link href={`/products/${product.id}`} className="relative block aspect-[4/5] overflow-hidden" aria-label={product.name}>
        <ProductImage src={product.image_url} alt={product.name} className="size-full transition duration-500 group-hover:scale-[1.04]" />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.discount_percent >= 20 && <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-background">-{product.discount_percent}%</span>}
          {!product.in_stock && <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">Sold out</span>}
        </div>
      </Link>
      <div className="absolute right-3 top-3 flex flex-col gap-2">
        <button onClick={() => wishlist.toggle(product.id)} aria-pressed={saved} aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
          className={cn(reveal, saved && "sm:translate-x-0 sm:opacity-100")}>
          <Heart className={cn("size-4", saved ? "fill-rose-500 text-rose-500" : "text-foreground")} />
        </button>
        <button onClick={() => compare.toggle(product.id)} aria-pressed={comparing} aria-label={comparing ? "Remove from comparison" : "Add to comparison"}
          className={cn(reveal, comparing && "bg-primary text-white sm:translate-x-0 sm:opacity-100")}>
          <Columns3 className="size-4" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium uppercase tracking-wide text-muted">{product.brand}</span>
          <SentimentPill positivePct={product.positive_pct} reviewCount={product.review_count} />
        </div>
        <Link href={`/products/${product.id}`} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary">{product.name}</Link>
        <RatingStars rating={product.rating_avg} count={product.review_count} />
        <div className="mt-auto pt-1"><Price price={product.price} finalPrice={product.final_price} discount={product.discount_percent} /></div>
        {children}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <Skeleton className="aspect-[4/5] rounded-none" />
      <div className="space-y-2 p-4"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-24" /><Skeleton className="h-5 w-16" /></div>
    </div>
  );
}

export function ProductGrid({ products, loading, count = 8, className }: { products?: Product[]; loading?: boolean; count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 xl:grid-cols-4", className)}>
      {loading ? Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)
        : products?.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
