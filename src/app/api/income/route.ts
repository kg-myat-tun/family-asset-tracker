import { NextResponse } from "next/server";
import { getIncomes } from "@/lib/income.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";

// Client-data read for the income list. `getIncomes` enforces visibility
// (canViewIncome) server-side, so private items never leave the server.
export async function GET(request: Request) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const owner = new URL(request.url).searchParams.get("owner") ?? undefined;
  const income = await getIncomes(ctx.family.id, ctx.user.uid, owner);
  return NextResponse.json(income);
}
