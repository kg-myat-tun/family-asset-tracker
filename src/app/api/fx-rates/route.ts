import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Not implemented yet. FX rate fetching is added in Phase 5." },
    { status: 501 },
  );
}
