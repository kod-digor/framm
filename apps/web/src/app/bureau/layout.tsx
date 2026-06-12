import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAuth } from "@/lib/auth-utils";

export default async function BureauLayout({ children }: { children: React.ReactNode }) {
  await requireAuth(["BUREAU"]);
  return <DashboardShell>{children}</DashboardShell>;
}
