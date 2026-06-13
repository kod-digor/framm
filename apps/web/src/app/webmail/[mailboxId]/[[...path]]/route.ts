import { NextRequest } from "next/server";
import { handleWebmailProxy } from "@/lib/stalwart/webmail-proxy";

export const dynamic = "force-dynamic";

type RouteParams = { mailboxId: string; path?: string[] };

async function handler(
  req: NextRequest,
  ctx: { params: Promise<RouteParams> }
) {
  const { mailboxId, path } = await ctx.params;
  return handleWebmailProxy(req, mailboxId, path ?? []);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
