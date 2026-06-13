import { getPlatformMailHost } from "@/lib/dns/verify";

export function getPlatformEmailDomains(): string[] {
  const raw =
    process.env.PLATFORM_DOMAINS?.trim() ||
    process.env.PRIMARY_PLATFORM_DOMAIN?.trim() ||
    getPlatformMailHost();

  const domains = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  return domains.length > 0 ? domains : [getPlatformMailHost()];
}
