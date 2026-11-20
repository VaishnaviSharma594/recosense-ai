"use client";

import { Heart } from "lucide-react";

import { ProductGrid } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { useWishlist } from "@/hooks/use-shop";
import { errorMessage } from "@/lib/utils";
import Link from "next/link";

export default function WishlistPage() {
  const { data, isLoading, isError, error, refetch } = useWishlist();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader title="Your wishlist" description={data ? `${data.length} saved product${data.length === 1 ? "" : "s"} · saved items also personalise your recommendations` : undefined}
        actions={data?.length ? <Button asChild variant="outline"><Link href="/ai-assistant">Find similar with AI</Link></Button> : undefined} />
      {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        : !isLoading && data?.length === 0 ? <EmptyState icon={Heart} title="Your wishlist is empty" description="Tap the heart on any product to save it for later." action={{ label: "Discover products", href: "/products" }} />
          : <ProductGrid products={data?.map((w) => w.product)} loading={isLoading} />}
    </div>
  );
}
