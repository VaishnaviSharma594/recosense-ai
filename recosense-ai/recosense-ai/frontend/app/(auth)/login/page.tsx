"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Info } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/utils";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type Values = z.infer<typeof schema>;

function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: Values) => {
    setError(null);
    try {
      const user = await login(v.email, v.password);
      toast.success(`Welcome back, ${user.full_name.split(" ")[0]}!`);
      router.replace(safeNext(params.get("next"), user.role === "admin" ? "/admin/dashboard" : "/home"));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const fill = (email: string, password: string) => { setValue("email", email); setValue("password", password); };

  return (
    <>
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">Sign in to see recommendations picked for you.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" className="pr-10" aria-invalid={!!errors.password} {...register("password")} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-foreground">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">Forgot password?</Link></div>
        <Button type="submit" variant="gradient" size="lg" className="w-full" loading={isSubmitting}>Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">New to RecoSense? <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link></p>
      <div className="mt-8 rounded-2xl border border-border bg-surface-2/60 p-4 text-xs">
        <p className="flex items-center gap-1.5 font-semibold"><Info className="size-3.5" /> Demo accounts (sample data)</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => fill("demo@recosense.ai", "Demo@1234")} className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-left hover:border-primary/50">
            <span className="block font-semibold">Customer</span><span className="text-muted">demo@recosense.ai</span>
          </button>
          <button type="button" onClick={() => fill("admin@recosense.ai", "Admin@1234")} className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-left hover:border-primary/50">
            <span className="block font-semibold">Admin</span><span className="text-muted">admin@recosense.ai</span>
          </button>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return <React.Suspense><LoginForm /></React.Suspense>;
}
