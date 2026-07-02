import { NextResponse } from "next/server";
import { getAdminDb } from "@/firebase/admin";
import { getCachedRates } from "@/lib/currency.server";
import { recordMonthlySummary } from "@/lib/monthly-summary.server";
import { postDueRecurringTransactions } from "@/lib/recurring.server";

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = new Date().toISOString().slice(0, 7);
  const db = getAdminDb();
  const familiesSnap = await db.collection("families").get();

  let posted = 0;
  let summarized = 0;
  await Promise.all(
    familiesSnap.docs.map(async (familyDoc) => {
      const settings = familyDoc.data().settings ?? {};
      const baseCurrency = settings.baseCurrency ?? "USD";
      try {
        posted += await postDueRecurringTransactions(familyDoc.id);

        const rates = await getCachedRates(familyDoc.id);
        await recordMonthlySummary(familyDoc.id, month, baseCurrency, rates);
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
