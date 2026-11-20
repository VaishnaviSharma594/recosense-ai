"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";

import { tokenStore } from "@/lib/api";
import { authService } from "@/services";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  status: "loading" | "authenticated" | "anonymous";
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  setUser: (u: User) => void;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [status, setStatus] = React.useState<AuthState["status"]>("loading");
  const qc = useQueryClient();
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;
    const pending = tokenStore.get() ? authService.me() : Promise.reject(new Error("no token"));
    pending
      .then((u) => { if (!cancelled) { setUser(u); setStatus("authenticated"); } })
      .catch(() => { if (!cancelled) { tokenStore.clear(); setStatus("anonymous"); } });
    const onLogout = () => { setUser(null); setStatus("anonymous"); qc.clear(); };
    window.addEventListener("rs:logout", onLogout);
    return () => { cancelled = true; window.removeEventListener("rs:logout", onLogout); };
  }, [qc]);

  const finish = React.useCallback((token: string, u: User) => {
    tokenStore.set(token);
    qc.clear();
    setUser(u);
    setStatus("authenticated");
    return u;
  }, [qc]);

  const value = React.useMemo<AuthState>(() => ({
    user,
    status,
    login: async (email, password) => {
      const r = await authService.login(email, password);
      return finish(r.access_token, r.user);
    },
    register: async (name, email, password) => {
      const r = await authService.register(name, email, password);
      return finish(r.access_token, r.user);
    },
    logout: () => {
      tokenStore.clear();
      setUser(null);
      setStatus("anonymous");
      qc.clear();
      router.push("/");
    },
    setUser,
  }), [user, status, finish, qc, router]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
