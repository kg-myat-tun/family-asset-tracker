import type { Asset, Income, Loan } from "@/types";

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

export function canViewIncome(
  income: Pick<Income, "ownerId" | "visibility">,
  viewerUid: string,
): boolean {
  return income.visibility === "shared" || income.ownerId === viewerUid;
}
