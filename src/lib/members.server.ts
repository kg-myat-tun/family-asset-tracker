import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/firebase/admin";
import type { FamilyMember, Role } from "@/types";

export async function inviteMember(
  familyId: string,
  inviterUid: string,
  email: string,
): Promise<void> {
  const db = getAdminDb();
  const auth = getAdminAuth();

  let targetUser: Awaited<ReturnType<typeof auth.getUserByEmail>> | null = null;
  try {
    targetUser = await auth.getUserByEmail(email);
  } catch {
    // User doesn't exist yet — invite is pending
  }

  if (targetUser) {
    const targetUid = targetUser.uid;
    const memberRef = db.doc(`families/${familyId}/members/${targetUid}`);
    const existing = await memberRef.get();
    if (existing.exists && existing.data()?.status === "active") {
      throw new Error("User is already a member");
    }

    const batch = db.batch();
    batch.set(memberRef, {
      displayName: targetUser.displayName ?? targetUser.email ?? "Unknown",
      email: targetUser.email ?? "",
      photoURL: targetUser.photoURL ?? null,
      role: "member",
      status: "active",
      joinedAt: FieldValue.serverTimestamp(),
    });
    batch.set(
      db.doc(`users/${targetUid}`),
      { familyIds: FieldValue.arrayUnion(familyId) },
      { merge: true },
    );
    await batch.commit();
  } else {
    const inviteRef = db.collection(`families/${familyId}/invites`).doc();
    await inviteRef.set({
      email,
      invitedBy: inviterUid,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

export async function changeMemberRole(
  familyId: string,
  targetUid: string,
  newRole: Role,
): Promise<void> {
  await getAdminDb().doc(`families/${familyId}/members/${targetUid}`).update({ role: newRole });
}

export async function removeMember(familyId: string, targetUid: string): Promise<void> {
  const db = getAdminDb();
  const batch = db.batch();
  batch.update(db.doc(`families/${familyId}/members/${targetUid}`), {
    status: "removed",
  });
  batch.update(db.doc(`users/${targetUid}`), {
    familyIds: FieldValue.arrayRemove(familyId),
  });
  await batch.commit();
}

export async function getMemberWithAssetCount(
  familyId: string,
  uid: string,
): Promise<FamilyMember & { assetCount: number }> {
  const db = getAdminDb();
  const [memberSnap, assetsSnap] = await Promise.all([
    db.doc(`families/${familyId}/members/${uid}`).get(),
    db
      .collection(`families/${familyId}/assets`)
      .where("ownerId", "==", uid)
      .where("deleted", "==", false)
      .get(),
  ]);

  const d = memberSnap.data();
  if (!d) throw new Error("Member not found");

  return {
    uid,
    displayName: d.displayName,
    email: d.email,
    photoURL: d.photoURL ?? null,
    role: d.role,
    status: d.status,
    joinedAt: d.joinedAt.toDate(),
    assetCount: assetsSnap.size,
  };
}
