"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Columns3, LineChart, Package, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";

import { AssistantBanner, CategoryTiles, HighlightRails, PersonalRails } from "@/components/home/sections";
import { PreferencesDialog } from "@/components/recommendations/preferences-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { authService } from "@/services";

export default function HomePage() {
  const { user } = useAuth();
  const prefs = useQuery({ queryKey: ["preferences"], queryFn: authService.preferences });
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="flex flex-col gap-6 rounded-3xl border border-border bg-surface p-6 shadow-soft sm:p-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted">{greet},</p>
          <h1 className="mt-1 text-3xl font-bold">{user?.full_name.split(" ")[0]} <span className="text-gradient">✦</span></h1>
          <p className="mt-2 max-w-lg text-sm text-muted">Your feed adapts as you browse, save and buy. Every pick comes with the reason it was chosen.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:w-auto">
          {[["/recommendations", Wand2, "For you"], ["/ai-assistant", Sparkles, "Ask AI"], ["/compare", Columns3, "Compare"], ["/orders", Package, "Orders"]].map(([href, Icon, label]) => {
            const I = Icon as typeof Wand2;
            return (
              <Link key={href as string} href={href as string} className="flex flex-col items-center gap-2 rounded-2xl border border-border px-4 py-3 text-xs font-semibold transition hover:border-primary/40 hover:bg-primary/5">
                <I className="size-5 text-primary" />{label as string}
              </Link>
            );
          })}
        </div>
      </section>

      {prefs.data && !prefs.data.onboarding_completed && (
        <section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center">
          <div className="flex gap-3">
            <LineChart className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Tell us what you like</p>
              <p className="text-sm text-muted">Pick favourite categories and a price range so your first recommendations fit you — no history needed.</p>
            </div>
          </div>
          <PreferencesDialog trigger={<Button variant="gradient">Set preferences <ArrowRight /></Button>} />
        </section>
      )}

      <PersonalRails />
      <CategoryTiles />
      <HighlightRails show={["trending", "positive_sentiment"]} />
      <AssistantBanner />
    </div>
  );
}
