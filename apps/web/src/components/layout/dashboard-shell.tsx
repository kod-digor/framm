import { Sidebar, type NavGroup, type NavItem } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
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

  const orgId = session ? getOrgId(session) : null;
  const mailboxes = orgId
    ? await prisma.mailbox.findMany({
        where: { organizationId: orgId },
        orderBy: { address: "asc" },
      })
    : [];

  const overview: NavItem = {
    id: "overview",
    href: "/dashboard",
    label: t("overview"),
    icon: "overview",
  };

  const groups: NavGroup[] = [
    {
      id: "association",
      label: t("sections.association"),
      items: [
        {
          id: "members",
          href: "/dashboard/members",
          label: t("members"),
          icon: "members",
        },
      ],
    },
    {
      id: "accounting",
      label: t("sections.accounting"),
      items: [],
    },
    {
      id: "messaging",
      label: t("sections.messaging"),
      items: [
        ...mailboxes.map((mailbox) => ({
          id: `mailbox-${mailbox.id}`,
          href: `/dashboard/mail/${mailbox.id}`,
          label: mailbox.address,
          icon: "mail" as const,
        })),
        {
          id: "mailboxes",
          href: "/dashboard/mailboxes",
          label: t("mailboxes"),
          icon: "mail",
        },
        {
          id: "aliases",
          href: "/dashboard/aliases",
          label: t("aliases"),
          icon: "forward",
        },
      ],
    },
    {
      id: "platform",
      label: t("sections.platform"),
      items: [
        {
          id: "domains",
          href: "/dashboard/domains",
          label: t("domains"),
          icon: "globe",
        },
        ...(session?.user.role === "BUREAU"
          ? [
              {
                id: "bureau",
                href: "/bureau",
                label: t("bureau"),
                icon: "bureau" as const,
              },
            ]
          : []),
      ],
    },
  ];

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
      <Sidebar overview={overview} groups={groups} logoAlt={tc("appName")} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-200/80 bg-white/90 px-6 backdrop-blur-sm">
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
