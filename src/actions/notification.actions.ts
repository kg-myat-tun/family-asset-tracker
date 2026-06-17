"use server";

import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser } from "@/lib/family.server";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications.server";

async function getContextOrThrow() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) throw new Error("No family");
  return { user, family };
}

export async function markNotificationReadAction(notifId: string): Promise<void> {
  const { user, family } = await getContextOrThrow();
  await markNotificationRead(family.id, user.uid, notifId);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const { user, family } = await getContextOrThrow();
  await markAllNotificationsRead(family.id, user.uid);
}
