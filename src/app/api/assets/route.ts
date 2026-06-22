import { NextResponse } from "next/server";
import { getAssets } from "@/lib/assets.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";

// Client-data read for the assets list. `getAssets` already enforces visibility
// (canViewAsset) server-side, so private items never leave the server.
export async function GET(request: Request) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const owner = new URL(request.url).searchParams.get("owner") ?? undefined;
  const assets = await getAssets(ctx.family.id, ctx.user.uid, owner);
  return NextResponse.json(assets);
}
