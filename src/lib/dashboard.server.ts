import "server-only";

import { getAdminDb } from "@/firebase/admin";
import { convertAmount, getCachedRates } from "@/lib/currency.server";
import { canViewAsset, canViewLoan } from "@/lib/visibility";
import type { Asset, FamilyMember, Loan } from "@/types";

export interface MemberSummary {
  member: FamilyMember;
  totalInBase: number;
  assetCount: number;
}

export interface DashboardData {
  totalNetWorth: number;
  memberSummaries: MemberSummary[];
  activeLoans: Loan[];
  overdueLoans: Loan[];
  recentAssets: Asset[];
}

export async function getDashboardData(
  familyId: string,
  members: FamilyMember[],
  baseCurrency: string,
  viewerUid: string,
): Promise<DashboardData> {
  const db = getAdminDb();
  const rates = await getCachedRates(familyId);
  const today = new Date();

  const [assetsSnap, loansSnap] = await Promise.all([
    db
      .collection(`families/${familyId}/assets`)
      .where("deleted", "==", false)
      .orderBy("createdAt", "desc")
      .get(),
    db.collection(`families/${familyId}/loans`).where("status", "!=", "settled").get(),
  ]);

  const assets: Asset[] = assetsSnap.docs
    .map((doc) => {
      const d = doc.data();
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
        deleted: false,
        createdAt: d.createdAt.toDate(),
        updatedAt: d.updatedAt.toDate(),
      } satisfies Asset;
    })
    .filter((a) => canViewAsset(a, viewerUid));

  const activeLoans: Loan[] = loansSnap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        lenderId: d.lenderId ?? null,
        borrowerId: d.borrowerId ?? null,
        lenderName: d.lenderName ?? null,
        borrowerName: d.borrowerName ?? null,
        visibility: d.visibility ?? "shared",
        currency: d.currency,
        principalAmount: d.principalAmount,
        remainingAmount: d.remainingAmount,
        interestRate: d.interestRate ?? null,
        description: d.description,
        status: d.status,
        dueDate: d.dueDate ? d.dueDate.toDate() : null,
        createdAt: d.createdAt.toDate(),
        updatedAt: d.updatedAt.toDate(),
      } satisfies Loan;
    })
    .filter((l) => canViewLoan(l, viewerUid));

  const memberSummaries: MemberSummary[] = members.map((member) => {
    const memberAssets = assets.filter((a) => a.ownerId === member.uid);
    const totalInBase = memberAssets.reduce(
      (sum, a) => sum + convertAmount(a.amount, a.currency, baseCurrency, rates),
      0,
    );
    return { member, totalInBase, assetCount: memberAssets.length };
  });

  const totalNetWorth = memberSummaries.reduce((sum, s) => sum + s.totalInBase, 0);
  const overdueLoans = activeLoans.filter((l) => l.dueDate && l.dueDate < today);
  const recentAssets = assets.slice(0, 5);

  return { totalNetWorth, memberSummaries, activeLoans, overdueLoans, recentAssets };
}
