import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminAuth } from "@/firebase/admin";
import { getRequiredEnv } from "@/lib/env";

export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (sessionCookie) {
    try {
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifySessionCookie(sessionCookie);
      await adminAuth.revokeRefreshTokens(decoded.sub);
    } catch {
      // Cookie may already be invalid. We still want to clear it.
    }
  }

  const response = NextResponse.redirect(new URL("/login", getRequiredEnv("NEXT_PUBLIC_APP_URL")));
  response.cookies.delete("session");
  return response;
}
