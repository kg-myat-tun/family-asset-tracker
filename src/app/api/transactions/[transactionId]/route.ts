import { NextResponse } from "next/server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { getTransaction } from "@/lib/transactions.server";
import { canViewTransaction } from "@/lib/visibility";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const { transactionId } = await params;
  const transaction = await getTransaction(ctx.family.id, transactionId);
  if (!transaction || !canViewTransaction(transaction, ctx.user.uid)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(transaction);
}
