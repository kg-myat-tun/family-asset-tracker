import { NextResponse } from "next/server";
import { searchSymbols } from "@/lib/asset-price.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import type { AssetCategory } from "@/types";

// Ticker suggestions for the asset symbol combobox. Auth-gated like the other
// client-data routes; the provider call (Finnhub key) stays server-side.
export async function GET(request: Request) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const params = new URL(request.url).searchParams;
  const category = params.get("category");
  const query = params.get("q") ?? "";

  if (category !== "stock" && category !== "crypto") {
    return NextResponse.json([]);
  }

  const options = await searchSymbols(category as AssetCategory, query);
  return NextResponse.json(options);
}
