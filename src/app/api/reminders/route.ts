import { NextResponse } from "next/server";
import { generateReminders } from "@/lib/notifications.server";

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { created } = await generateReminders();
  return NextResponse.json({ ok: true, created });
}
