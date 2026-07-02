import { NextResponse } from "next/server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { getTransactions } from "@/lib/transactions.server";

// Client-data read for the transactions list. `getTransactions` enforces
// visibility (canViewTransaction) server-side, so private items never leave
// the server.
export async function GET(request: Request) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const owner = new URL(request.url).searchParams.get("owner") ?? undefined;
  const transactions = await getTransactions(ctx.family.id, ctx.user.uid, owner);
  return NextResponse.json(transactions);
}
