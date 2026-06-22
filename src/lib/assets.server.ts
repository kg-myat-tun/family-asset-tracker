import "server-only";

import { FieldValue, type Query } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { applyLivePrices } from "@/lib/asset-price.server";
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
    symbol: d.symbol ?? null,
    quantity: d.quantity ?? null,
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
  const visible = snap.docs.map(docToAsset).filter((a) => canViewAsset(a, viewerUid));
  return applyLivePrices(visible);
}

export async function getAsset(familyId: string, assetId: string): Promise<Asset | null> {
  const snap = await getAdminDb().doc(`families/${familyId}/assets/${assetId}`).get();
  if (!snap.exists || snap.data()?.deleted) return null;
  const [asset] = await applyLivePrices([docToAsset(snap)]);
  return asset;
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
    symbol?: string | null;
    quantity?: number | null;
    description: string;
    attachmentURL?: string | null;
    visibility: Visibility;
  },
): Promise<string> {
  const ref = getAdminDb().collection(`families/${familyId}/assets`).doc();
  await ref.set({
    ...data,
    attachmentURL: data.attachmentURL ?? null,
    symbol: data.symbol ?? null,
    quantity: data.quantity ?? null,
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
      | "name"
      | "category"
      | "currency"
      | "amount"
      | "symbol"
      | "quantity"
      | "description"
      | "attachmentURL"
      | "visibility"
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
