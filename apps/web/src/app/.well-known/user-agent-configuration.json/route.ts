import { headers } from "next/headers";
import {
  proxyStalwartAutoconfig,
  resolvePlatformAutoconfigDomain,
} from "@/lib/mail/autoconfig-proxy";

export async function GET(request: Request) {
  const headerStore = await headers();
  const domain = resolvePlatformAutoconfigDomain(headerStore.get("host"));
  if (!domain) {
    return new Response("Not Found", { status: 404 });
  }

  const { search } = new URL(request.url);
  return proxyStalwartAutoconfig(
    domain,
    `/.well-known/user-agent-configuration.json${search}`
  );
}
