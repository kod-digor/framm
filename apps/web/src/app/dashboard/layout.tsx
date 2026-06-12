import { requireOrgAdmin, getOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session);
  const org = orgId
    ? await prisma.organization.findUnique({ where: { id: orgId } })
    : null;

  return <DashboardShell orgName={org?.name}>{children}</DashboardShell>;
}
