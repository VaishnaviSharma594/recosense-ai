"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

const KEY = "rs_compare";
const EVENT = "rs:compare";
export const MAX_COMPARE = 4;

/* Tiny localStorage-backed store read with useSyncExternalStore (no hydration mismatch). */
function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function write(ids: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

interface CompareState {
  ids: number[];
  toggle: (id: number) => void;
  has: (id: number) => boolean;
  clear: () => void;
  set: (ids: number[]) => void;
}

const Ctx = React.createContext<CompareState | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const raw = React.useSyncExternalStore(subscribe, read, () => "[]");
  const ids = React.useMemo<number[]>(() => {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)).slice(0, MAX_COMPARE) : [];
    } catch {
      return [];
    }
  }, [raw]);

  const value: CompareState = {
    ids,
    has: (id) => ids.includes(id),
    toggle: (id) => {
      if (ids.includes(id)) {
        write(ids.filter((x) => x !== id));
        toast("Removed from comparison");
      } else if (ids.length >= MAX_COMPARE) {
        toast.error(`You can compare up to ${MAX_COMPARE} products`);
      } else {
        write([...ids, id]);
        toast.success("Added to comparison", { action: { label: "Compare", onClick: () => router.push("/compare") } });
      }
    },
    clear: () => write([]),
    set: (next) => write(next.slice(0, MAX_COMPARE)),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompare() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useCompare must be used inside CompareProvider");
  return ctx;
}
