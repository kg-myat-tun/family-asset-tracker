import { NextResponse } from "next/server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { getRecurringRule } from "@/lib/recurring.server";
import { canViewRecurringRule } from "@/lib/visibility";

export async function GET(_request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const { ruleId } = await params;
  const rule = await getRecurringRule(ctx.family.id, ruleId);
  if (!rule || !canViewRecurringRule(rule, ctx.user.uid)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(rule);
}
