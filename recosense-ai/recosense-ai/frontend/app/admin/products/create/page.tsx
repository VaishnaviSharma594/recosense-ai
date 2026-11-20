"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ProductImage } from "@/components/products/product-bits";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, Switch } from "@/components/ui/primitives";
import { PageHeader, Spinner } from "@/components/ui/states";
import { errorMessage, formatPrice } from "@/lib/utils";
import { productService } from "@/services";
import { adminService } from "@/services/admin";

const url = z.string().trim().refine((v) => v.startsWith("/") || /^https?:\/\/\S+$/.test(v), "Use an https:// URL or a /local path");
const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(200),
  brand: z.string().trim().min(1, "Brand is required").max(100),
  category_id: z.coerce.number<number>().int().positive("Choose a category"),
  price: z.coerce.number<number>().positive("Price must be greater than 0").max(1_000_000),
  discount_percent: z.coerce.number<number>().int().min(0).max(90, "Max 90%"),
  description: z.string().max(5000),
  material: z.string().max(120),
  color: z.string().max(60),
  tags: z.string().max(400),
  image_url: url.or(z.literal("")),
  is_active: z.boolean(),
  variants: z.array(z.object({ size: z.string().trim().min(1, "Size"), color: z.string().trim().min(1, "Colour"), stock: z.coerce.number<number>().int().min(0) }))
    .refine((v) => new Set(v.map((x) => `${x.size}|${x.color}`.toLowerCase())).size === v.length, "Each size + colour must be unique"),
});
type Values = z.infer<typeof schema>;

function ProductForm() {
  const id = Number(useSearchParams().get("id")) || null;
  const router = useRouter();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories"], queryFn: productService.categories });
  const existing = useQuery({ queryKey: ["product", id], queryFn: () => productService.get(id!), enabled: !!id });
  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", brand: "", category_id: 0, price: 0, discount_percent: 0, description: "", material: "", color: "", tags: "", image_url: "", is_active: true, variants: [{ size: "M", color: "", stock: 10 }] },
  });
  const variants = useFieldArray({ control, name: "variants" });

  React.useEffect(() => {
    const p = existing.data;
    if (p) reset({
      name: p.name, brand: p.brand, category_id: p.category.id, price: p.price, discount_percent: p.discount_percent, description: p.description,
      material: p.material ?? "", color: p.color ?? "", tags: p.tags.join(", "), image_url: p.image_url ?? "", is_active: p.is_active,
      variants: p.variants.map((v) => ({ size: v.size, color: v.color, stock: v.stock })),
    });
  }, [existing.data, reset]);

  const price = Number(watch("price")) || 0, discount = Number(watch("discount_percent")) || 0;
  const image = watch("image_url");

  const onSubmit = async (v: Values) => {
    const body = {
      name: v.name, brand: v.brand, category_id: v.category_id, price: v.price, discount_percent: v.discount_percent, description: v.description,
      material: v.material || null, color: v.color || null, is_active: v.is_active,
      tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20), image_urls: v.image_url ? [v.image_url] : [], variants: v.variants,
    };
    try {
      const p = id ? await adminService.updateProduct(id, body) : await adminService.createProduct(body);
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["product", p.id] });
      toast.success(id ? "Product updated" : "Product created");
      router.push("/admin/products");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (id && existing.isLoading) return <Spinner />;
  return (
    <>
      <Button asChild variant="link" className="mb-2"><Link href="/admin/products"><ArrowLeft /> Back to products</Link></Button>
      <PageHeader title={id ? "Edit product" : "Create product"} description={id ? `Editing #${id}` : "New products start with no reviews — they're handled by content-based cold-start recommendations."} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Product name" htmlFor="name" error={errors.name?.message}><Input id="name" {...register("name")} aria-invalid={!!errors.name} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Brand" htmlFor="brand" error={errors.brand?.message}><Input id="brand" {...register("brand")} aria-invalid={!!errors.brand} /></Field>
                <Field label="Category" htmlFor="cat" error={errors.category_id?.message}>
                  <NativeSelect id="cat" {...register("category_id")} aria-invalid={!!errors.category_id}>
                    <option value={0}>Select…</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </NativeSelect>
                </Field>
              </div>
              <Field label="Description" htmlFor="desc" error={errors.description?.message}><Textarea id="desc" rows={4} {...register("description")} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Material" htmlFor="mat"><Input id="mat" {...register("material")} /></Field>
                <Field label="Colour" htmlFor="col"><Input id="col" {...register("color")} /></Field>
                <Field label="Tags" htmlFor="tags" hint="Comma-separated"><Input id="tags" {...register("tags")} /></Field>
              </div>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Size & stock variants</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {variants.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[1fr_1fr_100px_auto] items-start gap-2">
                  <Input placeholder="Size" aria-label={`Variant ${i + 1} size`} {...register(`variants.${i}.size`)} aria-invalid={!!errors.variants?.[i]?.size} />
                  <Input placeholder="Colour" aria-label={`Variant ${i + 1} colour`} {...register(`variants.${i}.color`)} aria-invalid={!!errors.variants?.[i]?.color} />
                  <Input type="number" min={0} placeholder="Stock" aria-label={`Variant ${i + 1} stock`} {...register(`variants.${i}.stock`)} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove variant" onClick={() => variants.remove(i)}><Trash2 /></Button>
                </div>
              ))}
              {errors.variants?.root?.message && <p className="text-xs text-danger">{errors.variants.root.message}</p>}
              {typeof errors.variants?.message === "string" && <p className="text-xs text-danger">{errors.variants.message}</p>}
              <Button type="button" variant="outline" size="sm" onClick={() => variants.append({ size: "", color: watch("color") || "", stock: 0 })}><Plus /> Add variant</Button>
              <p className="text-xs text-muted">Total stock is the sum of variant stock. Leave empty for one-size items without variants.</p>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Price (₹)" htmlFor="price" error={errors.price?.message}><Input id="price" type="number" step="0.01" min={0} {...register("price")} aria-invalid={!!errors.price} /></Field>
              <Field label="Discount (%)" htmlFor="disc" error={errors.discount_percent?.message}><Input id="disc" type="number" min={0} max={90} {...register("discount_percent")} /></Field>
              <p className="text-sm">Selling price: <span className="font-bold">{formatPrice(price * (100 - discount) / 100)}</span></p>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Image</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ProductImage src={image || null} alt="Preview" className="aspect-[4/5] w-full rounded-xl" />
              <Field label="Image URL" htmlFor="img" error={errors.image_url?.message} hint="https:// URL or a path under /images/…"><Input id="img" {...register("image_url")} /></Field>
            </CardContent>
          </Card>
          <Card className="flex items-center justify-between p-5">
            <div><p className="font-medium">Visible in store</p><p className="text-xs text-muted">Hidden products can&apos;t be purchased.</p></div>
            <Switch checked={watch("is_active")} onCheckedChange={(v) => setValue("is_active", v)} aria-label="Visible in store" />
          </Card>
          <Button type="submit" variant="gradient" size="lg" className="w-full" loading={isSubmitting}>{id ? "Save changes" : "Create product"}</Button>
        </div>
      </form>
    </>
  );
}

export default function CreateProductPage() {
  return <React.Suspense fallback={<Spinner />}><ProductForm /></React.Suspense>;
}
