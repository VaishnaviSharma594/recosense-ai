"use client";

import {
  Columns3, Heart, LayoutDashboard, LogOut, Menu, Moon, Package, Sparkles, ShoppingBag, Sun, User as UserIcon, Wand2, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import * as React from "react";

import { Logo } from "@/components/layout/logo";
import { SearchBox } from "@/components/layout/search-box";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/primitives";
import { useAuth } from "@/hooks/use-auth";
import { useCompare } from "@/hooks/use-compare";
import { useCart, useWishlist } from "@/hooks/use-shop";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/products?category=dresses", label: "Dresses" },
  { href: "/products?category=tops", label: "Tops" },
  { href: "/products?category=shirts", label: "Shirts" },
  { href: "/products?category=jeans", label: "Jeans" },
  { href: "/products?category=shoes", label: "Shoes" },
  { href: "/products?category=accessories", label: "Accessories" },
];

function CountIcon({ href, label, count, children }: { href: string; label: string; count?: number; children: React.ReactNode }) {
  return (
    <Link href={href} aria-label={count ? `${label} (${count})` : label}
      className="relative grid size-10 place-items-center rounded-xl text-foreground transition hover:bg-surface-2">
      {children}
      {!!count && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold leading-5 text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(() => () => {}, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button variant="ghost" size="icon" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

export function Navbar() {
  const { user, status, logout } = useAuth();
  const { data: cart } = useCart();
  const { data: wishlist } = useWishlist();
  const compare = useCompare();
  const pathname = usePathname();
  // The drawer remembers the path it was opened on, so navigating closes it automatically.
  const [openedAt, setOpenedAt] = React.useState<string | null>(null);
  const mobile = openedAt === pathname;
  const setMobile = (open: boolean) => setOpenedAt(open ? pathname : null);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <button className="grid size-10 place-items-center rounded-xl hover:bg-surface-2 lg:hidden" aria-label="Open menu"
          onClick={() => setMobile(true)}>
          <Menu className="size-5" />
        </button>
        <Logo href={status === "authenticated" ? "/home" : "/"} />
        <SearchBox className="mx-auto hidden w-full max-w-md md:block" />
        <nav className="ml-auto flex items-center gap-0.5 md:ml-0" aria-label="Shortcuts">
          <Link href="/ai-assistant" className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 sm:flex">
            <Sparkles className="size-4" /> Ask AI
          </Link>
          <span className="hidden sm:block"><CountIcon href="/compare" label="Compare" count={compare.ids.length}><Columns3 className="size-5" /></CountIcon></span>
          <CountIcon href="/wishlist" label="Wishlist" count={wishlist?.length}><Heart className="size-5" /></CountIcon>
          <CountIcon href="/cart" label="Cart" count={cart?.item_count}><ShoppingBag className="size-5" /></CountIcon>
          <span className="hidden sm:block"><ThemeToggle /></span>
          {status === "authenticated" && user ? (
            <Dropdown>
              <DropdownTrigger asChild>
                <button className="ml-1 grid size-9 cursor-pointer place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white ring-offset-2 ring-offset-background focus-visible:ring-2"
                  aria-label="Account menu">
                  {user.full_name.charAt(0).toUpperCase()}
                </button>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownLabel>
                  <span className="block font-semibold text-foreground">{user.full_name}</span>
                  <span className="block truncate">{user.email}</span>
                </DropdownLabel>
                <DropdownSeparator />
                {user.role === "admin" && (
                  <DropdownItem asChild><Link href="/admin/dashboard"><LayoutDashboard /> Admin dashboard</Link></DropdownItem>
                )}
                <DropdownItem asChild><Link href="/profile"><UserIcon /> Profile & preferences</Link></DropdownItem>
                <DropdownItem asChild><Link href="/orders"><Package /> Orders</Link></DropdownItem>
                <DropdownItem asChild><Link href="/recommendations"><Wand2 /> My recommendations</Link></DropdownItem>
                <DropdownSeparator />
                <DropdownItem onSelect={logout} className="text-danger"><LogOut className="!text-danger" /> Sign out</DropdownItem>
              </DropdownContent>
            </Dropdown>
          ) : status === "anonymous" ? (
            <Button asChild size="sm" variant="gradient" className="ml-1"><Link href="/login">Sign in</Link></Button>
          ) : <div className="ml-1 size-9 rounded-full bg-surface-2" />}
        </nav>
      </div>
      <div className="mx-auto hidden h-11 max-w-7xl items-center gap-1 px-6 lg:flex">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground">
            {n.label}
          </Link>
        ))}
        <span className="mx-2 h-4 w-px bg-border" />
        {[["/recommendations", "For You"], ["/sentiment-analysis", "Sentiment Insights"], ["/compare", "Compare"]].map(([href, label]) => (
          <Link key={href} href={href} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition hover:bg-surface-2",
            pathname === href ? "text-primary" : "text-muted hover:text-foreground")}>{label}</Link>
        ))}
      </div>

      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setMobile(false)} />
          <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85%] flex-col gap-4 overflow-y-auto bg-surface p-5 shadow-lift animate-fade-up">
            <div className="flex items-center justify-between">
              <Logo />
              <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setMobile(false)}><X /></Button>
            </div>
            <SearchBox onNavigate={() => setMobile(false)} />
            <nav className="flex flex-col gap-0.5">
              {NAV.map((n) => <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2.5 font-medium hover:bg-surface-2">{n.label}</Link>)}
              <hr className="my-2" />
              {[["/ai-assistant", "AI Assistant"], ["/recommendations", "For You"], ["/sentiment-analysis", "Sentiment Insights"], ["/compare", "Compare"], ["/orders", "Orders"], ["/profile", "Profile"]].map(([h, l]) => (
                <Link key={h} href={h} className="rounded-lg px-3 py-2.5 font-medium hover:bg-surface-2">{l}</Link>
              ))}
            </nav>
            <div className="mt-auto flex items-center justify-between"><span className="text-sm text-muted">Theme</span><ThemeToggle /></div>
          </div>
        </div>
      )}
    </header>
  );
}
