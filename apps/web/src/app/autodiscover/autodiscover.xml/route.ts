import { headers } from "next/headers";
import {
  proxyStalwartAutoconfig,
  resolvePlatformAutoconfigDomain,
} from "@/lib/mail/autoconfig-proxy";

const OUTLOOK_AUTODISCOVER_BODY = (email: string) =>
  `<?xml version="1.0" encoding="utf-8"?><Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/requestschema/2006"><Request><EMailAddress>${email}</EMailAddress><AcceptableResponseSchema>http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a</AcceptableResponseSchema></Request></Autodiscover>`;

export async function GET(request: Request) {
  const headerStore = await headers();
  const domain = resolvePlatformAutoconfigDomain(headerStore.get("host"));
  if (!domain) {
    return new Response("Not Found", { status: 404 });
  }

  const { search } = new URL(request.url);
  return proxyStalwartAutoconfig(domain, `/autodiscover/autodiscover.xml${search}`);
}

export async function POST(request: Request) {
  const headerStore = await headers();
  const domain = resolvePlatformAutoconfigDomain(headerStore.get("host"));
  if (!domain) {
    return new Response("Not Found", { status: 404 });
  }

  const { search } = new URL(request.url);
  const body = await request.text();
  const fallbackBody = body.trim() || OUTLOOK_AUTODISCOVER_BODY(`health@${domain}`);
  return proxyStalwartAutoconfig(domain, `/autodiscover/autodiscover.xml${search}`, {
    method: "POST",
    body: fallbackBody,
  });
}
