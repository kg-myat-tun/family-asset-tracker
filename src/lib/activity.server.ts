import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import type { Visibility } from "@/types";

export type ActivityType =
  | "asset_added"
  | "asset_updated"
  | "loan_created"
  | "loan_updated"
  | "loan_deleted"
  | "repayment_made";

/**
 * Records a family activity entry. Descriptions embed the item's name and amount,
 * and the feed is read client-side by every family member, so activity for a
 * `private` asset/loan is intentionally never written — it would leak the item to
 * the whole family. Private items simply don't appear in the shared feed.
 */
export async function logActivity(
  familyId: string,
  type: ActivityType,
  description: string,
  visibility: Visibility = "shared",
): Promise<void> {
  if (visibility === "private") return;

  await getAdminDb().collection(`families/${familyId}/activity`).add({
    type,
    description,
    createdAt: FieldValue.serverTimestamp(),
  });
}
