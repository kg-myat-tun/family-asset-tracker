import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { DEFAULT_MMK_PER_USD } from "@/lib/currency";

// Pure helpers moved to currency.ts so client components can use them too.
// Re-exported here so existing server-side imports keep working unchanged.
export { convertAmount, formatCurrency } from "@/lib/currency";

const FX_API = "https://api.frankfurter.app/latest?base=USD";
const CBM_API = "https://forex.cbm.gov.mm/api/latest";

// The FX provider (Frankfurter/ECB) has no MMK rate, so we inject one from the
// family's settings.mmkPerUsd. rates are USD-based (units per 1 USD), and CBM's
// rates.USD is MMK per 1 USD, so the value maps in directly.
export function applyMmkRate(
  rates: Record<string, number>,
  mmkPerUsd: number,
): Record<string, number> {
  return { ...rates, MMK: mmkPerUsd };
}

// Latest official MMK-per-USD from the Central Bank of Myanmar, or null on any
// failure (used only to seed/refresh a family's rate — never on a hot read path).
export async function fetchCbmUsdRate(): Promise<number | null> {
  try {
    const res = await fetch(CBM_API, {
      next: { revalidate: 3600, tags: ["fx-rates"] },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const { rates } = (await res.json()) as { rates?: Record<string, string> };
    const raw = rates?.USD;
    if (!raw) return null;
    const value = Number(raw.replace(/,/g, ""));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

async function getFamilyMmkRate(familyId: string): Promise<number> {
  const snap = await getAdminDb().doc(`families/${familyId}`).get();
  return snap.data()?.settings?.mmkPerUsd ?? DEFAULT_MMK_PER_USD;
}

export async function getCachedRates(familyId: string): Promise<Record<string, number>> {
  const db = getAdminDb();
  const today = new Date().toISOString().split("T")[0];

  const mmkPerUsd = await getFamilyMmkRate(familyId);

  const todaySnap = await db.doc(`families/${familyId}/fxRates/${today}`).get();
  if (todaySnap.exists) return applyMmkRate(todaySnap.data()?.rates ?? {}, mmkPerUsd);

  const recentSnap = await db
    .collection(`families/${familyId}/fxRates`)
    .orderBy("fetchedAt", "desc")
    .limit(1)
    .get();

  if (!recentSnap.empty) return applyMmkRate(recentSnap.docs[0].data().rates, mmkPerUsd);

  return applyMmkRate(await fetchAndCacheRates(familyId), mmkPerUsd);
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
