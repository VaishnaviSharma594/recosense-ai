"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Columns3, MessageSquarePlus, Send, Sparkles, Trash2, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ProductImage, RatingStars } from "@/components/products/product-bits";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/states";
import { useCompare } from "@/hooks/use-compare";
import { cn, errorMessage, formatPrice } from "@/lib/utils";
import { chatService } from "@/services";
import type { ChatMessage } from "@/types";

const STARTERS = [
  "Suggest dresses under ₹2,000",
  "Show products with excellent fabric quality",
  "Which product has the best customer reviews?",
  "Find dresses with positive sentiment",
  "Which products have complaints about fitting?",
  "Suggest products similar to my wishlist",
  "Black jeans between ₹1,500 and ₹2,500",
  "Recommend something for me",
];

function Bubble({ m, onSend }: { m: ChatMessage; onSend: (t: string) => void }) {
  const compare = useCompare();
  const router = useRouter();
  const mine = m.role === "user";
  const products = m.payload.products ?? [];
  return (
    <div className={cn("flex gap-3 animate-fade-up", mine && "flex-row-reverse")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", mine ? "bg-surface-2" : "bg-brand-gradient text-white")}>
        {mine ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div className={cn("min-w-0 max-w-[85%] space-y-3", mine && "items-end text-right")}>
        <div className={cn("inline-block whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          mine ? "rounded-tr-sm bg-primary text-white" : "rounded-tl-sm border border-border bg-surface")}>{m.content}</div>
        {m.payload.notes?.map((n) => <p key={n} className="text-xs text-muted">{n}</p>)}
        {products.length > 0 && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {products.map(({ product: p, reasons }) => (
              <Link key={p.id} href={`/products/${p.id}`} className="flex gap-3 rounded-xl border border-border bg-surface p-2.5 text-left transition hover:border-primary/40 hover:shadow-soft">
                <ProductImage src={p.image_url} alt={p.name} className="h-24 w-20 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <div className="flex items-center gap-2"><span className="text-sm font-bold">{formatPrice(p.final_price)}</span><RatingStars rating={p.rating_avg} /></div>
                  <ul className="mt-1 space-y-0.5">
                    {reasons.slice(0, 3).map((r) => <li key={r} className="flex gap-1 text-[11px] text-muted"><Sparkles className="mt-0.5 size-2.5 shrink-0 text-primary" />{r}</li>)}
                  </ul>
                </div>
              </Link>
            ))}
          </div>
        )}
        {m.payload.compare && (
          <Button size="sm" variant="outline" onClick={() => { compare.set(m.payload.compare!.ids); router.push("/compare"); }}>
            <Columns3 /> Open full comparison
          </Button>
        )}
        {!!m.payload.suggestions?.length && (
          <div className="flex flex-wrap gap-1.5">
            {m.payload.suggestions.map((s) => <button key={s} onClick={() => onSend(s)} className="chip text-xs">{s}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const qc = useQueryClient();
  const [conversationId, setConversationId] = React.useState<number | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const endRef = React.useRef<HTMLDivElement>(null);
  const history = useQuery({ queryKey: ["chat-history"], queryFn: chatService.history });

  const send = useMutation({
    mutationFn: (text: string) => chatService.send(text, conversationId),
    onMutate: (text) => {
      setMessages((m) => [...m, { id: -Date.now(), role: "user", content: text, payload: {}, created_at: new Date().toISOString() }]);
      setInput("");
    },
    onSuccess: (r) => {
      setConversationId(r.conversation_id);
      setMessages((m) => [...m.filter((x) => x.id > 0), r.user_message, r.reply]);
      qc.invalidateQueries({ queryKey: ["chat-history"] });
    },
    onError: (e) => { toast.error(errorMessage(e)); setMessages((m) => m.filter((x) => x.id > 0)); },
  });
  const remove = useMutation({
    mutationFn: chatService.remove,
    onSuccess: (_, id) => { if (id === conversationId) { setConversationId(null); setMessages([]); } qc.invalidateQueries({ queryKey: ["chat-history"] }); },
  });

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, send.isPending]);
  const submit = (text: string) => { const t = text.trim(); if (t && !send.isPending) send.mutate(t); };

  return (
    <div className="mx-auto grid h-[calc(100vh-7rem)] max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_1fr]">
      <aside className="hidden flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-3 lg:flex">
        <Button variant="gradient" onClick={() => { setConversationId(null); setMessages([]); }}><MessageSquarePlus /> New chat</Button>
        <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">History</p>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {history.isLoading ? <Spinner /> : history.data?.length === 0 ? <p className="px-2 text-sm text-muted">No conversations yet.</p>
            : history.data?.map((c) => (
              <div key={c.id} className={cn("group flex items-center gap-1 rounded-lg pr-1 hover:bg-surface-2", c.id === conversationId && "bg-surface-2")}>
                <button className="flex-1 cursor-pointer truncate px-2.5 py-2 text-left text-sm" onClick={() => { setConversationId(c.id); setMessages(c.messages); }}>{c.title}</button>
                <button aria-label="Delete conversation" onClick={() => remove.mutate(c.id)} className="cursor-pointer rounded p-1 text-muted opacity-0 hover:text-danger group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
              </div>
            ))}
        </div>
      </aside>
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface-2/40">
        <header className="flex items-center gap-3 border-b border-border bg-surface px-5 py-3">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-white"><Bot className="size-5" /></span>
          <div><h1 className="text-base font-semibold">RecoSense shopping assistant</h1>
            <p className="text-xs text-muted">Retrieval-based: parses your request, queries the catalogue & review sentiment. No paid AI API.</p></div>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5" aria-live="polite">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-xl py-8 text-center">
              <Sparkles className="mx-auto size-10 text-primary" />
              <h2 className="mt-3 text-xl font-bold">What are you shopping for?</h2>
              <p className="mt-1 text-sm text-muted">Mention a category, budget, colour, brand or quality like fit or fabric.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => <button key={s} onClick={() => submit(s)} className="cursor-pointer rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm transition hover:border-primary/50 hover:bg-primary/5">{s}</button>)}
              </div>
            </div>
          ) : messages.map((m) => <Bubble key={m.id} m={m} onSend={submit} />)}
          {send.isPending && (
            <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-brand-gradient text-white"><Bot className="size-4" /></span>
              <span className="flex gap-1 rounded-2xl border border-border bg-surface px-4 py-3">{[0, 1, 2].map((i) => <i key={i} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 120}ms` }} />)}</span></div>
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); submit(input); }} className="flex gap-2 border-t border-border bg-surface p-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder="e.g. Comfortable tops under ₹1,500" aria-label="Message"
            className="h-11 flex-1 rounded-xl border border-border bg-surface-2/60 px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
          <Button type="submit" variant="gradient" size="icon" className="size-11" disabled={!input.trim()} loading={send.isPending} aria-label="Send">{!send.isPending && <Send />}</Button>
        </form>
      </section>
    </div>
  );
}
