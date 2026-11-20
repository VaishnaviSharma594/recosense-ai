"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { ProductImage } from "@/components/products/product-bits";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/form";
import { Badge, Card, Dialog, DialogContent, DialogTrigger } from "@/components/ui/primitives";
import { EmptyState, ErrorState, PageHeader, Spinner } from "@/components/ui/states";
import { useDebounce } from "@/hooks/use-debounce";
import { errorMessage, formatPrice } from "@/lib/utils";
import { productService } from "@/services";
import { adminService } from "@/services/admin";
import type { Category } from "@/types";

function CategoryManager() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["categories"], queryFn: productService.categories });
  const [name, setName] = React.useState("");
  const [editing, setEditing] = React.useState<Category | null>(null);
  const done = (msg: string) => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success(msg); };
  const create = useMutation({ mutationFn: () => adminService.createCategory({ name }), onSuccess: () => { setName(""); done("Category created"); }, onError: (e) => toast.error(errorMessage(e)) });
  const update = useMutation({ mutationFn: (c: Category) => adminService.updateCategory(c.id, { name: c.name, description: c.description, image_url: c.image_url }), onSuccess: () => { setEditing(null); done("Category updated"); }, onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({ mutationFn: adminService.deleteCategory, onSuccess: () => done("Category deleted"), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) create.mutate(); }}>
        <Input placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New category name" />
        <Button type="submit" loading={create.isPending} disabled={name.trim().length < 2}>Add</Button>
      </form>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {data?.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            {editing?.id === c.id ? (
              <>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-8" aria-label="Category name" />
                <Button size="sm" onClick={() => update.mutate(editing)} loading={update.isPending}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium">{c.name} <span className="text-xs text-muted">/{c.slug}</span></span>
                <Button size="icon-sm" variant="ghost" aria-label={`Rename ${c.name}`} onClick={() => setEditing(c)}><Pencil /></Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Delete ${c.name}`} className="text-danger" onClick={() => { if (confirm(`Delete category "${c.name}"?`)) remove.mutate(c.id); }}><Trash2 /></Button>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">Categories that still contain products can&apos;t be deleted.</p>
    </div>
  );
}

export default function AdminProductsPage() {
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [page, setPage] = React.useState(1);
  const dq = useDebounce(q, 300);
  const cats = useQuery({ queryKey: ["categories"], queryFn: productService.categories });
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "products", dq, category, page],
    queryFn: () => productService.list({ q: dq || undefined, category: category || undefined, page, page_size: 15, include_inactive: true, sort: "newest" }),
    placeholderData: keepPreviousData,
  });
  const del = useMutation({
    mutationFn: adminService.deleteProduct,
    onSuccess: () => { toast.success("Product deleted"); qc.invalidateQueries({ queryKey: ["admin", "products"] }); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader eyebrow="Admin" title="Products" description="Create, edit and remove catalogue items. Ratings and sentiment are computed from reviews and can't be edited."
        actions={<>
          <Dialog><DialogTrigger asChild><Button variant="outline"><FolderPlus /> Categories</Button></DialogTrigger>
            <DialogContent title="Manage categories"><CategoryManager /></DialogContent></Dialog>
          <Button asChild variant="gradient"><Link href="/admin/products/create"><Plus /> New product</Link></Button>
        </>} />
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input className="pl-9" placeholder="Search products…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search products" /></div>
          <NativeSelect className="w-48" aria-label="Filter by category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">All categories</option>{cats.data?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </NativeSelect>
        </div>
        {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading ? <Spinner />
          : data!.items.length === 0 ? <EmptyState title="No products found" />
            : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr>{["Product", "Category", "Price", "Stock", "Rating", "Sentiment", "Status", ""].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-border">
                    {data!.items.map((p) => (
                      <tr key={p.id} className="hover:bg-surface-2/50">
                        <td className="px-2 py-2.5"><div className="flex items-center gap-3"><ProductImage src={p.image_url} alt="" className="size-11 rounded-lg" />
                          <div className="min-w-0"><Link href={`/products/${p.id}`} className="line-clamp-1 font-medium hover:text-primary">{p.name}</Link><p className="text-xs text-muted">{p.brand} · #{p.id}</p></div></div></td>
                        <td className="px-2">{p.category.name}</td>
                        <td className="px-2"><span className="font-medium">{formatPrice(p.final_price)}</span>{p.discount_percent > 0 && <span className="block text-xs text-muted">-{p.discount_percent}%</span>}</td>
                        <td className="px-2">{p.stock === 0 ? <Badge variant="danger">Out</Badge> : p.stock}</td>
                        <td className="px-2">{p.review_count ? `${p.rating_avg.toFixed(1)}★ (${p.review_count})` : "—"}</td>
                        <td className="px-2">{p.review_count ? `${p.positive_pct.toFixed(0)}%` : "—"}</td>
                        <td className="px-2"><Badge variant={p.is_active ? "success" : "muted"}>{p.is_active ? "Active" : "Hidden"}</Badge></td>
                        <td className="px-2 text-right">
                          <Button asChild size="icon-sm" variant="ghost" aria-label={`Edit ${p.name}`}><Link href={`/admin/products/create?id=${p.id}`}><Pencil /></Link></Button>
                          <Button size="icon-sm" variant="ghost" className="text-danger" aria-label={`Delete ${p.name}`}
                            onClick={() => { if (confirm(`Delete "${p.name}"? Its reviews will also be removed.`)) del.mutate(p.id); }}><Trash2 /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        {data && data.pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">{data.total} products</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span>Page {data.page} / {data.pages}</span>
              <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
