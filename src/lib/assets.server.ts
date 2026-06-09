import "server-only";

import { FieldValue, type Query } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { canViewAsset } from "@/lib/visibility";
import type { Asset, AssetCategory, Visibility } from "@/types";

function docToAsset(doc: FirebaseFirestore.DocumentSnapshot): Asset {
  const d = doc.data();
  if (!d) throw new Error("Asset doc empty");
  return {
    id: doc.id,
    ownerId: d.ownerId,
    name: d.name,
    category: d.category,
    currency: d.currency,
    amount: d.amount,
    description: d.description ?? "",
    attachmentURL: d.attachmentURL ?? null,
    visibility: d.visibility ?? "shared",
    deleted: d.deleted ?? false,
    createdAt: d.createdAt.toDate(),
    updatedAt: d.updatedAt.toDate(),
  };
}

export async function getAssets(
  familyId: string,
  viewerUid: string,
  ownerId?: string,
): Promise<Asset[]> {
  let query: Query = getAdminDb()
    .collection(`families/${familyId}/assets`)
    .where("deleted", "==", false)
    .orderBy("createdAt", "desc");

  if (ownerId) query = query.where("ownerId", "==", ownerId);

  const snap = await query.get();
  return snap.docs.map(docToAsset).filter((a) => canViewAsset(a, viewerUid));
}

export async function getAsset(familyId: string, assetId: string): Promise<Asset | null> {
  const snap = await getAdminDb().doc(`families/${familyId}/assets/${assetId}`).get();
  if (!snap.exists || snap.data()?.deleted) return null;
  return docToAsset(snap);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

export async function createAsset(
  familyId: string,
  ownerId: string,
  data: {
    name: string;
    category: AssetCategory;
    currency: string;
    amount: number;
    description: string;
    attachmentURL?: string | null;
    visibility: Visibility;
  },
): Promise<string> {
  const ref = getAdminDb().collection(`families/${familyId}/assets`).doc();
  await ref.set({
    ...data,
    attachmentURL: data.attachmentURL ?? null,
    ownerId,
    deleted: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateAsset(
  familyId: string,
  assetId: string,
  data: Partial<
    Pick<
      Asset,
      "name" | "category" | "currency" | "amount" | "description" | "attachmentURL" | "visibility"
    >
  >,
): Promise<void> {
  await getAdminDb()
    .doc(`families/${familyId}/assets/${assetId}`)
    .update({
      ...stripUndefined(data),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function softDeleteAsset(familyId: string, assetId: string): Promise<void> {
  await getAdminDb().doc(`families/${familyId}/assets/${assetId}`).update({
    deleted: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
