import { Sidebar } from "@/components/ui/sidebar";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} title={tc("appName")} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <span className="text-sm text-zinc-600">{orgName}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              {tc("logout")}
            </Button>
          </form>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
