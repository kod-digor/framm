import { headers } from "next/headers";
import {
  proxyStalwartAutoconfig,
  resolvePlatformAutoconfigDomain,
} from "@/lib/mail/autoconfig-proxy";

/** Chemin Mozilla alternatif sur l'apex (Apple Mail, Thunderbird). */
export async function GET(request: Request) {
  const headerStore = await headers();
  const domain = resolvePlatformAutoconfigDomain(headerStore.get("host"));
  if (!domain) {
    return new Response("Not Found", { status: 404 });
  }

  const { search } = new URL(request.url);
  return proxyStalwartAutoconfig(
    domain,
    `/.well-known/autoconfig/mail/config-v1.1.xml${search}`
  );
}
