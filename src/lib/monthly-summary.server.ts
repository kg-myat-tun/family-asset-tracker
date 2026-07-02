import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { convertAmount } from "@/lib/currency";
import type { MonthlySummary } from "@/types";

// Sums that month's non-deleted transactions across ALL visibilities (private
// included) and upserts monthlySummaries/{month} — an objective family-wide
// total, same precedent as recordNetWorthSnapshot in networth.server.ts. The
// per-viewer visibility filter only applies to itemized reads (transaction
// lists/detail via getTransactions), never to this aggregate. Queries by date
// range only (no equality filter combined — see Global Constraints) and
// filters `deleted` in application code.
export async function recordMonthlySummary(
  familyId: string,
  month: string, // "YYYY-MM"
  baseCurrency: string,
  rates: Record<string, number>,
): Promise<void> {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const snap = await getAdminDb()
    .collection(`families/${familyId}/transactions`)
    .where("date", ">=", start)
    .where("date", "<", end)
    .get();

  let totalIncomeBase = 0;
  let totalExpenseBase = 0;
  const byCategoryBase: Record<string, number> = {};

  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.deleted) continue;
    const amountBase = convertAmount(d.amount, d.currency, baseCurrency, rates);
    if (d.type === "income") totalIncomeBase += amountBase;
    else totalExpenseBase += amountBase;
    byCategoryBase[d.category] = (byCategoryBase[d.category] ?? 0) + amountBase;
  }

  await getAdminDb()
    .doc(`families/${familyId}/monthlySummaries/${month}`)
    .set({
      month,
      totalIncomeBase,
      totalExpenseBase,
      netBase: totalIncomeBase - totalExpenseBase,
      byCategoryBase,
      baseCurrency,
      recordedAt: FieldValue.serverTimestamp(),
    });
}

export async function getMonthlySummaries(familyId: string, limit = 12): Promise<MonthlySummary[]> {
  const snap = await getAdminDb()
    .collection(`families/${familyId}/monthlySummaries`)
    .orderBy("month", "desc")
    .limit(limit)
    .get();

  return snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        month: d.month,
        totalIncomeBase: d.totalIncomeBase ?? 0,
        totalExpenseBase: d.totalExpenseBase ?? 0,
        netBase: d.netBase ?? 0,
        byCategoryBase: d.byCategoryBase ?? {},
        baseCurrency: d.baseCurrency,
        recordedAt: d.recordedAt.toDate(),
      } satisfies MonthlySummary;
    })
    .reverse(); // oldest -> newest for charting
}
