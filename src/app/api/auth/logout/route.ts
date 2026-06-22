import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminAuth } from "@/firebase/admin";
import { getRequiredEnv } from "@/lib/env";

async function clearSession(response: NextResponse) {
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

  response.cookies.delete("session");
  return response;
}

// POST is the XHR path (the LogoutButton fetches this). It must NOT return a
// redirect: the client follows redirects, and a cross-origin redirect to
// NEXT_PUBLIC_APP_URL (canonical domain) would make fetch throw on CORS,
// stranding the user on a stale page. Just clear the cookie and return 200 —
// the client handles navigation via window.location.
export async function POST() {
  return clearSession(NextResponse.json({ ok: true }));
}

// Allow GET so you can hit /api/auth/logout in the address bar to force-clear
// the session cookie when the client is stuck on a cached Firebase user. A
// top-level navigation can safely follow this redirect.
export async function GET() {
  return clearSession(
    NextResponse.redirect(new URL("/login", getRequiredEnv("NEXT_PUBLIC_APP_URL"))),
  );
}
