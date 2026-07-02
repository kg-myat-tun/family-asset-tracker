import { NextResponse } from "next/server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { getRecurringRules } from "@/lib/recurring.server";

export async function GET(request: Request) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const owner = new URL(request.url).searchParams.get("owner") ?? undefined;
  const rules = await getRecurringRules(ctx.family.id, ctx.user.uid, owner);
  return NextResponse.json(rules);
}
