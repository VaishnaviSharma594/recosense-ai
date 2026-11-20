"use client";

import { ShieldAlert } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { EmptyState, Spinner } from "@/components/ui/states";
import { useAuth } from "@/hooks/use-auth";

/** Client-side guard (the proxy does an optimistic redirect; the API enforces authorisation). */
export function RequireAuth({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== "authenticated" || !user) return <Spinner className="min-h-[50vh]" label="Checking your session" />;
  if (admin && user.role !== "admin") {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <EmptyState icon={ShieldAlert} title="Administrators only" description="Your account doesn't have access to the admin area."
          action={{ label: "Back to shopping", href: "/home" }} />
      </div>
    );
  }
  return <>{children}</>;
}
