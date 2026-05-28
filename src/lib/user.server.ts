import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/firebase/admin";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  familyIds: string[];
}

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

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getAdminDb().doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const d = snap.data();
  if (!d) return null;
  return {
    uid,
    displayName: d.displayName ?? "",
    email: d.email ?? "",
    photoURL: d.photoURL ?? null,
    familyIds: d.familyIds ?? [],
  };
}

// Updates the canonical user doc, Firebase Auth's profile, and every
// denormalized member doc the user belongs to — so name changes propagate
// to the Members list without each call needing to refresh.
export async function updateUserDisplayName(uid: string, displayName: string): Promise<void> {
  const db = getAdminDb();
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const familyIds: string[] = userSnap.data()?.familyIds ?? [];

  const batch = db.batch();
  batch.update(userRef, { displayName });
  for (const familyId of familyIds) {
    batch.update(db.doc(`families/${familyId}/members/${uid}`), { displayName });
  }

  await Promise.all([batch.commit(), getAdminAuth().updateUser(uid, { displayName })]);
}
