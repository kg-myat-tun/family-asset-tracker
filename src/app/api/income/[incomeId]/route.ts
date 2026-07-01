import { NextResponse } from "next/server";
import { getIncome } from "@/lib/income.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { canViewIncome } from "@/lib/visibility";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ incomeId: string }> },
) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const { incomeId } = await params;
  const income = await getIncome(ctx.family.id, incomeId);
  if (!income || !canViewIncome(income, ctx.user.uid)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(income);
}
