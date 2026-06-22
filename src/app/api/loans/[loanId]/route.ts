import { NextResponse } from "next/server";
import { getLoan, getRepayments } from "@/lib/loans.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { canViewLoan } from "@/lib/visibility";

// Loan detail bundles the loan with its repayment ledger — the detail view needs
// both and they invalidate together.
export async function GET(_request: Request, { params }: { params: Promise<{ loanId: string }> }) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const { loanId } = await params;
  const loan = await getLoan(ctx.family.id, loanId);
  if (!loan || !canViewLoan(loan, ctx.user.uid)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const repayments = await getRepayments(ctx.family.id, loanId);
  return NextResponse.json({ loan, repayments });
}
