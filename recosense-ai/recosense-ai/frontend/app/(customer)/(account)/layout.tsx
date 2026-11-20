import { RequireAuth } from "@/components/layout/guards";

export default function AccountLayout({ children }: LayoutProps<"/">) {
  return <RequireAuth>{children}</RequireAuth>;
}
