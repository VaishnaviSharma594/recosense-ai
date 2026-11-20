"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck, Smile, Sparkles, Star, Truck } from "lucide-react";
import Link from "next/link";

import { AssistantBanner, CategoryTiles, HighlightRails, HowItWorks, PersonalRails, Testimonials } from "@/components/home/sections";
import { ProductImage } from "@/components/products/product-bits";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { productService } from "@/services";

function HeroVisual() {
  const { data } = useQuery({ queryKey: ["highlights"], queryFn: () => productService.highlights(10) });
  const picks = data?.positive_sentiment.slice(0, 3) ?? [];
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-md sm:h-[480px]" aria-hidden>
      <div className="absolute inset-6 rounded-[2.5rem] bg-brand-gradient opacity-15 blur-2xl" />
      {picks.map((p, i) => (
        <Link key={p.id} href={`/products/${p.id}`} tabIndex={-1}
          className="absolute w-44 overflow-hidden rounded-2xl border border-border bg-surface shadow-lift transition hover:z-10 hover:scale-[1.03] sm:w-52"
          style={{ left: ["4%", "50%", "22%"][i], top: ["4%", "12%", "46%"][i], rotate: ["-6deg", "5deg", "-2deg"][i] }}>
          <ProductImage src={p.image_url} alt="" className="aspect-[4/5] w-full" />
          <div className="p-3">
            <p className="truncate text-xs font-semibold">{p.name}</p>
            <p className="text-xs text-muted">{formatPrice(p.final_price)}</p>
          </div>
        </Link>
      ))}
      {picks[0] && (
        <div className="absolute right-0 top-[58%] flex items-center gap-2 rounded-2xl border border-border bg-surface/95 px-3.5 py-2.5 shadow-lift backdrop-blur">
          <span className="grid size-8 place-items-center rounded-full bg-success/15 text-success"><Smile className="size-4" /></span>
          <div className="text-xs"><p className="font-bold">{picks[0].positive_pct.toFixed(0)}% positive</p><p className="text-muted">from {picks[0].review_count} reviews</p></div>
        </div>
      )}
      <div className="absolute bottom-2 left-0 max-w-[230px] rounded-2xl border border-border bg-surface/95 px-3.5 py-2.5 text-xs shadow-lift backdrop-blur">
        <p className="flex items-center gap-1.5 font-semibold text-primary"><Sparkles className="size-3.5" /> Why it&apos;s recommended</p>
        <p className="mt-1 text-muted">Positive customer feedback on fit &amp; sizing · Popular with shoppers like you</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="grid items-center gap-10 pb-6 pt-10 md:grid-cols-[1.1fr_1fr] md:pt-16">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> Shop Smarter. Choose Better. Powered by AI.
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl">
            Discover Fashion That <span className="text-gradient">Understands You.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">AI-powered product recommendations backed by real customer experiences.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="gradient"><Link href="/products">Explore Collection <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/recommendations"><Sparkles /> Discover AI Recommendations</Link></Button>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
            {[[Star, "Sentiment-ranked", "every product"], [Truck, "Free delivery", "over ₹1,999"], [ShieldCheck, "Demo checkout", "no real payment"]].map(([Icon, a, b]) => {
              const I = Icon as typeof Star;
              return (
                <div key={a as string} className="flex flex-col gap-1">
                  <I className="size-5 text-primary" />
                  <dt className="text-sm font-semibold">{a as string}</dt>
                  <dd className="text-xs text-muted">{b as string}</dd>
                </div>
              );
            })}
          </dl>
        </div>
        <HeroVisual />
      </section>

      <CategoryTiles />
      <PersonalRails />
      <HighlightRails />
      <AssistantBanner />
      <HowItWorks />
      <Testimonials />
    </div>
  );
}
