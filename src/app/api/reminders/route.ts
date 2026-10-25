import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth.server";
import { generateReminders } from "@/lib/notifications.server";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { created } = await generateReminders();
  return NextResponse.json({ ok: true, created });
}
