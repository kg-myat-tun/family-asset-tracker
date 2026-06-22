import { NextResponse } from "next/server";
import { getLoans } from "@/lib/loans.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { canViewLoan } from "@/lib/visibility";

// `getLoans` does not filter visibility itself (the page does), so apply
// canViewLoan here before returning — private loans never leave the server.
export async function GET() {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const loans = await getLoans(ctx.family.id);
  return NextResponse.json(loans.filter((l) => canViewLoan(l, ctx.user.uid)));
}
