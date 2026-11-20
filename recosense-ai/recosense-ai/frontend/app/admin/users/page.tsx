"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/form";
import { Badge, Card, Switch } from "@/components/ui/primitives";
import { ErrorState, PageHeader, Spinner } from "@/components/ui/states";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { errorMessage, formatDate } from "@/lib/utils";
import { adminService } from "@/services/admin";

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const dq = useDebounce(q, 300);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "users", dq, page], queryFn: () => adminService.users({ q: dq || undefined, page }), placeholderData: keepPreviousData,
  });
  const update = useMutation({
    mutationFn: (v: { id: number; is_active?: boolean; role?: string }) => adminService.updateUser(v.id, v),
    onSuccess: () => { toast.success("User updated"); qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <>
      <PageHeader eyebrow="Admin" title="Users" description="View customers, change roles and deactivate accounts. Demo accounts are labelled." />
      <Card className="p-4">
        <div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Search name or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search users" /></div>
        {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr>{["User", "Joined", "Role", "Type", "Active", ""].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {data!.items.map((u) => (
                  <tr key={u.id}>
                    <td className="px-2 py-2.5"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-surface-2 text-xs font-bold">{u.full_name.charAt(0)}</span>
                      <div><p className="font-medium">{u.full_name}{u.id === me?.id && <span className="text-xs text-muted"> (you)</span>}</p><p className="text-xs text-muted">{u.email}</p></div></div></td>
                    <td className="px-2 text-muted">{formatDate(u.created_at)}</td>
                    <td className="px-2">
                      <NativeSelect className="h-8 w-32 text-xs" aria-label={`Role for ${u.email}`} value={u.role} disabled={u.id === me?.id}
                        onChange={(e) => update.mutate({ id: u.id, role: e.target.value })}><option value="customer">Customer</option><option value="admin">Admin</option></NativeSelect>
                    </td>
                    <td className="px-2">{u.is_demo ? <Badge variant="warning">Demo</Badge> : <Badge variant="success">Registered</Badge>}</td>
                    <td className="px-2"><Switch checked={u.is_active} disabled={u.id === me?.id} aria-label={`Active: ${u.email}`} onCheckedChange={(v) => update.mutate({ id: u.id, is_active: v })} /></td>
                    <td className="px-2 text-right"><Button asChild size="sm" variant="ghost"><Link href={`/admin/recommendations?user=${u.id}`}>Recommendations</Link></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm"><span className="text-muted">{data.total} users</span>
            <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span>Page {data.page} / {data.pages}</span><Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
        )}
      </Card>
    </>
  );
}
