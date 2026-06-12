import { getStalwartStatus } from "@/lib/stalwart/client";
import { getT } from "@/i18n/t";

type StalwartBannerNamespace = "domains" | "mailboxes" | "aliases";

export async function StalwartStatusBanner({
  namespace,
}: {
  namespace: StalwartBannerNamespace;
}) {
  const status = await getStalwartStatus();
  if (status === "ok") return null;

  const t = await getT(namespace);
  const message =
    status === "unconfigured" ? t("stalwartUnconfigured") : t("stalwartUnavailable");

  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {message}
    </p>
  );
}
