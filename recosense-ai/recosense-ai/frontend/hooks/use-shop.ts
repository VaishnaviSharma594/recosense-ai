"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/utils";
import { cartService, wishlistService } from "@/services";
import type { Cart } from "@/types";

function useRequireLogin() {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  return () => {
    if (status !== "authenticated") {
      toast.info("Please sign in to continue");
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return false;
    }
    return true;
  };
}

export function useCart() {
  const { status } = useAuth();
  const qc = useQueryClient();
  const requireLogin = useRequireLogin();
  const query = useQuery({ queryKey: ["cart"], queryFn: cartService.get, enabled: status === "authenticated" });
  const setCart = (c: Cart) => qc.setQueryData(["cart"], c);

  const add = useMutation({
    mutationFn: (v: { productId: number; variantId: number | null; quantity?: number }) =>
      cartService.add(v.productId, v.variantId, v.quantity ?? 1),
    onSuccess: (c) => { setCart(c); toast.success("Added to cart"); qc.invalidateQueries({ queryKey: ["recommendations"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const update = useMutation({
    mutationFn: (v: { itemId: number; quantity: number }) => cartService.update(v.itemId, v.quantity),
    onSuccess: setCart,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (itemId: number) => cartService.remove(itemId),
    onSuccess: (c) => { setCart(c); toast.success("Removed from cart"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return {
    ...query,
    addToCart: (productId: number, variantId: number | null, quantity = 1) => {
      if (requireLogin()) add.mutate({ productId, variantId, quantity });
    },
    adding: add.isPending,
    update,
    remove,
  };
}

export function useWishlist() {
  const { status } = useAuth();
  const qc = useQueryClient();
  const requireLogin = useRequireLogin();
  const query = useQuery({ queryKey: ["wishlist"], queryFn: wishlistService.get, enabled: status === "authenticated" });
  const ids = new Set((query.data ?? []).map((w) => w.product.id));
  const toggle = useMutation({
    mutationFn: async (productId: number) => {
      if (ids.has(productId)) {
        await wishlistService.remove(productId);
        return false;
      }
      await wishlistService.add(productId);
      return true;
    },
    onSuccess: (added) => {
      toast.success(added ? "Saved to wishlist" : "Removed from wishlist");
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return {
    ...query,
    has: (id: number) => ids.has(id),
    toggle: (id: number) => { if (requireLogin()) toggle.mutate(id); },
    pending: toggle.isPending,
  };
}
