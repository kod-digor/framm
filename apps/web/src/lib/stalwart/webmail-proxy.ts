/**
 * Proxy iframe same-origin Framm → Bulwark Webmail (JMAP via Stalwart).
 */
import { NextRequest, NextResponse } from "next/server";
import { unsealSecret } from "@/lib/crypto/seal";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getBulwarkJmapUrl, getStalwartJmapUrl, getWebmailExternalUrl } from "@/lib/stalwart/client";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const EMBED_BLOCKING_HEADERS = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
]);

const BULWARK_SESSION_COOKIE = "jmap_session";

function proxyPrefix(mailboxId: string): string {
  return `/webmail/${mailboxId}`;
}

function upstreamPath(segments: string[]): string {
  if (segments.length === 0) return "/";
  return `/${segments.join("/")}`;
}

function normalizeProxyPath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  if (!trimmed || trimmed === proxyPrefix("")) return path;
  return path;
}

function buildFetchRewriterScript(prefix: string, webmailBase: string, stalwartBase: string): string {
  return `<script>(function(){
var P=${JSON.stringify(prefix)};
var W=${JSON.stringify(webmailBase)};
var M=${JSON.stringify(stalwartBase)};
function rw(u){
  if(typeof u!=="string")return u;
  if(u.indexOf(P)===0)return u;
  if(W&&u.indexOf(W)===0){
    var rest=u.slice(W.length);
    if(rest.indexOf("/jmap")===0||rest.indexOf("/.well-known/jmap")===0)return P+rest;
  }
  if(M&&u.indexOf(M)===0){
    var rest2=u.slice(M.length);
    if(rest2.indexOf("/jmap")===0||rest2.indexOf("/.well-known/jmap")===0)return P+rest2;
  }
  try{
    var parsed=new URL(u,location.origin);
    if(parsed.origin===location.origin){
      var path=parsed.pathname+parsed.search+parsed.hash;
      if(isProxiedAppPath(path))return P+path;
    }
  }catch(e){}
  if(isProxiedAppPath(u))return P+u;
  return u;
}
function isProxiedAppPath(path){
  return path.indexOf("/api/")===0||path.indexOf("/_next/")===0||path.indexOf("/branding/")===0||path.indexOf("/sw.js")===0||path.indexOf("/jmap")===0||path.indexOf("/.well-known/jmap")===0;
}
var f=window.fetch.bind(window);
window.fetch=function(i,n){
  if(typeof i==="string")i=rw(i);
  else if(i instanceof Request){var u=rw(i.url);if(u!==i.url)i=new Request(u,i);}
  return f(i,n);
};
})();</script>`;
}

function injectBulwarkHtml(html: string, mailboxId: string, webmailBase: string, stalwartBase: string): string {
  const prefix = `${proxyPrefix(mailboxId)}/`;
  let out = html.replace(/<base\s+[^>]*href="\/"\s*\/?>/i, `<base href="${prefix}" />`);
  if (!out.includes(`href="${prefix}"`)) {
    out = out.replace(/<head>/i, `<head><base href="${prefix}" />`);
  }
  const script = buildFetchRewriterScript(proxyPrefix(mailboxId), webmailBase, stalwartBase);
  return out.replace(/<\/head>/i, `${script}</head>`);
}

function rewriteSetCookie(header: string, prefix: string): string {
  let out = header.replace(/;\s*Domain=[^;]*/gi, "");
  if (/;\s*Path=/i.test(out)) {
    out = out.replace(/;\s*Path=[^;]*/i, `; Path=${prefix}`);
  } else {
    out += `; Path=${prefix}`;
  }
  return out;
}

function collectSetCookies(headers: Headers): string[] {
  const cookies: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") cookies.push(value);
  });
  return cookies;
}

function copyResponseHeaders(from: Headers, to: Headers, prefix: string) {
  from.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "content-encoding") return;
    if (lower === "set-cookie") return;
    if (EMBED_BLOCKING_HEADERS.has(lower)) return;
    to.set(key, value);
  });

  for (const cookie of collectSetCookies(from)) {
    to.append("Set-Cookie", rewriteSetCookie(cookie, prefix));
  }
}

