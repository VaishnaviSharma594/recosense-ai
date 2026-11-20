"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/form";
import { Dialog, DialogContent, DialogTrigger, Slider } from "@/components/ui/primitives";
import { Spinner } from "@/components/ui/states";
import { cn, errorMessage, formatPrice } from "@/lib/utils";
import { authService, productService } from "@/services";
import type { Preferences } from "@/types";

export function PreferencesForm({ onSaved }: { onSaved?: () => void }) {
  const facets = useQuery({ queryKey: ["facets", "all"], queryFn: () => productService.facets() });
  const prefs = useQuery({ queryKey: ["preferences"], queryFn: authService.preferences });
  if (!prefs.data || !facets.data) return <Spinner />;
  const max = Math.ceil(facets.data.max_price / 500) * 500;
  return <PreferencesFormInner key={prefs.dataUpdatedAt} prefs={prefs.data} max={max} onSaved={onSaved} />;
}

function PreferencesFormInner({ prefs, max, onSaved }: { prefs: Preferences; max: number; onSaved?: () => void }) {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories"], queryFn: productService.categories });
  const [selected, setSelected] = React.useState<string[]>(prefs.preferred_categories);
  const [range, setRange] = React.useState<[number, number]>([prefs.min_price ?? 0, Math.min(prefs.max_price ?? max, max)]);

  const save = useMutation({
    mutationFn: () => authService.updatePreferences({
      ...prefs, preferred_categories: selected, min_price: range[0], max_price: range[1],
    }),
    onSuccess: (p) => {
      qc.setQueryData(["preferences"], p);
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      toast.success("Preferences saved — recommendations updated");
      onSaved?.();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-6">
      <div>
        <Label>Favourite categories</Label>
        <div className="flex flex-wrap gap-2">
          {cats.data?.map((c) => {
            const on = selected.includes(c.slug);
            return (
              <button type="button" key={c.slug} aria-pressed={on}
                onClick={() => setSelected((s) => (on ? s.filter((x) => x !== c.slug) : [...s, c.slug]))}
                className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                  on ? "border-primary bg-primary text-white" : "border-border hover:border-primary/50")}>
                {on && <Check className="size-3.5" />}{c.name}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between"><Label>Preferred price range</Label>
          <span className="text-sm font-semibold">{formatPrice(range[0])} – {formatPrice(range[1])}</span></div>
        <Slider min={0} max={max} step={100} value={range} onValueChange={(v) => setRange([v[0], v[1]])} className="mt-3" />
      </div>
      <Button type="submit" variant="gradient" className="w-full" loading={save.isPending}>Save preferences</Button>
    </form>
  );
}

export function PreferencesDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Your style preferences" description="Used for cold-start recommendations and to boost matching products.">
        <PreferencesForm onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
