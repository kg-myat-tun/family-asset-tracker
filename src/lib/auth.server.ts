import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "@/firebase/admin";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import type { Family } from "@/types";

export async function requireUser(): Promise<DecodedIdToken> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  try {
    return await getAdminAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    redirect("/login");
  }
}

// Resolves the verified user + their family and asserts they are an admin.
// Shared by the member and family Server Actions.
export async function requireAdmin(): Promise<{ user: DecodedIdToken; family: Family }> {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) throw new Error("No family");

  const members = await getFamilyMembers(family.id);
  const self = members.find((m) => m.uid === user.uid);
  if (self?.role !== "admin") throw new Error("Admin only");

  return { user, family };
}

export async function getOptionalUser(): Promise<DecodedIdToken | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    return await getAdminAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}
