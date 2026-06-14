import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { getT } from "@/i18n/t";

export default async function ChangePasswordPage() {
  const session = await requireAuth(undefined, { skipPasswordChange: true });
  const tc = await getT("common");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });

  if (!user?.mustChangePassword) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <BrandLogo alt={tc("appName")} href="/" size="sm" />
      </div>
      <ChangePasswordForm />
    </div>
  );
}
