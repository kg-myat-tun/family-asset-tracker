import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";

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
  const res = await fetch(FX_API, {
    next: { revalidate: 3600 },
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

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency] ?? 1;
  const toRate = rates[toCurrency] ?? 1;
  return (amount / fromRate) * toRate;
}

export function formatCurrency(amount: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
