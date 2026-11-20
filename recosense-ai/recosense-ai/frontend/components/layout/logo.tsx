import Link from "next/link";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="rs-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#rs-g)" />
      <path d="M10 23V9h6.2a4.3 4.3 0 0 1 1.1 8.45L21.5 23h-3.3l-3.8-5.3H13V23h-3Zm3-8h3a1.75 1.75 0 0 0 0-3.5h-3V15Z" fill="#fff" />
      <path d="M24.2 6.2l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7.7-1.7Z" fill="#fff" opacity=".9" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 font-display", className)} aria-label="RecoSense AI home">
      <LogoMark />
      <span className="text-lg font-bold tracking-tight">
        RecoSense<span className="text-gradient"> AI</span>
      </span>
    </Link>
  );
}
