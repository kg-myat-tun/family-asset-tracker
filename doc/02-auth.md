# Phase 2 — Authentication

## Goal
Implement secure server-side session cookie auth using Firebase Authentication + Firebase Admin SDK. By the end, users can sign in (email/password and Google), sessions persist across page loads, and all protected routes enforce authentication.

---

## Architecture

```
Client                          Server (Next.js)
──────                          ────────────────
Firebase Auth (browser)   →     POST /api/auth/login
  signInWithEmailAndPassword          verifyIdToken()
  signInWithPopup (Google)            createSessionCookie()
  getIdToken()                        Set-Cookie: session=...

All subsequent requests      →  (await cookies()).get("session")
  (automatic via browser)          verifySessionCookie()
                                     → user uid + claims
```

Session cookies are `httpOnly`, `secure`, `sameSite: lax`, **14-day expiry**.

---

## Step 1 — Server-side auth helper

```typescript
// src/lib/auth.server.ts
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/firebase/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

export async function requireUser(): Promise<DecodedIdToken> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded;
  } catch {
    // Cookie invalid or revoked
    redirect("/login");
  }
}

export async function getOptionalUser(): Promise<DecodedIdToken | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}
```

---

> **Next.js 16:** `cookies()` is async and must be `await`ed — likewise
> `headers()` and route `params`/`searchParams`. The old synchronous fallback
> from Next.js 15 is gone (see Phases 5–7).

## Step 2 — Login Route Handler

```typescript
// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { adminAuth } from "@/firebase/admin";

export async function POST(request: Request) {
  const { idToken } = await request.json();

  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    // Verify the token is legitimate
    await adminAuth.verifyIdToken(idToken);

    // Create a session cookie (14 days)
    const expiresIn = 60 * 60 * 24 * 14 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const response = NextResponse.json({ status: "ok" });
    response.cookies.set("session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresIn / 1000,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Session cookie error:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

---

## Step 3 — Logout Route Handler

```typescript
// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/firebase/admin";

export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (sessionCookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie);
      // Revoke all refresh tokens for this user
      await adminAuth.revokeRefreshTokens(decoded.sub);
    } catch {
      // Cookie already invalid — proceed with clearing
    }
  }

  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  response.cookies.delete("session");
  return response;
}
```

---

## Step 4 — Firebase auth hook (Client Component)

```typescript
// src/lib/auth.client.ts
"use client";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { auth } from "@/firebase/client";

export async function loginWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await credential.user.getIdToken();
  await exchangeTokenForSession(idToken);
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  const idToken = await credential.user.getIdToken();
  await exchangeTokenForSession(idToken);
}

async function exchangeTokenForSession(idToken: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  // After setting cookie, navigate to dashboard
  window.location.href = "/dashboard";
}

export async function logout() {
  await signOut(auth);
  await fetch("/api/auth/logout", { method: "POST" });
}
```

---

## Step 5 — Login page

```typescript
// src/app/(auth)/login/page.tsx
import { LoginForm } from "@/components/auth/LoginForm";
import { getOptionalUser } from "@/lib/auth.server";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getOptionalUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Family Asset Tracker</h1>
        <p className="text-gray-500 mb-8">Sign in to manage your family's finances</p>
        <LoginForm />
      </div>
    </main>
  );
}
```

```typescript
// src/components/auth/LoginForm.tsx
"use client";
import { useState } from "react";
import { loginWithEmail, loginWithGoogle } from "@/lib/auth.client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">or</span>
        </div>
      </div>

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        Continue with Google
      </button>
    </div>
  );
}
```

---

## Step 6 — Dashboard layout as auth guard

```typescript
// src/app/(dashboard)/layout.tsx
import { requireUser } from "@/lib/auth.server";
import { AppShell } from "@/components/layout/AppShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // This throws a redirect to /login if unauthenticated
  const user = await requireUser();

  return (
    <AppShell userId={user.uid}>
      {children}
    </AppShell>
  );
}
```

> Note: `AppShell` will be fully implemented in Phase 3 once family data is available. For now, create a minimal placeholder:
> ```typescript
> // src/components/layout/AppShell.tsx
> export function AppShell({ children }: { children: React.ReactNode; userId: string }) {
>   return <div className="min-h-screen bg-gray-50">{children}</div>;
> }
> ```

---

## Verification

- [ ] Navigating to `/dashboard` without a session redirects to `/login`
- [ ] Email/password login sets an httpOnly `session` cookie and redirects to `/dashboard`
- [ ] Google OAuth login works the same way
- [ ] `POST /api/auth/logout` clears the cookie and redirects to `/login`
- [ ] Refreshing the page after login keeps the user signed in
- [ ] `requireUser()` returns the decoded token with a valid `uid`
