"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bot, Brain, History, MessageSquareQuote, Smile, Sparkles, Star, TrendingUp, Wand2 } from "lucide-react";
import Link from "next/link";

import { ProductRail } from "@/components/products/product-rail";
import { ReasonList } from "@/components/recommendations/reason-list";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { productService, recService, reviewService } from "@/services";

export function HighlightRails({ show = ["trending", "best_rated", "positive_sentiment"] }: { show?: string[] }) {
  const { data, isLoading } = useQuery({ queryKey: ["highlights"], queryFn: () => productService.highlights(10) });
  return (
    <>
      {show.includes("trending") && <ProductRail title="Trending now" subtitle="Most viewed, saved and purchased this season" icon={TrendingUp} products={data?.trending} loading={isLoading} href="/products?sort=popularity" />}
      {show.includes("best_rated") && <ProductRail title="Best rated" subtitle="Highest average rating with at least 5 reviews" icon={Star} products={data?.best_rated} loading={isLoading} href="/products?sort=rating" />}
      {show.includes("positive_sentiment") && <ProductRail title="Loved by customers" subtitle="Highest positive sentiment detected in real reviews" icon={Smile} products={data?.positive_sentiment} loading={isLoading} href="/products?sort=sentiment" />}
    </>
  );
}

export function PersonalRails() {
  const { user, status } = useAuth();
  const recs = useQuery({
    queryKey: ["recommendations", user?.id, "hybrid", 10],
    queryFn: () => recService.forUser(user!.id, "hybrid", 10),
    enabled: status === "authenticated" && !!user,
  });
  const recent = useQuery({ queryKey: ["recent"], queryFn: productService.recent, enabled: status === "authenticated" });
  if (status !== "authenticated") return null;
  const byId = new Map(recs.data?.items.map((i) => [i.product.id, i]) ?? []);
  return (
    <>
      <ProductRail title={recs.data?.cold_start ? "Picked to get you started" : "Recommended for you"}
        subtitle={recs.data?.cold_start ? "Based on your preferences and what's trending — browse a few items to personalise further"
          : "Hybrid AI: content similarity + similar shoppers + review sentiment + ratings"}
        icon={Wand2} loading={recs.isLoading} products={recs.data?.items.map((i) => i.product)} href="/recommendations"
        renderExtra={(p) => <ReasonList reasons={byId.get(p.id)?.reasons ?? []} />} />
      <ProductRail title="Recently viewed" icon={History} products={recent.data} loading={recent.isLoading} />
    </>
  );
}

export function AssistantBanner() {
  return (
    <section className="my-10 overflow-hidden rounded-3xl bg-brand-gradient p-[1px]">
      <div className="relative flex flex-col items-start gap-6 overflow-hidden rounded-[calc(1.5rem-1px)] bg-slate-950 px-6 py-10 text-white sm:px-10 md:flex-row md:items-center">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-secondary/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 size-72 rounded-full bg-primary/40 blur-3xl" />
        <div className="relative flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold"><Bot className="size-3.5" /> AI shopping assistant</span>
          <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Ask for exactly what you want.</h2>
          <p className="mt-2 max-w-xl text-sm text-white/70 sm:text-base">“Dresses under ₹2,000 with great fabric” · “Which jeans have fit complaints?” · “Compare these two”. Answers come from our catalogue and real review sentiment.</p>
        </div>
        <Button asChild size="lg" className="relative bg-white text-slate-900 hover:bg-white/90"><Link href="/ai-assistant"><Sparkles /> Start chatting</Link></Button>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    { icon: MessageSquareQuote, title: "Reads every review", text: "A TF-IDF + Logistic Regression model, trained on 18k real fashion reviews, classifies each review and extracts aspects like fit and fabric." },
    { icon: Brain, title: "Learns your taste", text: "Content similarity, collaborative filtering on shopper behaviour, sentiment and ratings are blended into one hybrid score." },
    { icon: Sparkles, title: "Explains every pick", text: "Each recommendation tells you why — similar items you liked, what shoppers like you chose, and what customers praise." },
  ];
  return (
    <section className="py-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">How RecoSense works</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Recommendations you can actually trust</h2>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-gradient text-white"><s.icon className="size-5" /></span>
              <span className="font-display text-4xl font-bold text-border">0{i + 1}</span>
            </div>
            <h3 className="mt-4 font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-sm text-muted">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Testimonials() {
  const { data } = useQuery({ queryKey: ["featured-reviews"], queryFn: reviewService.featured });
  if (!data?.length) return null;
  return (
    <section className="py-12">
      <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold">What customers are saying</h2>
          <p className="mt-1 text-sm text-muted">Verbatim 5★ reviews from the public Women&apos;s E-Commerce Clothing Reviews dataset, linked to our sample catalogue.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {data.slice(0, 3).map((r) => (
          <figure key={r.id} className="flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <div className="flex gap-0.5">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-4 fill-amber-400 text-amber-400" />)}</div>
            <blockquote className="mt-3 flex-1 text-sm leading-relaxed">“{r.body}”</blockquote>
            <figcaption className="mt-4 border-t border-border pt-3 text-xs text-muted">
              {r.reviewer_name}{r.reviewer_age ? `, ${r.reviewer_age}` : ""} · on{" "}
              <Link href={`/products/${r.product_id}`} className="font-medium text-primary hover:underline">{r.product_name}</Link>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function CategoryTiles() {
  const { data } = useQuery({ queryKey: ["categories"], queryFn: productService.categories });
  return (
    <section className="py-8">
      <h2 className="mb-5 text-xl font-bold sm:text-2xl">Shop by category</h2>
      <div className="grid grid-cols-3 gap-3 sm:gap-4 md:grid-cols-6">
        {(data ?? Array.from({ length: 6 }).map((_, i) => ({ id: i, name: "", slug: "", image_url: null }))).map((c) => (
          <Link key={c.id} href={c.slug ? `/products?category=${c.slug}` : "#"}
            className="group overflow-hidden rounded-2xl border border-border bg-surface text-center shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
            <div className="aspect-square overflow-hidden bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.image_url && <img src={c.image_url} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" />}
            </div>
            <p className="flex items-center justify-center gap-1 px-2 py-2.5 text-sm font-semibold">{c.name || " "}<ArrowRight className="size-3.5 opacity-0 transition group-hover:opacity-100" /></p>
          </Link>
        ))}
      </div>
    </section>
  );
}
