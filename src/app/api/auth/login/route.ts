import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth } from "@/firebase/admin";

const loginSchema = z.object({
  idToken: z.string().min(1, "Missing token."),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  try {
    const { idToken } = parsed.data;
    const adminAuth = getAdminAuth();
    await adminAuth.verifyIdToken(idToken);

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

    return NextResponse.json(
      {
        error:
          "Unauthorized. Check that your Firebase web app config and Firebase service account belong to the same Firebase project.",
      },
      { status: 401 },
    );
  }
}
