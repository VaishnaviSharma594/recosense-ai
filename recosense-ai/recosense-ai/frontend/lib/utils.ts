import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const formatPrice = (v: number) => inr.format(Math.round(v));

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  new Date(iso).toLocaleDateString("en-IN", opts);

export const pct = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined ? "—" : `${v.toFixed(digits)}%`;

export function sentimentTone(positivePct: number, reviewCount: number): "positive" | "neutral" | "negative" | "none" {
  if (!reviewCount) return "none";
  if (positivePct >= 70) return "positive";
  if (positivePct >= 50) return "neutral";
  return "negative";
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
