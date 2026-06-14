import { getPlatformEmailDomains } from "@/lib/platform-domains";
import { getStalwartJmapUrl } from "@/lib/stalwart/client";

/** Domaine plateforme autorisé pour la découverte mail sur l'apex (PACC / Autodiscover). */
export function resolvePlatformAutoconfigDomain(host: string | null): string | null {
  if (!host) return null;
  const normalized = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const bare = normalized.replace(/^www\./, "");
  const allowed = getPlatformEmailDomains();
  if (allowed.includes(bare)) return bare;
  if (allowed.includes(normalized)) return normalized;
  for (const domain of allowed) {
    if (bare === `autoconfig.${domain}` || bare === `autodiscover.${domain}`) {
      return domain;
    }
  }
  return null;
}

/** Proxy vers Stalwart en conservant le Host du domaine mail (PACC, Autodiscover apex). */
export async function proxyStalwartAutoconfig(
  domain: string,
  pathWithQuery: string,
  options?: { method?: "GET" | "POST"; body?: string }
): Promise<Response> {
  const base = getStalwartJmapUrl();
  if (!base) {
    return new Response("unconfigured", { status: 503 });
  }

  const url = `${base}${pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`}`;
  const method = options?.method ?? "GET";

  const upstream = await fetch(url, {
    method,
    headers: {
      Host: domain,
      Accept: "*/*",
      ...(method === "POST" ? { "Content-Type": "text/xml" } : {}),
    },
    body: method === "POST" ? options?.body : undefined,
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });

  const contentType =
    upstream.headers.get("content-type") ??
    (pathWithQuery.includes(".json") ? "application/json" : "application/xml");

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
