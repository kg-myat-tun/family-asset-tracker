import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import type { Family, FamilyMember } from "@/types";

export async function getFamilyForUser(uid: string): Promise<Family | null> {
  const db = getAdminDb();
  const userDoc = await db.doc(`users/${uid}`).get();
  if (!userDoc.exists) return null;

  const familyIds: string[] = userDoc.data()?.familyIds ?? [];
  if (familyIds.length === 0) return null;

  const familyDoc = await db.doc(`families/${familyIds[0]}`).get();
  if (!familyDoc.exists) return null;

  const data = familyDoc.data();
  if (!data) return null;
  return {
    id: familyDoc.id,
    name: data.name,
    baseCurrency: data.settings?.baseCurrency ?? "USD",
    inviteCode: data.inviteCode ?? "",
    createdBy: data.createdBy,
    createdAt: data.createdAt.toDate(),
  };
}

export async function getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  const snap = await getAdminDb()
    .collection(`families/${familyId}/members`)
    .where("status", "==", "active")
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      uid: doc.id,
      displayName: d.displayName,
      email: d.email,
      photoURL: d.photoURL ?? null,
      role: d.role,
      status: d.status,
      joinedAt: d.joinedAt.toDate(),
    };
  });
}

// Invite codes: 6 chars, uppercase, ambiguity-free alphabet (no 0/O, 1/I/L).
const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomInviteCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueInviteCode(): Promise<string> {
  const db = getAdminDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomInviteCode();
    const clash = await db.collection("families").where("inviteCode", "==", code).limit(1).get();
    if (clash.empty) return code;
  }
  throw new Error("Could not generate a unique invite code");
}

async function memberIdentity(uid: string) {
  const userSnap = await getAdminDb().doc(`users/${uid}`).get();
  const u = userSnap.data() ?? {};
  return {
    displayName: u.displayName ?? "Unknown",
    email: u.email ?? "",
    photoURL: u.photoURL ?? null,
  };
}

export async function createFamily(
  uid: string,
  name: string,
  baseCurrency: string,
): Promise<string> {
  const db = getAdminDb();
  const inviteCode = await generateUniqueInviteCode();
  const identity = await memberIdentity(uid);
  const batch = db.batch();

  const familyRef = db.collection("families").doc();
  batch.set(familyRef, {
    name,
    inviteCode,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    settings: { baseCurrency },
  });

  const memberRef = db.doc(`families/${familyRef.id}/members/${uid}`);
  batch.set(memberRef, {
    ...identity,
    role: "admin",
    status: "active",
    joinedAt: FieldValue.serverTimestamp(),
  });

  const userRef = db.doc(`users/${uid}`);
  batch.set(userRef, { familyIds: FieldValue.arrayUnion(familyRef.id) }, { merge: true });

  await batch.commit();
  return familyRef.id;
}

export async function joinFamilyByCode(uid: string, code: string): Promise<string> {
  const db = getAdminDb();
  const snap = await db
    .collection("families")
    .where("inviteCode", "==", code.toUpperCase())
    .limit(1)
    .get();
  if (snap.empty) throw new Error("Invalid invite code");

  const familyId = snap.docs[0].id;
  const memberRef = db.doc(`families/${familyId}/members/${uid}`);
  const memberSnap = await memberRef.get();
  if (memberSnap.exists && memberSnap.data()?.status === "active") {
    return familyId;
  }

  const identity = await memberIdentity(uid);
  const batch = db.batch();
  batch.set(memberRef, {
    ...identity,
    role: "member",
    status: "active",
    joinedAt: FieldValue.serverTimestamp(),
  });
  batch.set(
    db.doc(`users/${uid}`),
    { familyIds: FieldValue.arrayUnion(familyId) },
    { merge: true },
  );
  await batch.commit();
  return familyId;
}
