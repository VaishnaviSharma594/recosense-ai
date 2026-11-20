"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import * as React from "react";
import { Toaster } from "sonner";

import { ApiError } from "@/lib/api";
import { AuthProvider } from "@/hooks/use-auth";
import { CompareProvider } from "@/hooks/use-compare";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
    },
  }));
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <CompareProvider>
            {children}
            <Toaster position="bottom-right" richColors closeButton toastOptions={{ className: "font-sans" }} />
          </CompareProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
