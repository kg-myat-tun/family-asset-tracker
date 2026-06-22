import "server-only";

import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth.server";
import { getFamilyForUser } from "@/lib/family.server";
import type { Family } from "@/types";

type RouteContext = { user: { uid: string; email: string | null }; family: Family };

// Resolves the read context for client-data Route Handlers: the signed-in user
// (from the session cookie) and their family (from the verified session — never
// from a client-supplied id). Returns a 401/404 Response instead of throwing so
// handlers can early-return it. Mirrors the page-layer requireUser + family flow.
export async function getRouteContext(): Promise<RouteContext | NextResponse> {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const family = await getFamilyForUser(user.uid);
  if (!family) return NextResponse.json({ error: "No family" }, { status: 404 });

  return { user: { uid: user.uid, email: user.email ?? null }, family };
}

export function isErrorResponse(ctx: RouteContext | NextResponse): ctx is NextResponse {
  return ctx instanceof NextResponse;
}
