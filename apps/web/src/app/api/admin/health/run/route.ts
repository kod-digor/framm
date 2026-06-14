import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findHealthCheckDefinition, runHealthCheck } from "@/lib/admin/health-checks";
import { enrichHealthResults } from "@/lib/admin/health-present";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "BUREAU") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const checkId = req.nextUrl.searchParams.get("id");
  if (!checkId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const definition = findHealthCheckDefinition(checkId);
  if (!definition) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const result = await runHealthCheck(definition, {
    sessionEmail: session.user.email ?? "",
    sessionRole: session.user.role,
  });
  const [view] = await enrichHealthResults([result]);

  return NextResponse.json({ result: view, ranAt: new Date().toISOString() });
}
