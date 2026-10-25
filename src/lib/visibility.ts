import type { Asset, Loan, RecurringRule, Transaction } from "@/types";

/**
 * Visibility rules. "shared" items are visible to the whole family; "private"
 * items are visible only to the owner (assets) or the participating family
 * member(s) (loans). Admins do NOT get to see other members' private items.
 */

export function canViewAsset(
  asset: Pick<Asset, "ownerId" | "visibility">,
  viewerUid: string,
): boolean {
  return asset.visibility === "shared" || asset.ownerId === viewerUid;
}

export function canViewLoan(
  loan: Pick<Loan, "lenderId" | "borrowerId" | "visibility">,
  viewerUid: string,
): boolean {
  return (
    loan.visibility === "shared" || loan.lenderId === viewerUid || loan.borrowerId === viewerUid
  );
}

export function canViewTransaction(
  transaction: Pick<Transaction, "ownerId" | "visibility">,
  viewerUid: string,
): boolean {
  return transaction.visibility === "shared" || transaction.ownerId === viewerUid;
}

export function canViewRecurringRule(
  rule: Pick<RecurringRule, "ownerId" | "visibility">,
  viewerUid: string,
): boolean {
  return rule.visibility === "shared" || rule.ownerId === viewerUid;
}
