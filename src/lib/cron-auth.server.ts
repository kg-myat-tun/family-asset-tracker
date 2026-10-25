import "server-only";

import { timingSafeEqual } from "node:crypto";

// Vercel Cron calls each path in vercel.json with an
// `Authorization: Bearer <CRON_SECRET>` header. The secret is never put in the
// URL: query strings end up in request logs. To invoke a cron route by hand:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/fx-rates
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
