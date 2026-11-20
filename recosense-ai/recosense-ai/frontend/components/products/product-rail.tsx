"use client";

import { ArrowRight, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ProductCard, ProductCardSkeleton } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types";

export function ProductRail({ title, subtitle, icon: Icon, products, loading, href, renderExtra, empty }: {
  title: string; subtitle?: string; icon?: LucideIcon; products?: Product[]; loading?: boolean; href?: string;
  renderExtra?: (p: Product, i: number) => React.ReactNode; empty?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  if (!loading && (!products || products.length === 0) && !empty) return null;
  return (
    <section className="py-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            {Icon && <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>}
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {href && <Button asChild variant="link" className="mr-2 hidden sm:inline-flex"><Link href={href}>View all <ArrowRight /></Link></Button>}
          <Button variant="outline" size="icon-sm" aria-label="Scroll left" onClick={() => scroll(-1)}><ChevronLeft /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Scroll right" onClick={() => scroll(1)}><ChevronRight /></Button>
        </div>
      </div>
      {!loading && (!products || products.length === 0) ? empty : (
        <div ref={ref} className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:gap-5">
          {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="w-[46%] shrink-0 sm:w-[30%] lg:w-[23%]"><ProductCardSkeleton /></div>)
            : products!.map((p, i) => (
              <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-[23%]">
                <ProductCard product={p} className="h-full">{renderExtra?.(p, i)}</ProductCard>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
