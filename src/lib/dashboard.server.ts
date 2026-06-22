import "server-only";

import { getAdminDb } from "@/firebase/admin";
import { applyLivePrices } from "@/lib/asset-price.server";
import { convertAmount, getCachedRates } from "@/lib/currency.server";
import { liveLoanState } from "@/lib/loan-interest";
import { getNetWorthSnapshots } from "@/lib/networth.server";
import { canViewAsset, canViewLoan } from "@/lib/visibility";
import type { Asset, CompoundingPeriod, FamilyMember, Loan, NetWorthSnapshot } from "@/types";

export interface MemberSummary {
  member: FamilyMember;
  // Assets only (kept for the by-member assets chart).
  totalInBase: number;
  assetCount: number;
  // Loans, in base currency: owed to this member vs owed by them.
  receivables: number;
  liabilities: number;
  netWorth: number;
}

export interface DashboardData {
  totalNetWorth: number;
  assetsTotal: number;
  receivablesTotal: number;
  liabilitiesTotal: number;
  memberSummaries: MemberSummary[];
  activeLoans: Loan[];
  overdueLoans: Loan[];
  recentAssets: Asset[];
  snapshots: NetWorthSnapshot[];
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

  const visibleAssets: Asset[] = assetsSnap.docs
    .map((doc) => {
      const d = doc.data();
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
        deleted: false,
        createdAt: d.createdAt.toDate(),
        updatedAt: d.updatedAt.toDate(),
      } satisfies Asset;
    })
    .filter((a) => canViewAsset(a, viewerUid));

  // Replace stock/crypto amounts with live market values before any totalling.
  const assets = await applyLivePrices(visibleAssets);

  const activeLoans: Loan[] = loansSnap.docs
    .map((doc) => {
      const d = doc.data();
      const createdAt = d.createdAt.toDate();
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
        compoundingPeriod: (d.compoundingPeriod ?? "none") as CompoundingPeriod,
        installmentCount: d.installmentCount ?? null,
        firstPaymentDate: d.firstPaymentDate ? d.firstPaymentDate.toDate() : null,
        interestStartDate: d.interestStartDate ? d.interestStartDate.toDate() : createdAt,
        principalOutstanding: d.principalOutstanding ?? d.remainingAmount,
        accruedInterestSnapshot: d.accruedInterestSnapshot ?? 0,
        lastEventDate: d.lastEventDate ? d.lastEventDate.toDate() : createdAt,
        description: d.description,
        status: d.status,
        dueDate: d.dueDate ? d.dueDate.toDate() : null,
        createdAt,
        updatedAt: d.updatedAt.toDate(),
      } satisfies Loan;
    })
    .filter((l) => canViewLoan(l, viewerUid));

  // Loan balances in base currency, keyed by the member on each side.
  const owedTo = new Map<string, number>();
  const owedBy = new Map<string, number>();
  for (const loan of activeLoans) {
    const owed = convertAmount(liveLoanState(loan).totalOwed, loan.currency, baseCurrency, rates);
    if (loan.lenderId) owedTo.set(loan.lenderId, (owedTo.get(loan.lenderId) ?? 0) + owed);
    if (loan.borrowerId) owedBy.set(loan.borrowerId, (owedBy.get(loan.borrowerId) ?? 0) + owed);
  }

  const memberSummaries: MemberSummary[] = members.map((member) => {
    const memberAssets = assets.filter((a) => a.ownerId === member.uid);
    const totalInBase = memberAssets.reduce(
      (sum, a) => sum + convertAmount(a.amount, a.currency, baseCurrency, rates),
      0,
    );
    const receivables = owedTo.get(member.uid) ?? 0;
    const liabilities = owedBy.get(member.uid) ?? 0;
    return {
      member,
      totalInBase,
      assetCount: memberAssets.length,
      receivables,
      liabilities,
      netWorth: totalInBase + receivables - liabilities,
    };
  });

  const assetsTotal = memberSummaries.reduce((sum, s) => sum + s.totalInBase, 0);
  const receivablesTotal = memberSummaries.reduce((sum, s) => sum + s.receivables, 0);
  const liabilitiesTotal = memberSummaries.reduce((sum, s) => sum + s.liabilities, 0);
  const totalNetWorth = assetsTotal + receivablesTotal - liabilitiesTotal;
  const overdueLoans = activeLoans.filter((l) => l.dueDate && l.dueDate < today);
  const recentAssets = assets.slice(0, 5);
  const snapshots = await getNetWorthSnapshots(familyId, 90);

  return {
    totalNetWorth,
    assetsTotal,
    receivablesTotal,
    liabilitiesTotal,
    memberSummaries,
    activeLoans,
    overdueLoans,
    recentAssets,
    snapshots,
  };
}
