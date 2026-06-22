import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { applyLivePrices } from "@/lib/asset-price.server";
import { convertAmount } from "@/lib/currency.server";
import { liveLoanState } from "@/lib/loan-interest";
import { getLoans } from "@/lib/loans.server";
import type { Asset, NetWorthSnapshot } from "@/types";

export interface NetWorthBreakdown {
  assetsTotal: number;
  receivablesTotal: number;
  liabilitiesTotal: number;
  totalNetWorth: number;
}

/**
 * Canonical, family-wide net worth: assets + money owed to family members
 * (loans they lent) − money family members owe (loans they borrowed), all in
 * the base currency. Unlike the dashboard headline this ignores per-viewer
 * visibility — it's the objective family metric used for history snapshots.
 *
 * Loans between two family members net to zero here (one side's receivable is
 * the other's liability); only loans involving an external party move the
 * needle, which is the correct accounting.
 */
export async function computeFamilyNetWorth(
  familyId: string,
  baseCurrency: string,
  rates: Record<string, number>,
): Promise<NetWorthBreakdown> {
  const db = getAdminDb();
  const [assetsSnap, loans] = await Promise.all([
    db.collection(`families/${familyId}/assets`).where("deleted", "==", false).get(),
    getLoans(familyId),
  ]);

  // Build asset records and resolve live stock/crypto values before totalling,
  // so the daily net-worth snapshot reflects current market prices.
  const assets: Asset[] = assetsSnap.docs.map((doc) => {
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
  });
  const pricedAssets = await applyLivePrices(assets);
  const assetsTotal = pricedAssets.reduce(
    (sum, a) => sum + convertAmount(a.amount, a.currency, baseCurrency, rates),
    0,
  );

  let receivablesTotal = 0;
  let liabilitiesTotal = 0;
  for (const loan of loans) {
    if (loan.status === "settled") continue;
    const owed = convertAmount(liveLoanState(loan).totalOwed, loan.currency, baseCurrency, rates);
    // A family member lent (id set) => receivable; borrowed (id set) => liability.
    if (loan.lenderId) receivablesTotal += owed;
    if (loan.borrowerId) liabilitiesTotal += owed;
  }

  return {
    assetsTotal,
    receivablesTotal,
    liabilitiesTotal,
    totalNetWorth: assetsTotal + receivablesTotal - liabilitiesTotal,
  };
}

/** Upsert today's net-worth snapshot (idempotent: one doc per calendar day). */
export async function recordNetWorthSnapshot(
  familyId: string,
  baseCurrency: string,
  rates: Record<string, number>,
): Promise<void> {
  const breakdown = await computeFamilyNetWorth(familyId, baseCurrency, rates);
  const date = new Date().toISOString().split("T")[0];
  await getAdminDb()
    .doc(`families/${familyId}/netWorthSnapshots/${date}`)
    .set({ date, ...breakdown, recordedAt: FieldValue.serverTimestamp() });
}

export async function getNetWorthSnapshots(
  familyId: string,
  limit = 90,
): Promise<NetWorthSnapshot[]> {
  const snap = await getAdminDb()
    .collection(`families/${familyId}/netWorthSnapshots`)
    .orderBy("date", "desc")
    .limit(limit)
    .get();

  return snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        date: d.date,
        assetsTotal: d.assetsTotal ?? 0,
        receivablesTotal: d.receivablesTotal ?? 0,
        liabilitiesTotal: d.liabilitiesTotal ?? 0,
        totalNetWorth: d.totalNetWorth ?? 0,
      } satisfies NetWorthSnapshot;
    })
    .reverse(); // oldest → newest for charting
}
