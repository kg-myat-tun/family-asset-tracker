// One-off maintenance script: clears the `activity` subcollection for every
// family. Historical activity docs predate the privacy fix in
// `src/lib/activity.server.ts` and carry no `visibility`/owner field, so a
// selective scrub of private-item activity isn't reliable — we drop the whole
// (capped, ephemeral) recent-activity feed instead.
//
// Dry run (counts only):   node scripts/clear-activity.mjs
// Actually delete:         node scripts/clear-activity.mjs --delete
//
// Uses the same service account the app uses (FIREBASE_SERVICE_ACCOUNT_KEY_PATH
// or ./firebase/serviceAccountKey.json). This hits the LIVE project — check the
// printed project id before passing --delete.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const shouldDelete = process.argv.includes("--delete");

const keyPath = resolve(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH ?? "./firebase/serviceAccountKey.json",
);
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}
// Mirror the app's getAdminDb(): a named database when FIRESTORE_DATABASE_ID is set.
const databaseId = process.env.FIRESTORE_DATABASE_ID;
const db = databaseId ? getFirestore(databaseId) : getFirestore();

console.log(`Project:  ${serviceAccount.project_id}`);
console.log(`Database: ${databaseId ?? "(default)"}`);
console.log(`Mode:    ${shouldDelete ? "DELETE" : "dry run (no writes)"}`);
console.log("");

async function deleteInBatches(collectionRef) {
  let deleted = 0;
  // Page through the collection in chunks; commit a batched delete per page.
  while (true) {
    const snap = await collectionRef.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

const families = await db.collection("families").get();
let totalDocs = 0;

for (const family of families.docs) {
  const activityRef = family.ref.collection("activity");
  const countSnap = await activityRef.count().get();
  const count = countSnap.data().count;
  totalDocs += count;

  if (count === 0) continue;
  console.log(`families/${family.id}/activity: ${count} doc(s)`);

  if (shouldDelete) {
    const removed = await deleteInBatches(activityRef);
    console.log(`  deleted ${removed}`);
  }
}

console.log("");
console.log(
  shouldDelete
    ? `Done. Cleared ${totalDocs} activity doc(s) across ${families.size} families.`
    : `Dry run: ${totalDocs} activity doc(s) across ${families.size} families would be deleted. Re-run with --delete.`,
);

process.exit(0);
