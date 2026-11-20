"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Lock, Smartphone, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { OrderSummary } from "@/components/commerce/order-summary";
import { ProductImage } from "@/components/products/product-bits";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/primitives";
import { EmptyState, PageHeader, Spinner } from "@/components/ui/states";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-shop";
import { cn, errorMessage, formatPrice } from "@/lib/utils";
import { orderService } from "@/services";

const schema = z.object({
  shipping_name: z.string().trim().min(2, "Enter the recipient's name").max(120),
  shipping_phone: z.string().trim().regex(/^[0-9+\-\s()]{7,30}$/, "Enter a valid phone number"),
  shipping_address: z.string().trim().min(5, "Enter the full address").max(300),
  shipping_city: z.string().trim().min(2, "Enter the city").max(80),
  shipping_postal_code: z.string().trim().regex(/^[0-9A-Za-z\- ]{4,12}$/, "Enter a valid PIN / postal code"),
  payment_method: z.enum(["demo_card", "demo_upi", "demo_cod"]),
});
type Values = z.infer<typeof schema>;

const METHODS = [
  { id: "demo_card", label: "Card", icon: CreditCard }, { id: "demo_upi", label: "UPI", icon: Smartphone }, { id: "demo_cod", label: "Cash on delivery", icon: Wallet },
] as const;

export default function CheckoutPage() {
  const { user } = useAuth();
  const { data: cart, isLoading } = useCart();
  const router = useRouter();
  const qc = useQueryClient();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: { shipping_name: user?.full_name ?? "", shipping_phone: user?.phone ?? "", payment_method: "demo_card" },
  });
  const method = watch("payment_method");
  const place = useMutation({
    mutationFn: orderService.create,
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Order ${o.order_number} confirmed!`);
      router.replace(`/orders?placed=${o.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading || !cart) return <Spinner className="min-h-[40vh]" />;
  if (cart.items.length === 0) return <div className="mx-auto max-w-3xl px-4 py-16"><EmptyState title="Nothing to check out" description="Your cart is empty." action={{ label: "Browse products", href: "/products" }} /></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader title="Checkout" description="Demo checkout — no real payment will be taken." />
      <form onSubmit={handleSubmit((v) => place.mutate(v))} className="grid gap-6 lg:grid-cols-[1fr_360px]" noValidate>
        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <h2 className="font-semibold">Shipping address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="n" error={errors.shipping_name?.message}><Input id="n" autoComplete="name" {...register("shipping_name")} aria-invalid={!!errors.shipping_name} /></Field>
              <Field label="Phone" htmlFor="ph" error={errors.shipping_phone?.message}><Input id="ph" type="tel" autoComplete="tel" {...register("shipping_phone")} aria-invalid={!!errors.shipping_phone} /></Field>
            </div>
            <Field label="Address" htmlFor="a" error={errors.shipping_address?.message}><Textarea id="a" rows={2} autoComplete="street-address" {...register("shipping_address")} aria-invalid={!!errors.shipping_address} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" htmlFor="c" error={errors.shipping_city?.message}><Input id="c" autoComplete="address-level2" {...register("shipping_city")} aria-invalid={!!errors.shipping_city} /></Field>
              <Field label="PIN code" htmlFor="z" error={errors.shipping_postal_code?.message}><Input id="z" autoComplete="postal-code" {...register("shipping_postal_code")} aria-invalid={!!errors.shipping_postal_code} /></Field>
            </div>
          </Card>
          <Card className="space-y-4 p-6">
            <h2 className="font-semibold">Payment method</h2>
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Payment method">
              {METHODS.map((m) => (
                <button type="button" key={m.id} role="radio" aria-checked={method === m.id} onClick={() => setValue("payment_method", m.id)}
                  className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 text-sm font-medium transition", method === m.id ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-border hover:border-primary/40")}>
                  <m.icon className="size-5 text-primary" />{m.label}
                </button>
              ))}
            </div>
            <p className="flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-xs text-muted"><Lock className="size-3.5" />Demo mode: no card or UPI details are collected and nothing is charged.</p>
          </Card>
        </div>
        <div className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Items</h2>
            <ul className="space-y-3">
              {cart.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 text-sm">
                  <ProductImage src={it.product.image_url} alt="" className="h-14 w-12 rounded-lg" />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{it.product.name}</p><p className="text-xs text-muted">{it.variant ? `Size ${it.variant.size} · ` : ""}Qty {it.quantity}</p></div>
                  <span className="font-semibold">{formatPrice(it.line_total)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <OrderSummary cart={cart}>
            <Button type="submit" variant="gradient" size="lg" className="mt-5 w-full" loading={place.isPending} disabled={cart.has_unavailable}>
              Place order · {formatPrice(cart.total)}
            </Button>
          </OrderSummary>
        </div>
      </form>
    </div>
  );
}
