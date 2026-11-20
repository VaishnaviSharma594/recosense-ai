"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { errorMessage } from "@/lib/utils";
import { authService } from "@/services";

const requestSchema = z.object({ email: z.string().trim().email("Enter a valid email address") });
const resetSchema = z.object({
  password: z.string().min(8, "At least 8 characters").regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number"),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

function RequestForm() {
  const [result, setResult] = React.useState<{ message: string; dev_reset_link?: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof requestSchema>>({ resolver: zodResolver(requestSchema) });
  if (result) {
    return (
      <div>
        <MailCheck className="size-10 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted">{result.message}</p>
        {result.dev_reset_link && (
          <div className="mt-5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
            <p className="font-semibold">Development mode — no email service is configured.</p>
            <Link href={result.dev_reset_link.replace(/^https?:\/\/[^/]+/, "")} className="mt-1 inline-block font-semibold text-primary underline">Open your reset link</Link>
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      <h1 className="text-3xl font-bold">Forgot password?</h1>
      <p className="mt-2 text-sm text-muted">Enter your email and we&apos;ll generate a secure reset link.</p>
      <form className="mt-8 space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
        setError(null);
        try { setResult(await authService.forgot(v.email)); } catch (e) { setError(errorMessage(e)); }
      })}>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Button type="submit" variant="gradient" size="lg" className="w-full" loading={isSubmitting}>Send reset link</Button>
      </form>
    </>
  );
}

function ResetForm({ token }: { token: string }) {
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  if (done) {
    return (
      <div>
        <CheckCircle2 className="size-10 text-success" />
        <h1 className="mt-4 text-2xl font-bold">Password updated</h1>
        <p className="mt-2 text-sm text-muted">You can now sign in with your new password.</p>
        <Button asChild variant="gradient" className="mt-6"><Link href="/login">Go to sign in</Link></Button>
      </div>
    );
  }
  return (
    <>
      <h1 className="text-3xl font-bold">Choose a new password</h1>
      <form className="mt-8 space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
        setError(null);
        try { await authService.reset(token, v.password); setDone(true); } catch (e) { setError(errorMessage(e)); }
      })}>
        {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <Field label="New password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} />
        </Field>
        <Button type="submit" variant="gradient" size="lg" className="w-full" loading={isSubmitting}>Reset password</Button>
      </form>
    </>
  );
}

function Inner() {
  const token = useSearchParams().get("token");
  return (
    <>
      {token ? <ResetForm token={token} /> : <RequestForm />}
      <p className="mt-6 text-center text-sm text-muted"><Link href="/login" className="font-semibold text-primary hover:underline">Back to sign in</Link></p>
    </>
  );
}

export default function ForgotPasswordPage() {
  return <React.Suspense><Inner /></React.Suspense>;
}
