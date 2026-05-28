import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/firebase/admin";

const FX_API = "https://api.frankfurter.app/latest?base=USD";

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(FX_API);
  if (!res.ok) return NextResponse.json({ error: "FX fetch failed" }, { status: 500 });

  const { rates } = (await res.json()) as { rates: Record<string, number> };
  rates.USD = 1;

  const today = new Date().toISOString().split("T")[0];
  const db = getAdminDb();
  const familiesSnap = await db.collection("families").get();
  const batch = db.batch();
  for (const familyDoc of familiesSnap.docs) {
    const rateRef = db.doc(`families/${familyDoc.id}/fxRates/${today}`);
    batch.set(rateRef, { base: "USD", rates, fetchedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();

  return NextResponse.json({ ok: true, date: today, currencies: Object.keys(rates).length });
}
