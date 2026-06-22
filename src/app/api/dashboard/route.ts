import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard.server";
import { getFamilyMembers } from "@/lib/family.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";

export async function GET() {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const members = await getFamilyMembers(ctx.family.id);
  const data = await getDashboardData(
    ctx.family.id,
    members,
    ctx.family.baseCurrency,
    ctx.user.uid,
  );
  return NextResponse.json(data);
}
