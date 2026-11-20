"use client";

import { ImageOff, Smile, Star } from "lucide-react";
import * as React from "react";

import { cn, formatPrice, sentimentTone } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element -- product images are local SVGs or admin-supplied URLs from any host */
export function ProductImage({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) {
    return (
      <div className={cn("grid place-items-center bg-surface-2 text-muted", className)}>
        <ImageOff className="size-8 opacity-50" aria-label="Image unavailable" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("object-cover", className)} />;
}

export function Price({ price, finalPrice, discount, size = "default" }: { price: number; finalPrice: number; discount: number; size?: "default" | "lg" }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={cn("font-display font-bold", size === "lg" ? "text-3xl" : "text-base")}>{formatPrice(finalPrice)}</span>
      {discount > 0 && (
        <>
          <span className={cn("text-muted line-through", size === "lg" ? "text-base" : "text-xs")}>{formatPrice(price)}</span>
          <span className={cn("font-semibold text-success", size === "lg" ? "text-sm" : "text-xs")}>{discount}% off</span>
        </>
      )}
    </div>
  );
}

export function RatingStars({ rating, count, size = "sm" }: { rating: number; count?: number; size?: "sm" | "md" }) {
  const s = size === "sm" ? "size-3.5" : "size-4.5";
  return (
    <div className="flex items-center gap-1" aria-label={`Rated ${rating.toFixed(1)} out of 5${count !== undefined ? ` from ${count} reviews` : ""}`}>
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn(s, i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-border text-border")} />
        ))}
      </div>
      {count !== undefined && <span className="text-xs text-muted">{rating > 0 ? rating.toFixed(1) : "—"} ({count})</span>}
    </div>
  );
}

const TONE = {
  positive: "bg-success/12 text-emerald-700 dark:text-emerald-400",
  neutral: "bg-warning/15 text-amber-700 dark:text-amber-400",
  negative: "bg-danger/12 text-red-700 dark:text-red-400",
  none: "bg-surface-2 text-muted",
};

export function SentimentPill({ positivePct, reviewCount, className }: { positivePct: number; reviewCount: number; className?: string }) {
  const tone = sentimentTone(positivePct, reviewCount);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", TONE[tone], className)}
      title="Share of reviews our sentiment model classifies as positive">
      <Smile className="size-3" />
      {reviewCount ? `${positivePct.toFixed(0)}% positive` : "No reviews yet"}
    </span>
  );
}

export function SentimentBar({ positive, neutral, negative, className, showLegend = true }: {
  positive: number; neutral: number; negative: number; className?: string; showLegend?: boolean;
}) {
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2" role="img"
        aria-label={`${positive}% positive, ${neutral}% neutral, ${negative}% negative`}>
        <div className="bg-success transition-all" style={{ width: `${positive}%` }} />
        <div className="bg-warning transition-all" style={{ width: `${neutral}%` }} />
        <div className="bg-danger transition-all" style={{ width: `${negative}%` }} />
      </div>
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-success" />Positive {positive.toFixed(0)}%</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-warning" />Neutral {neutral.toFixed(0)}%</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-danger" />Negative {negative.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
