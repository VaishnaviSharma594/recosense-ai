"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Columns3, Heart, Minus, Plus, RotateCcw, ShieldCheck, ShoppingBag, Star, Truck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Price, ProductImage, RatingStars, SentimentBar } from "@/components/products/product-bits";
import { ProductRail } from "@/components/products/product-rail";
import { ReasonList } from "@/components/recommendations/reason-list";
import { AspectBars, ReviewCard, SentimentTrendChart, SummaryPanel } from "@/components/sentiment/sentiment-widgets";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/form";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/states";
import { useAuth } from "@/hooks/use-auth";
import { useCompare } from "@/hooks/use-compare";
import { useCart, useWishlist } from "@/hooks/use-shop";
import { cn, errorMessage } from "@/lib/utils";
import { productService, recService, reviewService } from "@/services";

const reviewSchema = z.object({
  rating: z.number().min(1, "Choose a rating").max(5),
  title: z.string().max(200).optional(),
  body: z.string().trim().min(10, "Write at least 10 characters").max(5000),
});

function ReviewForm({ productId, onDone }: { productId: number; onDone: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<z.infer<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema), defaultValues: { rating: 0 },
  });
  const rating = watch("rating");
  const m = useMutation({
    mutationFn: (v: z.infer<typeof reviewSchema>) => reviewService.create(productId, v),
    onSuccess: (r) => {
      toast.success(`Review posted — our model read it as ${r.sentiment?.is_mixed ? "mixed" : r.sentiment?.label}`);
      reset({ rating: 0, title: "", body: "" });
      ["reviews", "sentiment", "summary", "product"].forEach((k) => qc.invalidateQueries({ queryKey: [k, productId] }));
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-4 rounded-2xl border border-border bg-surface p-5" noValidate>
      <div>
        <p className="mb-1.5 text-sm font-medium">Your rating</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button type="button" key={i} role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? "s" : ""}`}
              onClick={() => setValue("rating", i, { shouldValidate: true })} className="cursor-pointer p-0.5">
              <Star className={cn("size-6 transition", i <= rating ? "fill-amber-400 text-amber-400" : "text-border")} />
            </button>
          ))}
        </div>
        {errors.rating && <p className="mt-1 text-xs text-danger">{errors.rating.message}</p>}
      </div>
      <Field label="Title (optional)" htmlFor="rtitle"><Input id="rtitle" {...register("title")} /></Field>
      <Field label="Your review" htmlFor="rbody" error={errors.body?.message} hint="Mention fit, fabric, comfort — our AI extracts these aspects.">
        <Textarea id="rbody" {...register("body")} aria-invalid={!!errors.body} />
      </Field>
      <Button type="submit" variant="gradient" loading={m.isPending}>Post review</Button>
    </form>
  );
}

function Reviews({ productId }: { productId: number }) {
  const { status } = useAuth();
  const [page, setPage] = React.useState(1);
  const [sentiment, setSentiment] = React.useState("");
  const [sort, setSort] = React.useState("helpful");
  const [writing, setWriting] = React.useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["reviews", productId, page, sentiment, sort],
    queryFn: () => reviewService.list(productId, { page, sentiment: sentiment || undefined, sort }),
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {["", "positive", "neutral", "negative", "mixed"].map((s) => (
          <button key={s} onClick={() => { setSentiment(s); setPage(1); }} className={cn("chip capitalize", sentiment === s && "chip-on")}>{s || "All"}</button>
        ))}
        <NativeSelect aria-label="Sort reviews" className="ml-auto h-9 w-44" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
          <option value="helpful">Most helpful</option><option value="newest">Newest</option>
          <option value="rating_high">Highest rating</option><option value="rating_low">Lowest rating</option>
        </NativeSelect>
        {status === "authenticated" ? <Button variant="outline" size="sm" onClick={() => setWriting((w) => !w)}>{writing ? "Cancel" : "Write a review"}</Button>
          : <Button asChild variant="outline" size="sm"><Link href={`/login?next=/products/${productId}`}>Sign in to review</Link></Button>}
      </div>
      {writing && <ReviewForm productId={productId} onDone={() => setWriting(false)} />}
      {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        : isLoading ? <Spinner label="Loading reviews" />
          : data!.items.length === 0 ? <EmptyState title="No reviews here yet" description={sentiment ? "No reviews with this sentiment." : "Be the first to share your experience."} />
            : data!.items.map((r) => <ReviewCard key={r.id} review={r} />)}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted">Page {data.page} of {data.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function Insights({ productId }: { productId: number }) {
  const { data, isLoading } = useQuery({ queryKey: ["sentiment", productId], queryFn: () => reviewService.sentiment(productId) });
  if (isLoading || !data) return <Spinner label="Analysing sentiment" />;
  if (!data.analysed_count) return <EmptyState title="No sentiment data yet" description="Insights appear once customers review this product." />;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Sentiment distribution</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            {(["positive", "neutral", "negative"] as const).map((k) => (
              <div key={k} className="rounded-xl bg-surface-2 p-3">
                <p className={cn("font-display text-2xl font-bold", k === "positive" ? "text-success" : k === "negative" ? "text-danger" : "text-warning")}>
                  {data[`${k}_pct`].toFixed(0)}%</p>
                <p className="text-xs capitalize text-muted">{k} · {data.distribution[k]}</p>
              </div>
            ))}
          </div>
          <SentimentBar positive={data.positive_pct} neutral={data.neutral_pct} negative={data.negative_pct} />
          <p className="text-xs text-muted">{data.analysed_count} reviews analysed · {data.mixed_count} contain mixed opinions · overall sentiment score {data.sentiment_score !== null ? (data.sentiment_score * 100).toFixed(0) : "—"}/100</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Aspect-based sentiment</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {data.top_positive_aspects.map((a) => <Badge key={a} variant="success">Most appreciated: {a}</Badge>)}
            {data.top_negative_aspects.map((a) => <Badge key={a} variant="danger">Complaint: {a}</Badge>)}
          </div>
          <AspectBars aspects={data.aspects} />
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Sentiment over time</CardTitle></CardHeader>
        <CardContent><SentimentTrendChart data={data.trend} /></CardContent>
      </Card>
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);
  const { status } = useAuth();
  const cart = useCart();
  const wishlist = useWishlist();
  const compare = useCompare();
  const { data: p, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["product", productId], queryFn: () => productService.get(productId), enabled: Number.isFinite(productId),
  });
  const summary = useQuery({ queryKey: ["summary", productId], queryFn: () => reviewService.summary(productId), enabled: !!p });
  const similar = useQuery({ queryKey: ["similar", productId], queryFn: () => recService.similar(productId, 10), enabled: !!p });
  // Selection is tied to the product id, so it resets automatically when navigating to another product.
  const [sel, setSel] = React.useState<{ pid: number; variantId: number | null; qty: number }>({ pid: productId, variantId: null, qty: 1 });
  const variantId = sel.pid === productId ? sel.variantId : null;
  const qty = sel.pid === productId ? sel.qty : 1;
  const setVariantId = (v: number | null) => setSel({ pid: productId, variantId: v, qty: 1 });
  const setQty = (f: (q: number) => number) => setSel({ pid: productId, variantId, qty: f(qty) });

  React.useEffect(() => {
    if (status === "authenticated" && Number.isFinite(productId)) productService.track(productId, "view").catch(() => undefined);
  }, [status, productId]);

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-2">
        <Skeleton className="aspect-[4/5]" />
        <div className="space-y-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-3/4" /><Skeleton className="h-6 w-40" /><Skeleton className="h-24 w-full" /><Skeleton className="h-12 w-full" /></div>
      </div>
    );
  }
  if (isError || !p) {
    return <div className="mx-auto max-w-2xl px-4 py-20"><ErrorState message={errorMessage(error)} onRetry={() => refetch()} /></div>;
  }

  const variant = p.variants.find((v) => v.id === variantId) ?? null;
  const needsVariant = p.variants.length > 0;
  const maxQty = Math.min(10, variant ? variant.stock : p.stock);
  const simById = new Map(similar.data?.map((s) => [s.product.id, s]) ?? []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/products" className="hover:text-foreground">Shop</Link><ChevronRight className="size-3.5" />
        <Link href={`/products?category=${p.category.slug}`} className="hover:text-foreground">{p.category.name}</Link><ChevronRight className="size-3.5" />
        <span className="truncate text-foreground">{p.name}</span>
      </nav>
      <div className="grid gap-10 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface md:sticky md:top-32 md:self-start">
          <ProductImage src={p.image_url} alt={p.images[0]?.alt ?? p.name} className="aspect-[4/5] w-full" />
          {p.is_demo && <span className="absolute bottom-3 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-muted backdrop-blur">Sample product · illustration</span>}
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{p.brand}</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight">{p.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <RatingStars rating={p.rating_avg} count={p.review_count} size="md" />
            {p.review_count > 0 && <Badge variant={p.positive_pct >= 70 ? "success" : p.positive_pct >= 50 ? "warning" : "danger"}>{p.positive_pct.toFixed(0)}% positive sentiment</Badge>}
          </div>
          <div className="mt-5"><Price price={p.price} finalPrice={p.final_price} discount={p.discount_percent} size="lg" /><p className="mt-1 text-xs text-muted">Inclusive of all taxes</p></div>

          {summary.data?.sufficient_data && (
            <div className="mt-5 rounded-2xl border border-border bg-surface p-4 text-sm">
              <p className="font-semibold">At a glance <Badge variant="secondary" className="ml-1">AI</Badge></p>
              <p className="mt-1 text-muted">{summary.data.overall_opinion}</p>
            </div>
          )}

          {needsVariant && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">Size {p.color && <span className="text-muted">· Colour: {p.color}</span>}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
                {p.variants.map((v) => (
                  <button key={v.id} role="radio" aria-checked={variantId === v.id} disabled={v.stock === 0}
                    onClick={() => setVariantId(v.id)}
                    className={cn("min-w-14 cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through",
                      variantId === v.id ? "border-primary bg-primary text-white" : "border-border hover:border-primary/60")}>
                    {v.size}
                  </button>
                ))}
              </div>
              {variant && variant.stock <= 5 && <p className="mt-2 text-xs font-medium text-warning">Only {variant.stock} left in this size</p>}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-border">
              <Button variant="ghost" size="icon" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)}><Minus /></Button>
              <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
              <Button variant="ghost" size="icon" aria-label="Increase quantity" disabled={qty >= maxQty} onClick={() => setQty((q) => q + 1)}><Plus /></Button>
            </div>
            <Button size="lg" variant="gradient" className="flex-1" disabled={!p.in_stock || !p.is_active} loading={cart.adding}
              onClick={() => {
                if (needsVariant && !variantId) return toast.error("Please choose a size");
                cart.addToCart(p.id, variantId, qty);
              }}>
              <ShoppingBag /> {!p.is_active ? "Unavailable" : p.in_stock ? "Add to cart" : "Sold out"}
            </Button>
            <Button size="lg" variant="outline" aria-pressed={wishlist.has(p.id)} onClick={() => wishlist.toggle(p.id)} aria-label="Wishlist">
              <Heart className={cn(wishlist.has(p.id) && "fill-rose-500 text-rose-500")} />
            </Button>
            <Button size="lg" variant="outline" aria-pressed={compare.has(p.id)} onClick={() => compare.toggle(p.id)} aria-label="Compare">
              {compare.has(p.id) ? <Check /> : <Columns3 />}
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs text-muted">
            {[[Truck, "Free delivery over ₹1,999"], [RotateCcw, "14-day easy returns"], [ShieldCheck, "Demo checkout · no charge"]].map(([I, t]) => {
              const Icon = I as typeof Truck;
              return <div key={t as string} className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-2 p-3"><Icon className="size-4 text-primary" />{t as string}</div>;
            })}
          </div>

          <div className="mt-8 space-y-3 text-sm">
            <h2 className="font-semibold">Description</h2>
            <p className="leading-relaxed text-muted">{p.description}</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 pt-2">
              {[["Category", p.category.name], ["Brand", p.brand], ["Material", p.material ?? "—"], ["Colour", p.color ?? "—"],
                ["Availability", p.in_stock ? `In stock (${p.stock})` : "Out of stock"]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border py-1.5"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            {p.tags.length > 0 && <div className="flex flex-wrap gap-1.5 pt-2">{p.tags.map((t) => <Badge key={t} variant="muted">#{t}</Badge>)}</div>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="summary" className="mt-14">
        <TabsList>
          <TabsTrigger value="summary">AI summary</TabsTrigger>
          <TabsTrigger value="insights">Sentiment insights</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({p.review_count})</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">{summary.data ? <SummaryPanel summary={summary.data} /> : <Spinner label="Summarising reviews" />}</TabsContent>
        <TabsContent value="insights"><Insights productId={p.id} /></TabsContent>
        <TabsContent value="reviews"><Reviews productId={p.id} /></TabsContent>
      </Tabs>

      <ProductRail title="Similar products" subtitle="Content-based similarity (TF-IDF + cosine) blended with sentiment" products={similar.data?.map((s) => s.product)}
        loading={similar.isLoading} renderExtra={(sp) => <ReasonList reasons={simById.get(sp.id)?.reasons ?? []} />} />
    </div>
  );
}
