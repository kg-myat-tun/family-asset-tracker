# Phase 9 — Production Readiness

## Goal
Harden the app for production: audited Firestore & Storage security rules, composite indexes, a Zod validation audit, rate limiting on sensitive Server Actions, error monitoring with Sentry, end-to-end tests with Playwright, and an environment-variable audit. No new features — this phase makes the app safe to deploy publicly.

---

## Architecture note — why the rules are restrictive

Every **write** in this app goes through a Server Action or Route Handler using the **Firebase Admin SDK**, which bypasses Firestore Security Rules entirely. The client SDK is used only for:

- Firebase Authentication (sign-in)
- Real-time `onSnapshot` **reads** in Client Components (Phase 7)
- Direct file uploads to Firebase **Storage** (Phase 4 — profile pictures, attachments)

There is **no legitimate path for the browser to write Firestore directly.** Therefore the audited rules below grant members generous *read* access and **deny all client writes** as defense in depth — if an attacker steals a session, they still cannot mutate data outside the validated Server Action layer.

---

## Step 1 — Audited Firestore Security Rules

Replace `firestore.rules` with the version below. Changes from the draft in the implementation plan:

- All `write`/`create`/`update`/`delete` on family data are **denied** (Admin SDK only).
- Every rule guards `request.auth != null` before calling `isMember`.
- `fxRates` is explicitly readable by members.
- `users/{userId}` is read-own, **write denied** (the `ensureUserProfile` and `createFamily` helpers write it via Admin SDK).

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function isMember(familyId) {
      return signedIn() &&
        exists(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid));
    }

    match /families/{familyId} {
      allow read: if isMember(familyId);
      allow write: if false; // Admin SDK only

      match /members/{userId} {
        allow read: if isMember(familyId);
        allow write: if false;
      }

      match /assets/{assetId} {
        allow read: if isMember(familyId);
        allow write: if false;
      }

      match /loans/{loanId} {
        allow read: if isMember(familyId);
        allow write: if false;

        match /repayments/{repaymentId} {
          allow read: if isMember(familyId);
          allow write: if false;
        }
      }

      match /fxRates/{date} {
        allow read: if isMember(familyId);
        allow write: if false;
      }
    }

    match /users/{userId} {
      allow read: if signedIn() && request.auth.uid == userId;
      allow write: if false;
    }
  }
}
```

> If a future phase introduces a genuine client-side Firestore write, narrow the specific `allow write` for that path only — never re-open a whole collection.

---

## Step 2 — Storage Security Rules

File uploads (profile pictures, asset attachments) go **client → Firebase Storage directly**, so Storage rules are the real enforcement boundary.

```javascript
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Profile pictures: a user may write only their own avatar
    match /avatars/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }

    // Asset attachments: any signed-in user may upload; path scoped by family
    match /attachments/{familyId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 10 * 1024 * 1024;
    }
  }
}
```

Deploy both rule files:
```bash
firebase deploy --only firestore:rules,storage
```

---

## Step 3 — Composite indexes

Phase 5's `getAssets` filters on `deleted` (and optionally `ownerId`) while ordering by `createdAt` — Firestore requires composite indexes for equality-plus-orderBy queries on different fields.

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "assets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "deleted", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "assets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "deleted", "order": "ASCENDING" },
        { "fieldPath": "ownerId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

```bash
firebase deploy --only firestore:indexes
```

> `loans` and `members` queries use a single-field order/equality only and rely on automatic indexes — no entry needed.

---

## Step 4 — Zod validation audit

Confirm **every** Server Action validates input before touching Firestore. Audit checklist — each must `safeParse` a Zod schema:

- [ ] `createFamilyAction` — `CreateFamilySchema`
- [ ] `createAssetAction` / `updateAssetAction` — `AssetSchema`
- [ ] `deleteAssetAction` — `assetId` is `z.string().min(1)`
- [ ] `createLoanAction` — `CreateLoanSchema`
- [ ] `recordRepaymentAction` — `RepaymentSchema`
- [ ] member invite / role-change actions — schemas from Phase 4

Move shared schemas into `src/lib/schemas.ts` so client forms and Server Actions validate against the same definition:

```typescript
// src/lib/schemas.ts
import { z } from "zod";

export const CURRENCY = z.string().length(3, "Invalid currency");

