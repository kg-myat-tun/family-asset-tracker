import { NextResponse } from "next/server";
import { getAdminDb } from "@/firebase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth.server";
import { refreshMonthlySummaries } from "@/lib/monthly-summary.server";
import { postDueRecurringTransactions } from "@/lib/recurring.server";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const db = getAdminDb();
  const familiesSnap = await db.collection("families").get();

  let posted = 0;
  let summarized = 0;
  await Promise.all(
    familiesSnap.docs.map(async (familyDoc) => {
      const settings = familyDoc.data().settings ?? {};
      const baseCurrency = settings.baseCurrency ?? "USD";
      try {
        const postedDates = await postDueRecurringTransactions(familyDoc.id);
        posted += postedDates.length;

        // Backfilled occurrences can land in past months, so refresh those
        // summaries along with the current month's.
        await refreshMonthlySummaries(familyDoc.id, baseCurrency, [now, ...postedDates]);
        summarized++;
      } catch (err) {
        console.error(`recurring-transactions cron failed for family ${familyDoc.id}:`, err);
      }
    }),
  );

  return NextResponse.json({
    ok: true,
    month,
    familiesProcessed: familiesSnap.docs.length,
    posted,
    summarized,
  });
}
