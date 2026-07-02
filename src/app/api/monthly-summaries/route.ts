import { NextResponse } from "next/server";
import { getMonthlySummaries } from "@/lib/monthly-summary.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";

export async function GET() {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const summaries = await getMonthlySummaries(ctx.family.id);
  return NextResponse.json(summaries);
}
