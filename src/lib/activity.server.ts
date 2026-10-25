import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import type { Visibility } from "@/types";

export type ActivityType =
  | "asset_added"
  | "asset_updated"
  | "transaction_added"
  | "transaction_updated"
  | "recurring_rule_added"
  | "recurring_rule_updated"
  | "loan_created"
  | "loan_updated"
  | "loan_deleted"
  | "repayment_made";

/**
 * Records a family activity entry. Descriptions embed the item's name and amount,
 * and the feed is read client-side by every family member, so activity for a
 * `private` asset/loan is intentionally never written — it would leak the item to
 * the whole family. Private items simply don't appear in the shared feed.
 *
 * `itemId` back-references the source asset/loan so its history can be purged if
 * the item later becomes private — see `deleteActivityForItem`.
 */
export async function logActivity(
  familyId: string,
  type: ActivityType,
  description: string,
  visibility: Visibility = "shared",
  itemId?: string,
): Promise<void> {
  if (visibility === "private") return;

  await getAdminDb()
    .collection(`families/${familyId}/activity`)
    .add({
      type,
      description,
      itemId: itemId ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Removes every activity entry for a given asset/loan. Called when an item flips
 * to `private`: its earlier `shared` entries must disappear from the family feed,
 * since the item itself is now hidden from everyone but the owner/participants.
 */
export async function deleteActivityForItem(familyId: string, itemId: string): Promise<void> {
  const db = getAdminDb();
  const snap = await db
    .collection(`families/${familyId}/activity`)
    .where("itemId", "==", itemId)
    .get();
  if (snap.empty) return;

  const batch = db.batch();
  for (const doc of snap.docs) batch.delete(doc.ref);
  await batch.commit();
}