export const AssetSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  category: z.enum(["cash", "bank", "investment", "property", "crypto", "other"]),
  currency: CURRENCY,
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().max(500).optional().default(""),
  attachmentURL: z.string().url().optional().or(z.literal("")),
});
// ...re-export CreateLoanSchema, RepaymentSchema, CreateFamilySchema here too
```

Rule of thumb: a Server Action must never pass raw `FormData` or client-supplied IDs to a `src/lib/*.server.ts` helper without a schema in between.

---

## Step 5 — Rate limiting sensitive actions

`createLoanAction`, `recordRepaymentAction`, and the member-invite action are abuse-prone. Add per-user rate limiting with Vercel KV (or Upstash Redis).

```typescript
// src/lib/ratelimit.server.ts
import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";

const limiter = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 actions / minute / user
  prefix: "fat-rl",
});

export async function assertWithinRateLimit(uid: string, action: string) {
  const { success } = await limiter.limit(`${action}:${uid}`);
  if (!success) throw new Error("Too many requests — please slow down.");
}
```

Call `await assertWithinRateLimit(user.uid, "create-loan")` at the top of each sensitive action, right after `requireUser()`.

---

## Step 6 — Error monitoring (Sentry)

```bash
pnpm dlx @sentry/wizard@latest -i nextjs
```

The wizard creates `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and wraps `next.config.ts`. After setup:

- Set `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` in Vercel env vars.
- In each `error.tsx`, report the boundary error: `useEffect(() => Sentry.captureException(error), [error])`.
- Confirm **no `console.log`** remains in production code — replace diagnostics with `Sentry.captureMessage` or remove them (master checklist requirement).

---

## Step 7 — End-to-end tests (Playwright)

```bash
pnpm create playwright
```

Run E2E against the **Firebase emulator suite** so tests never touch production data:

```bash
firebase emulators:start --only auth,firestore,storage
```

Minimum critical-path coverage in `e2e/`:

- [ ] `auth.spec.ts` — unauthenticated visit to `/dashboard` redirects to `/login`
- [ ] `onboarding.spec.ts` — new user is sent to `/onboarding`; creating a family lands on `/dashboard`
- [ ] `assets.spec.ts` — create an asset → appears in list → soft-delete → disappears
- [ ] `loans.spec.ts` — create a loan → record a full repayment → status becomes `settled`
- [ ] `access.spec.ts` — a non-owner member cannot edit another member's asset

---

## Step 8 — Environment variable audit

- [ ] No secret is prefixed `NEXT_PUBLIC_` — only the six Firebase client keys and `NEXT_PUBLIC_APP_URL` carry that prefix.
- [ ] `FIREBASE_SERVICE_ACCOUNT_KEY_PATH`, `CRON_SECRET`, Sentry tokens, and KV credentials are **server-only**.
- [ ] Every key in `.env.local` has a matching empty key in `.env.example` (no real values committed).
- [ ] All production values are set in the Vercel project dashboard (Production + Preview scopes).
- [ ] `vercel.json` cron path includes `?secret=` matching `CRON_SECRET`.

Reference set (see `00-master.md` for the authoritative list):

```bash
# Server-only
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./firebase/serviceAccountKey.json
CRON_SECRET=
SENTRY_AUTH_TOKEN=
KV_REST_API_URL=
KV_REST_API_TOKEN=

# Client-safe (NEXT_PUBLIC_)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SENTRY_DSN=
```

---

## Step 9 — Security rules emulator test

Verify the rules deny what they should:

```bash
firebase emulators:exec --only firestore "pnpm test:rules"
```

Write `firestore.rules.test.ts` with `@firebase/rules-unit-testing`:

- [ ] A non-member **cannot read** another family's documents.
- [ ] A member **can read** assets, loans, members, and `fxRates` in their family.
- [ ] **No client write** to any family document or `users/*` succeeds (all denied).
- [ ] An unauthenticated request reads nothing.

---

## Verification / Completion Checklist

- [ ] `pnpm build` passes with zero TypeScript errors
- [ ] Firestore & Storage rules deployed and tested with the emulator
- [ ] Composite indexes deployed; no "missing index" errors in logs
- [ ] Every Server Action validates input with Zod
- [ ] Sensitive actions are rate-limited
- [ ] Sentry captures client, server, and edge errors
- [ ] Playwright critical-path suite passes against the emulator
- [ ] `.env.example` complete; nothing sensitive under `NEXT_PUBLIC_`
- [ ] `README.md` covers local setup, env vars, and deploy steps
- [ ] No `console.log` statements in production code
- [ ] Lighthouse score ≥ 90 on mobile
```