function hasBulwarkSession(req: NextRequest): boolean {
  const raw = req.headers.get("cookie") ?? "";
  return raw.split(";").some((part) => part.trim().startsWith(`${BULWARK_SESSION_COOKIE}=`));
}

async function resolveMailbox(mailboxId: string, orgId: string) {
  return prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: orgId },
    select: { id: true, address: true, credentialsEnc: true },
  });
}

type WebmailAuthFailureCode =
  | "credentials_invalid"
  | "auth_failed"
  | "auth_mfa"
  | "auth_upstream";

function mapBulwarkSessionError(status: number, body: string): WebmailAuthFailureCode {
  if (status === 401 || status === 403) {
    if (body.includes("MFA") || body.includes("mfa")) return "auth_mfa";
    return "auth_failed";
  }
  return "auth_upstream";
}

async function bootstrapBulwarkSession(
  webmailBase: string,
  address: string,
  credentialsEnc: string
): Promise<{ cookieHeader: string; setCookies: string[] }> {
  const password = unsealSecret(credentialsEnc);
  if (!password) {
    throw new Error("credentials_invalid");
  }

  const jmapUrl = getBulwarkJmapUrl();
  if (!jmapUrl) {
    throw new Error("auth_upstream");
  }

  const sessionRes = await fetch(`${webmailBase}/api/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      serverUrl: jmapUrl,
      username: address,
      password,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!sessionRes.ok) {
    const body = await sessionRes.text().catch(() => "");
    throw new Error(mapBulwarkSessionError(sessionRes.status, body));
  }

  const setCookies = collectSetCookies(sessionRes.headers);
  const cookieHeader = setCookies
    .map((c) => c.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");

  return { cookieHeader, setCookies };
}

function mergeCookieHeaders(existing: string | null, bootstrap: string): string {
  const jar = new Map<string, string>();
  for (const part of (existing ?? "").split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  for (const part of bootstrap.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function mapWebmailAuthError(err: unknown): WebmailAuthFailureCode {
  if (!(err instanceof Error)) return "auth_upstream";
  switch (err.message) {
    case "credentials_invalid":
      return "credentials_invalid";
    case "auth_failed":
    case "auth_mfa":
    case "auth_upstream":
      return err.message;
    default:
      return "auth_upstream";
  }
}

function isHtmlNavigation(req: NextRequest, pathSegments: string[]): boolean {
  if (req.method !== "GET") return false;
  const accept = req.headers.get("accept") ?? "";
  if (!accept.includes("text/html")) return false;
  return pathSegments.length === 0 || pathSegments[0] === "login";
}

function needsSessionBootstrap(req: NextRequest, pathSegments: string[]): boolean {
  if (hasBulwarkSession(req)) return false;
  if (isHtmlNavigation(req, pathSegments)) return true;
  if (pathSegments[0] === "api") return true;
  if (pathSegments[0] === "jmap" || pathSegments[0] === ".well-known") return true;
  return false;
}

export async function handleWebmailProxy(
  req: NextRequest,
  mailboxId: string,
  pathSegments: string[]
): Promise<NextResponse> {
  const webmailBase = getWebmailExternalUrl();
  if (!webmailBase) {
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const orgId = getOrgId(session);
  if (!orgId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const mailbox = await resolveMailbox(mailboxId, orgId);
  if (!mailbox) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const prefix = proxyPrefix(mailboxId);

  if (!mailbox.credentialsEnc) {
    if (isHtmlNavigation(req, pathSegments)) {
      return accountErrorHtml(403, "no_credentials");
    }
    return NextResponse.json({ error: "no_credentials" }, { status: 403 });
  }

  let bootstrapCookies: string[] = [];
  let cookieHeader = req.headers.get("cookie");

  const needsBootstrap = needsSessionBootstrap(req, pathSegments);

  if (needsBootstrap) {
    try {
      const boot = await bootstrapBulwarkSession(webmailBase, mailbox.address, mailbox.credentialsEnc);
      bootstrapCookies = boot.setCookies;
      cookieHeader = mergeCookieHeaders(cookieHeader, boot.cookieHeader);
    } catch (err) {
      if (isHtmlNavigation(req, pathSegments)) {
        return accountErrorHtml(502, mapWebmailAuthError(err));
      }
      return NextResponse.json({ error: mapWebmailAuthError(err) }, { status: 502 });
    }
  }

  const upstream = `${webmailBase}${upstreamPath(pathSegments)}`;
  const upstreamUrl = new URL(upstream);
  upstreamUrl.search = req.nextUrl.search;

  const headers = new Headers();
  const accept = req.headers.get("accept");
  if (accept) headers.set("Accept", accept);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const authorization = req.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);
  if (cookieHeader) headers.set("Cookie", cookieHeader);

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }

  if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
    const location = upstreamRes.headers.get("location");
    if (location) {
      let proxied = location;
      if (location.startsWith(webmailBase)) {
        proxied = `${prefix}${location.slice(webmailBase.length)}`;
      } else if (location.startsWith("/")) {
        proxied = `${prefix}${location}`;
      }
      proxied = normalizeProxyPath(proxied);
      const redirect = NextResponse.redirect(new URL(proxied, req.url), upstreamRes.status);
      for (const cookie of bootstrapCookies) {
        redirect.headers.append("Set-Cookie", rewriteSetCookie(cookie, prefix));
      }
      return redirect;
    }
  }

  const resContentType = upstreamRes.headers.get("content-type") ?? "";
  const isHtml = resContentType.includes("text/html");

  if (isHtml && req.method === "GET") {
    const html = await upstreamRes.text();
    const injected = injectBulwarkHtml(html, mailboxId, webmailBase, getStalwartJmapUrl());
    const responseHeaders = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    for (const cookie of [...bootstrapCookies, ...collectSetCookies(upstreamRes.headers)]) {
      responseHeaders.append("Set-Cookie", rewriteSetCookie(cookie, prefix));
    }
    return new NextResponse(injected, { status: upstreamRes.status, headers: responseHeaders });
  }

  const responseHeaders = new Headers();
  copyResponseHeaders(upstreamRes.headers, responseHeaders, prefix);
  for (const cookie of bootstrapCookies) {
    responseHeaders.append("Set-Cookie", rewriteSetCookie(cookie, prefix));
  }
  if (!responseHeaders.has("Cache-Control") && (pathSegments[0] === "api" || pathSegments[0] === "jmap")) {
    responseHeaders.set("Cache-Control", "no-store");
  }

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}

function accountErrorHtml(status: number, code: WebmailAuthFailureCode | "no_credentials"): NextResponse {
  const messages: Record<WebmailAuthFailureCode | "no_credentials", string> = {
    no_credentials:
      "Les identifiants de cette boîte mail ne sont pas enregistrés. Réenregistrez le mot de passe dans les paramètres de la boîte.",
    credentials_invalid:
      "Les identifiants chiffrés de cette boîte sont illisibles. Définissez un nouveau mot de passe dans la liste des boîtes mail.",
    auth_failed:
      "Connexion automatique refusée (identifiants incorrects). Mettez à jour le mot de passe de la boîte dans Framm.",
    auth_mfa:
      "Cette boîte exige une authentification à deux facteurs — le webmail intégré ne la prend pas encore en charge.",
    auth_upstream:
      "Connexion automatique au webmail impossible (erreur serveur). Réessayez ou ouvrez le webmail dans un nouvel onglet.",
  };
  const message = messages[code] ?? "Impossible de charger le webmail.";
  const html = `<!doctype html><html lang="fr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Webmail</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa;color:#52525b}.box{max-width:28rem;padding:1.5rem;text-align:center;border:1px solid #e4e4e7;border-radius:.5rem;background:#fff}</style></head><body><div class="box"><p>${message}</p></div></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** URL same-origin pour iframe webmail (proxy Framm → Bulwark). */
export function getWebmailProxyPath(mailboxId: string): string {
  return `/webmail/${mailboxId}/`;
}
