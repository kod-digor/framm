import { Sidebar } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { getUserMemberships } from "@/lib/tenant";
import { TenantSwitcher } from "@/components/layout/tenant-switcher";
import { getT } from "@/i18n/t";

export async function DashboardShell({
  children,
  orgName,
}: {
  children: React.ReactNode;
  orgName?: string;
}) {
  const session = await auth();
  const t = await getT("dashboard");
  const tc = await getT("common");

  const items = [
    { href: "/dashboard", label: t("overview") },
    { href: "/dashboard/domains", label: t("domains") },
    { href: "/dashboard/mailboxes", label: t("mailboxes") },
    { href: "/dashboard/aliases", label: t("aliases") },
    { href: "/dashboard/usage", label: t("usage") },
  ];

  if (session?.user.role === "BUREAU") {
    items.push({ href: "/bureau", label: t("bureau") });
  }

  const memberships = session?.user.id
    ? await getUserMemberships(session.user.id)
    : [];

  const tenants = memberships.map((m) => ({
    id: m.organizationId,
    name: m.organization.name,
    status: m.organization.status,
  }));

  return (
    <div className="flex min-h-screen bg-zinc-50/80">
      <Sidebar items={items} title={tc("appName")} tagline={tc("appTagline")} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-200/80 bg-white/90 px-6 py-3 backdrop-blur-sm">
          <div className="min-w-0">
            {orgName && (
              <p className="truncate text-sm font-medium text-zinc-900">{orgName}</p>
            )}
          </div>
          {session?.user && (
            <TenantSwitcher
              tenants={tenants}
              activeTenantId={session.user.organizationId}
              userEmail={session.user.email}
            />
          )}
        </header>
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
