import { NextRequest } from "next/server";
import { handleWebmailProxy } from "@/lib/stalwart/webmail-proxy";

type RouteParams = { mailboxId: string; path?: string[] };

async function proxy(req: NextRequest, ctx: { params: Promise<RouteParams> }) {
  const { mailboxId, path = [] } = await ctx.params;
  return handleWebmailProxy(req, mailboxId, path);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
