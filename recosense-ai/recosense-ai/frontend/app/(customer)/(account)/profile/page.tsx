"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTheme } from "next-themes";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ProductGrid } from "@/components/products/product-card";
import { PreferencesForm } from "@/components/recommendations/preferences-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { PageHeader } from "@/components/ui/states";
import { useAuth } from "@/hooks/use-auth";
import { useWishlist } from "@/hooks/use-shop";
import { errorMessage, formatDate, formatPrice } from "@/lib/utils";
import { authService, orderService } from "@/services";

const profileSchema = z.object({ full_name: z.string().trim().min(2).max(120), phone: z.string().trim().regex(/^[0-9+\-\s()]*$/, "Digits, spaces, + and - only").max(30) });
const pwSchema = z.object({
  current_password: z.string().min(1, "Required"),
  new_password: z.string().min(8, "At least 8 characters").regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number"),
  confirm: z.string(),
}).refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

function ProfileForm() {
  const { user, setUser } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema), defaultValues: { full_name: user?.full_name ?? "", phone: user?.phone ?? "" },
  });
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
      try { const u = await authService.updateMe(v); setUser(u); reset(v); toast.success("Profile updated"); } catch (e) { toast.error(errorMessage(e)); }
    })}>
      <Field label="Full name" htmlFor="fn" error={errors.full_name?.message}><Input id="fn" {...register("full_name")} /></Field>
      <Field label="Email" htmlFor="em" hint="Email changes aren't supported in this demo."><Input id="em" value={user?.email ?? ""} disabled /></Field>
      <Field label="Phone" htmlFor="ph" error={errors.phone?.message}><Input id="ph" type="tel" {...register("phone")} /></Field>
      <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button>
    </form>
  );
}

function PasswordForm() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) });
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
      try { await authService.changePassword(v.current_password, v.new_password); reset(); toast.success("Password changed"); } catch (e) { toast.error(errorMessage(e)); }
    })}>
      <Field label="Current password" htmlFor="cp" error={errors.current_password?.message}><Input id="cp" type="password" autoComplete="current-password" {...register("current_password")} /></Field>
      <Field label="New password" htmlFor="np" error={errors.new_password?.message}><Input id="np" type="password" autoComplete="new-password" {...register("new_password")} /></Field>
      <Field label="Confirm new password" htmlFor="cf" error={errors.confirm?.message}><Input id="cf" type="password" autoComplete="new-password" {...register("confirm")} /></Field>
      <Button type="submit" loading={isSubmitting}>Update password</Button>
    </form>
  );
}

function Settings() {
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const prefs = useQuery({ queryKey: ["preferences"], queryFn: authService.preferences });
  const save = useMutation({
    mutationFn: (email_notifications: boolean) => authService.updatePreferences({ ...prefs.data!, email_notifications }),
    onSuccess: (p) => { qc.setQueryData(["preferences"], p); toast.success("Settings saved"); },
  });
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div><p className="font-medium">Email notifications</p><p className="text-sm text-muted">Order updates and price drops on wishlist items (no emails are sent in the demo).</p></div>
        <Switch checked={prefs.data?.email_notifications ?? true} disabled={!prefs.data} onCheckedChange={(v) => save.mutate(v)} aria-label="Email notifications" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div><p className="font-medium">Theme</p><p className="text-sm text-muted">Light, dark or follow your system.</p></div>
        <div className="flex gap-1">{["light", "dark", "system"].map((t) => <button key={t} onClick={() => setTheme(t)} className={`chip capitalize ${theme === t ? "chip-on" : ""}`}>{t}</button>)}</div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const wishlist = useWishlist();
  const orders = useQuery({ queryKey: ["orders"], queryFn: orderService.list });
  const spent = (orders.data ?? []).filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader title="Your account" description={user ? `Member since ${formatDate(user.created_at)}` : undefined}
        actions={user?.is_demo ? <Badge variant="warning">Demo account</Badge> : undefined} />
      <div className="mb-8 grid grid-cols-3 gap-3">
        {[["Orders", orders.data?.length ?? "—"], ["Saved products", wishlist.data?.length ?? "—"], ["Total spent", orders.data ? formatPrice(spent) : "—"]].map(([k, v]) => (
          <Card key={k as string} className="p-4"><p className="text-xs text-muted">{k}</p><p className="mt-1 font-display text-xl font-bold">{v}</p></Card>
        ))}
      </div>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="saved">Saved products</TabsTrigger><TabsTrigger value="security">Security</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><Card><CardHeader><CardTitle>Personal details</CardTitle></CardHeader><CardContent><ProfileForm /></CardContent></Card></TabsContent>
        <TabsContent value="preferences"><Card><CardHeader><CardTitle>Shopping preferences</CardTitle><CardDescription>Used for cold-start and preference-matched recommendations.</CardDescription></CardHeader><CardContent><PreferencesForm /></CardContent></Card></TabsContent>
        <TabsContent value="saved">
          {wishlist.data?.length === 0 ? <p className="text-sm text-muted">No saved products yet. <Link href="/products" className="text-primary">Browse</Link></p>
            : <ProductGrid products={wishlist.data?.map((w) => w.product)} loading={wishlist.isLoading} />}
        </TabsContent>
        <TabsContent value="security"><Card><CardHeader><CardTitle>Change password</CardTitle></CardHeader><CardContent><PasswordForm /></CardContent></Card></TabsContent>
        <TabsContent value="settings"><Card><CardHeader><CardTitle>Account settings</CardTitle></CardHeader><CardContent><Settings /></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
