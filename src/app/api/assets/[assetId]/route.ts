import { NextResponse } from "next/server";
import { getAsset } from "@/lib/assets.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { canViewAsset } from "@/lib/visibility";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const { assetId } = await params;
  const asset = await getAsset(ctx.family.id, assetId);
  if (!asset || !canViewAsset(asset, ctx.user.uid)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(asset);
}
