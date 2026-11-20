import { Quote, Sparkles } from "lucide-react";

import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-secondary/50 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-primary/50 blur-3xl" />
        <span className="relative inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
          <Sparkles className="size-3.5" /> Shop Smarter. Choose Better. Powered by AI.
        </span>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight">Recommendations backed by what real customers say.</h2>
          <p className="mt-4 text-white/70">RecoSense reads thousands of reviews, understands fit, fabric and comfort, and explains every product it suggests.</p>
          <figure className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <Quote className="size-5 text-white/50" />
            <blockquote className="mt-2 text-sm text-white/80">“The dress is beautiful and the fabric quality is excellent, but the fitting is disappointing.”</blockquote>
            <figcaption className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-violet-500/30 px-2 py-0.5">Mixed</span>
              <span className="rounded-full bg-emerald-500/25 px-2 py-0.5">+ Design</span>
              <span className="rounded-full bg-emerald-500/25 px-2 py-0.5">+ Fabric quality</span>
              <span className="rounded-full bg-red-500/25 px-2 py-0.5">− Fit</span>
            </figcaption>
          </figure>
        </div>
        <p className="relative text-xs text-white/50">Aspect-based sentiment example produced by the RecoSense model.</p>
      </aside>
    </div>
  );
}
