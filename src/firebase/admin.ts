import "server-only";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { getRequiredEnv } from "@/lib/env";

const serviceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});

function getAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const serviceAccountPath = resolve(getRequiredEnv("FIREBASE_SERVICE_ACCOUNT_KEY_PATH"));
  const serviceAccountRaw = readFileSync(serviceAccountPath, "utf8");
  const serviceAccount = serviceAccountSchema.parse(JSON.parse(serviceAccountRaw));

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
    projectId: serviceAccount.project_id,
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  const databaseId = process.env.FIRESTORE_DATABASE_ID;
  return databaseId ? getFirestore(getAdminApp(), databaseId) : getFirestore(getAdminApp());
}
