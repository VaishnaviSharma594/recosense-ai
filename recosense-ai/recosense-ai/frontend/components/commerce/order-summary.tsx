import { Card } from "@/components/ui/primitives";
import { formatPrice } from "@/lib/utils";
import type { Cart } from "@/types";

export function OrderSummary({ cart, children }: { cart: Cart; children?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="font-semibold">Order summary</h2>
      <dl className="mt-4 space-y-2.5 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Subtotal (MRP)</dt><dd>{formatPrice(cart.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="text-success">−{formatPrice(cart.discount)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{cart.shipping_fee ? formatPrice(cart.shipping_fee) : "Free"}</dd></div>
        <div className="flex justify-between border-t border-border pt-3 text-base font-bold"><dt>Total</dt><dd>{formatPrice(cart.total)}</dd></div>
      </dl>
      {cart.shipping_fee > 0 && <p className="mt-3 rounded-lg bg-primary/5 p-2.5 text-xs text-primary">Add {formatPrice(1999 - (cart.total - cart.shipping_fee))} more for free delivery.</p>}
      {children}
    </Card>
  );
}

