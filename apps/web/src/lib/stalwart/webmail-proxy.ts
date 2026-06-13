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

function isAccountRoot(segments: string[]): boolean {
  return (
    segments.length === 0 ||
    (segments.length === 1 && segments[0] === "account") ||
    (segments.length === 2 &&
      segments[0] === "account" &&
      (segments[1] === "" || segments[1] === "index.html"))
  );
}

function upstreamPath(segments: string[]): string {
  if (isAccountRoot(segments)) return "/account/";
  return `/${segments.join("/")}`;
}

/** Next.js normalise les URLs sans slash final — évite les boucles 308↔302. */
function normalizeProxyPath(path: string): string {
  if (path.endsWith("/account/")) return path.slice(0, -1);
  return path;
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

type WebmailAuthFailureCode =
  | "credentials_invalid"
  | "auth_failed"
  | "auth_mfa"
  | "auth_upstream";

function mapWebmailAuthError(err: unknown): WebmailAuthFailureCode {
  if (!(err instanceof Error)) return "auth_upstream";
  switch (err.message) {
    case "credentials_invalid":
      return "credentials_invalid";
    case "stalwart_credentials_rejected":
    case "stalwart_auth_unexpected":
      return "auth_failed";
    case "stalwart_mfa_required":
      return "auth_mfa";
    default:
      return "auth_upstream";
  }
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
    if (isAccountRoot(pathSegments) && req.method === "GET") {
      return accountErrorHtml(403, "no_credentials");
    }
    return NextResponse.json({ error: "no_credentials" }, { status: 403 });
  }

  const upstream = `${webmailBase}${upstreamPath(pathSegments)}`;
  const upstreamUrl = new URL(upstream);
  upstreamUrl.search = req.nextUrl.search;

  const isAccountIndex = isAccountRoot(pathSegments);

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
      proxied = normalizeProxyPath(proxied);
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
    } catch (err) {
      return accountErrorHtml(502, mapWebmailAuthError(err));
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

function accountErrorHtml(status: number, code: WebmailAuthFailureCode | "no_credentials"): NextResponse {
  const messages: Record<WebmailAuthFailureCode | "no_credentials", string> = {
    no_credentials:
      "Les identifiants de cette boîte mail ne sont pas enregistrés. Réenregistrez le mot de passe dans les paramètres de la boîte.",
    credentials_invalid:
      "Les identifiants chiffrés de cette boîte sont illisibles. Définissez un nouveau mot de passe dans la liste des boîtes mail.",
    auth_failed:
      "Connexion automatique refusée par Stalwart (identifiants incorrects). Mettez à jour le mot de passe de la boîte dans Framm.",
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

/** URL same-origin pour iframe webmail (proxy Framm → Stalwart). */
export function getWebmailProxyPath(mailboxId: string): string {
  return `/webmail/${mailboxId}/account`;
}
