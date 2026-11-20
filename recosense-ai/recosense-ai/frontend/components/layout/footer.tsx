import Link from "next/link";

import { Logo } from "@/components/layout/logo";

const COLS = [
  { title: "Shop", links: [["Dresses", "/products?category=dresses"], ["Tops", "/products?category=tops"], ["Jeans", "/products?category=jeans"], ["Shoes", "/products?category=shoes"], ["Accessories", "/products?category=accessories"]] },
  { title: "AI features", links: [["Recommendations", "/recommendations"], ["Sentiment insights", "/sentiment-analysis"], ["AI shopping assistant", "/ai-assistant"], ["Compare products", "/compare"]] },
  { title: "Account", links: [["Profile", "/profile"], ["Orders", "/orders"], ["Wishlist", "/wishlist"], ["Cart", "/cart"]] },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm text-muted">Shop Smarter. Choose Better. Powered by AI — recommendations backed by real customer experiences.</p>
          <p className="mt-4 text-xs text-muted">
            Internship demo project. Products and brands are sample data; reviews are from the public Women&apos;s E-Commerce Clothing
            Reviews dataset. Checkout is a demo — no real payments are taken.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h4 className="text-sm font-semibold">{c.title}</h4>
            <ul className="mt-3 space-y-2">
              {c.links.map(([label, href]) => (
                <li key={href}><Link href={href} className="text-sm text-muted transition hover:text-foreground">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted">© {new Date().getFullYear()} RecoSense AI · Built with Next.js, FastAPI, PostgreSQL & scikit-learn</div>
    </footer>
  );
}
