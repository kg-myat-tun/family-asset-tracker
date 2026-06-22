import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";

// Pure helpers moved to currency.ts so client components can use them too.
// Re-exported here so existing server-side imports keep working unchanged.
export { convertAmount, formatCurrency } from "@/lib/currency";

const FX_API = "https://api.frankfurter.app/latest?base=USD";

export async function getCachedRates(familyId: string): Promise<Record<string, number>> {
  const db = getAdminDb();
  const today = new Date().toISOString().split("T")[0];

  const todaySnap = await db.doc(`families/${familyId}/fxRates/${today}`).get();
  if (todaySnap.exists) return todaySnap.data()?.rates ?? {};

  const recentSnap = await db
    .collection(`families/${familyId}/fxRates`)
    .orderBy("fetchedAt", "desc")
    .limit(1)
    .get();

  if (!recentSnap.empty) return recentSnap.docs[0].data().rates;

  return fetchAndCacheRates(familyId);
}

export async function fetchAndCacheRates(familyId: string): Promise<Record<string, number>> {
  // Tagged so the daily FX cron can force-refresh the upstream rates with
  // revalidateTag("fx-rates"); otherwise this stays cached for up to an hour.
  const res = await fetch(FX_API, {
    next: { revalidate: 3600, tags: ["fx-rates"] },
  });
  if (!res.ok) throw new Error("FX API unavailable");
  const { rates } = (await res.json()) as { rates: Record<string, number> };
  rates.USD = 1;

  const today = new Date().toISOString().split("T")[0];
  await getAdminDb().doc(`families/${familyId}/fxRates/${today}`).set({
    base: "USD",
    rates,
    fetchedAt: FieldValue.serverTimestamp(),
  });

  return rates;
}
