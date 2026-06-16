import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";

export type ActivityType =
  | "asset_added"
  | "asset_updated"
  | "loan_created"
  | "loan_updated"
  | "loan_deleted"
  | "repayment_made";

export async function logActivity(
  familyId: string,
  type: ActivityType,
  description: string,
): Promise<void> {
  await getAdminDb().collection(`families/${familyId}/activity`).add({
    type,
    description,
    createdAt: FieldValue.serverTimestamp(),
  });
}
