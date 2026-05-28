import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/firebase/admin";
import { requireUser } from "@/lib/auth.server";

const BodySchema = z.object({
  photoURL: z.string().url(),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = BodySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  await getAdminDb().doc(`users/${user.uid}`).update({ photoURL: parsed.data.photoURL });
  return NextResponse.json({ ok: true });
}
