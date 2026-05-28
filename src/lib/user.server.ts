import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/firebase/admin";

export async function ensureUserProfile(uid: string): Promise<void> {
  const ref = getAdminDb().doc(`users/${uid}`);
  const snap = await ref.get();
  if (snap.exists) return;

  const authUser = await getAdminAuth().getUser(uid);
  await ref.set({
    displayName: authUser.displayName ?? authUser.email ?? "Unknown",
    email: authUser.email ?? "",
    photoURL: authUser.photoURL ?? null,
    familyIds: [],
    createdAt: FieldValue.serverTimestamp(),
  });
}
