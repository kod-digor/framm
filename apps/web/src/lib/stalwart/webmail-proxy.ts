import { NextRequest, NextResponse } from "next/server";
import { unsealSecret } from "@/lib/crypto/seal";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getWebmailExternalUrl } from "@/lib/stalwart/client";
import { obtainWebmailTokens, type WebmailTokens } from "@/lib/stalwart/webmail-auth";

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

function proxyPrefix(mailboxId: string): string {
  return `/webmail/${mailboxId}`;
}

function upstreamPath(segments: string[]): string {
  if (segments.length === 0) return "/account/";
  return `/${segments.join("/")}`;
}

function buildBootstrapScript(
  mailboxId: string,
  webmailBase: string,
  tokens: WebmailTokens
): string {
  const prefix = proxyPrefix(mailboxId);
  const tokenExpiresAt = Date.now() + tokens.expiresIn * 1000;
  const proxiedTokenEndpoint = `${prefix}/auth/token`;
  const authState = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt,
    tokenEndpoint: proxiedTokenEndpoint,
    endSessionEndpoint: tokens.endSessionEndpoint
      ? `${prefix}${new URL(tokens.endSessionEndpoint).pathname}`
      : null,
  };

  return `<script>(function(){
var P=${JSON.stringify(prefix)};
var O=${JSON.stringify(webmailBase)};
var auth=${JSON.stringify(authState)};
try{
  sessionStorage.setItem("stalwart-auth",JSON.stringify({state:auth,version:0}));
}catch(e){}
function rw(u){
  if(typeof u!=="string")return u;
  if(u.indexOf(P)===0)return u;
  if(u.indexOf("/api/")===0||u.indexOf("/jmap")===0||u.indexOf("/auth/")===0)return P+u;
  if(u.indexOf(O)===0)return P+u.slice(O.length);
  return u;
}
var f=window.fetch.bind(window);
window.fetch=function(i,n){
  if(typeof i==="string")i=rw(i);
  else if(i instanceof Request){var u=rw(i.url);if(u!==i.url)i=new Request(u,i);}
  return f(i,n);
};
})();</script>`;
}

function injectAccountHtml(
  html: string,
  mailboxId: string,
  webmailBase: string,
  tokens: WebmailTokens
): string {
  const prefix = proxyPrefix(mailboxId);
  const accountBase = `${prefix}/account/`;
  let out = html.replace(/<base\s+href="\/account\/"\s*\/?>/i, `<base href="${accountBase}" />`);
  if (!out.includes(`href="${accountBase}"`)) {
    out = out.replace(/<head>/i, `<head><base href="${accountBase}" />`);
  }
  const script = buildBootstrapScript(mailboxId, webmailBase, tokens);
  return out.replace(/<\/head>/i, `${script}</head>`);
}

function copyResponseHeaders(from: Headers, to: Headers) {
  from.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "content-encoding") return;
    to.set(key, value);
  });
}

async function resolveMailbox(mailboxId: string, orgId: string) {
  return prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: orgId },
    select: { id: true, address: true, credentialsEnc: true },
  });
}

async function getTokensForMailbox(
  address: string,
  credentialsEnc: string
): Promise<WebmailTokens> {
  const password = unsealSecret(credentialsEnc);
  if (!password) {
    throw new Error("credentials_invalid");
  }
  return obtainWebmailTokens(address, password);
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

  if (!mailbox.credentialsEnc) {
    return NextResponse.json({ error: "no_credentials" }, { status: 403 });
  }

  const upstream = `${webmailBase}${upstreamPath(pathSegments)}`;
  const upstreamUrl = new URL(upstream);
  upstreamUrl.search = req.nextUrl.search;

  const isAccountIndex =
    pathSegments.length === 0 ||
    (pathSegments.length === 1 && pathSegments[0] === "account") ||
    (pathSegments.length === 2 &&
      pathSegments[0] === "account" &&
      (pathSegments[1] === "" || pathSegments[1] === "index.html"));

  const headers = new Headers();
  const accept = req.headers.get("accept");
  if (accept) headers.set("Accept", accept);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const authorization = req.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);

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
      const prefix = proxyPrefix(mailboxId);
      let proxied = location;
      if (location.startsWith(webmailBase)) {
        proxied = `${prefix}${location.slice(webmailBase.length)}`;
      } else if (location.startsWith("/")) {
        proxied = `${prefix}${location}`;
      }
      return NextResponse.redirect(new URL(proxied, req.url), upstreamRes.status);
    }
  }

  const resContentType = upstreamRes.headers.get("content-type") ?? "";
  const needsBootstrap =
    req.method === "GET" && isAccountIndex && resContentType.includes("text/html");

  if (needsBootstrap) {
    let tokens: WebmailTokens;
    try {
      tokens = await getTokensForMailbox(mailbox.address, mailbox.credentialsEnc);
    } catch {
      return NextResponse.json({ error: "auth_failed" }, { status: 502 });
    }

    const html = await upstreamRes.text();
    const injected = injectAccountHtml(html, mailboxId, webmailBase, tokens);
    return new NextResponse(injected, {
      status: upstreamRes.status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const responseHeaders = new Headers();
  copyResponseHeaders(upstreamRes.headers, responseHeaders);
  if (!responseHeaders.has("Cache-Control") && pathSegments[0] === "account") {
    responseHeaders.set("Cache-Control", "no-store");
  }

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}

/** URL same-origin pour iframe webmail (proxy Framm → Stalwart). */
export function getWebmailProxyPath(mailboxId: string): string {
  return `/webmail/${mailboxId}/account/`;
}
