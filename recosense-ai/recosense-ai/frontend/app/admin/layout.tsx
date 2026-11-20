"use client";

import { BarChart3, Boxes, Brain, LayoutDashboard, LogOut, Menu, MessageSquareText, Store, Users, Wand2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { RequireAuth } from "@/components/layout/guards";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/navbar";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/products", label: "Products", icon: Boxes },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquareText },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/recommendations", label: "Recommendations", icon: Wand2 },
  { href: "/admin/model-performance", label: "Model performance", icon: Brain },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between px-2"><Logo href="/admin/dashboard" /></div>
      <nav className="flex flex-col gap-0.5" aria-label="Admin">
        {NAV.map((n) => {
          const active = pathname === n.href || (n.href !== "/admin/dashboard" && pathname.startsWith(n.href));
          return (
            <Link key={n.href} href={n.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground")}>
              <n.icon className="size-4" />{n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-1 border-t border-border pt-4">
        <Link href="/home" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground"><Store className="size-4" /> View store</Link>
        <button onClick={logout} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-danger"><LogOut className="size-4" /> Sign out</button>
        <div className="flex items-center gap-3 px-3 pt-3">
          <span className="grid size-8 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white">{user?.full_name.charAt(0)}</span>
          <div className="min-w-0 flex-1 text-xs"><p className="truncate font-semibold">{user?.full_name}</p><p className="truncate text-muted">{user?.email}</p></div>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [open, setOpen] = React.useState(false);
  return (
    <RequireAuth admin>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-surface lg:block"><Sidebar /></aside>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
            <div className="absolute inset-0 bg-slate-950/40" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-64 bg-surface shadow-lift">
              <button className="absolute right-3 top-4 rounded-lg p-1.5 hover:bg-surface-2" aria-label="Close menu" onClick={() => setOpen(false)}><X className="size-4" /></button>
              <Sidebar onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:hidden">
            <button className="rounded-lg p-2 hover:bg-surface-2" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="size-5" /></button>
            <Logo href="/admin/dashboard" />
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
