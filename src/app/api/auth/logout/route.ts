import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminAuth } from "@/firebase/admin";
import { getRequiredEnv } from "@/lib/env";

async function clearSession() {
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

export async function POST() {
  return clearSession();
}

// Allow GET so you can hit /api/auth/logout in the address bar to force-clear
// the session cookie when the client is stuck on a cached Firebase user.
export async function GET() {
  return clearSession();
}
