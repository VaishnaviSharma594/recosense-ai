import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <Logo className="justify-center" />
        <p className="mt-10 font-display text-7xl font-extrabold text-gradient">404</p>
        <h1 className="mt-3 text-2xl font-bold">This page took a different style path</h1>
        <p className="mt-2 text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="gradient"><Link href="/">Go home</Link></Button>
          <Button asChild variant="outline"><Link href="/products">Browse products</Link></Button>
        </div>
      </div>
    </main>
  );
}
