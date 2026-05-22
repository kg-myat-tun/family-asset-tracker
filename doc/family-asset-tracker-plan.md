# Family Asset Tracker — Implementation Plan
**Stack: Next.js (App Router) + Firebase**

> **Status: planning artifact.** This document captures the original design. The
> numbered phase files (`01-project-setup.md` … `09-production.md`) are the
> **authoritative implementation contract** — where a code sample here differs
> from a phase file, the phase file wins. Known divergences are flagged inline below.

---

## 1. Project Overview

A multi-user family financial dashboard to track assets across currencies and manage inter-family loans. Built with Next.js 14+ App Router for SSR/Server Components and Firebase for auth, Firestore (database), and Storage. Deployed as a **separate Vercel project** from your portfolio.

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 14+ (App Router) | SSR, Server Components, Server Actions |
| UI | React + Tailwind CSS | Component library |
| Auth | Firebase Authentication | Email/password + Google OAuth |
| Database | Cloud Firestore | Real-time data, nested collections |
| Storage | Firebase Storage | Profile pictures, document attachments |
| Currency API | Frankfurter API (free) / Open Exchange Rates | Live FX rates |
| Hosting | Vercel | Deploy Next.js SSR (separate project from portfolio) |
| State | Server Components + React Context | Server-first, minimal client state |

---

## 3. Data Architecture (Firestore)

### 3.1 Collections Schema

```
families/{familyId}
  ├── name: string
  ├── inviteCode: string           // 6-char code new members use to join
  ├── createdAt: timestamp
  ├── createdBy: userId
  └── settings/
        └── baseCurrency: string   // e.g. "THB"

families/{familyId}/members/{userId}
  ├── displayName: string
  ├── email: string
  ├── photoURL: string
  ├── role: "admin" | "member" | "viewer"
  ├── joinedAt: timestamp
  └── status: "active" | "invited" | "removed"

families/{familyId}/assets/{assetId}
  ├── ownerId: userId
  ├── name: string
  ├── category: "cash" | "bank" | "investment" | "property" | "crypto" | "other"
  ├── currency: string             // ISO 4217 e.g. "USD", "THB", "JPY"
  ├── amount: number
  ├── description: string
  ├── attachmentURL?: string       // Firebase Storage URL
  ├── deleted: boolean             // soft-delete flag; all queries filter deleted == false
  ├── createdAt: timestamp
  └── updatedAt: timestamp

families/{familyId}/loans/{loanId}
  ├── lenderId: userId
  ├── borrowerId: userId
  ├── currency: string
  ├── principalAmount: number
  ├── remainingAmount: number
  ├── interestRate?: number        // optional annual %
  ├── description: string
  ├── status: "active" | "partially_paid" | "settled"
  ├── dueDate?: timestamp
  ├── createdAt: timestamp
  └── updatedAt: timestamp

families/{familyId}/loans/{loanId}/repayments/{repaymentId}
  ├── amount: number
  ├── currency: string             // may differ from loan currency
  ├── exchangeRateUsed?: number
  ├── note: string
  ├── paidAt: timestamp
  └── recordedBy: userId

families/{familyId}/fxRates/{date}   // cached daily rates
  ├── base: string
  ├── rates: { USD: 1, THB: 33.5, JPY: 149.2, ... }
  └── fetchedAt: timestamp

users/{userId}                       // global user profile
  ├── displayName: string
  ├── email: string
  ├── photoURL: string
  ├── familyIds: string[]            // families this user belongs to
  └── createdAt: timestamp
```

### 3.2 Security Rules (Firestore)

> **Superseded by `09-production.md` Step 1.** These draft rules allow client-side
> writes, but all writes in the final design go through the Admin SDK (which bypasses
> rules). The audited rules deny every client write as defense in depth. Use the
> Phase 9 version when deploying.

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isMember(familyId) {
      return exists(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid));
    }

    function isAdmin(familyId) {
      return get(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid)).data.role == "admin";
    }

    match /families/{familyId} {
      allow read: if isMember(familyId);
      allow create: if request.auth != null;
      allow update, delete: if isAdmin(familyId);

      match /members/{userId} {
        allow read: if isMember(familyId);
        allow write: if isAdmin(familyId) || request.auth.uid == userId;
      }

      match /assets/{assetId} {
        allow read: if isMember(familyId);
        allow create: if isMember(familyId);
        allow update, delete: if isMember(familyId) &&
          (resource.data.ownerId == request.auth.uid || isAdmin(familyId));
      }

      match /loans/{loanId} {
        allow read: if isMember(familyId);
        allow create: if isMember(familyId);
        allow update: if isMember(familyId) &&
          (resource.data.lenderId == request.auth.uid || isAdmin(familyId));

        match /repayments/{repaymentId} {
          allow read: if isMember(familyId);
          allow create: if isMember(familyId);
        }
      }
    }

    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

---

## 4. Next.js App Structure

```
src/
├── app/
│   ├── layout.tsx                        # Root layout, fonts, providers
│   ├── page.tsx                          # Redirect → /dashboard or /login
│   │
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx                  # Sign in page
│   │   └── onboarding/
│   │       └── page.tsx                  # Create or join a family
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Auth guard + family context (Server Component)
│   │   ├── page.tsx                      # Overview / net worth dashboard
│   │   │
│   │   ├── members/
│   │   │   ├── page.tsx                  # Member list + invite
│   │   │   └── [memberId]/
│   │   │       └── page.tsx              # Member detail, their assets & loans
│   │   │
│   │   ├── assets/
│   │   │   ├── page.tsx                  # All assets, filterable
│   │   │   ├── new/
│   │   │   │   └── page.tsx              # Add asset form
│   │   │   └── [assetId]/
│   │   │       ├── page.tsx              # Asset detail
│   │   │       └── edit/
│   │   │           └── page.tsx          # Edit asset
│   │   │
│   │   └── loans/
│   │       ├── page.tsx                  # Loan overview (I lent / I owe)
│   │       ├── new/
│   │       │   └── page.tsx              # Create loan
│   │       └── [loanId]/
│   │           ├── page.tsx              # Loan detail + repayment history
│   │           └── repay/
│   │               └── page.tsx          # Record repayment
│   │
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts            # POST: verify Firebase ID token → set session cookie
│       │   └── logout/route.ts           # POST: clear session cookie
│       └── fx-rates/route.ts             # GET: fetch & cache FX rates (called by cron)
│
├── firebase/
│   ├── client.ts                         # Firebase client SDK init (used in Client Components)
│   └── admin.ts                          # Firebase Admin SDK init (server-only)
│
├── lib/
│   ├── auth.server.ts                    # requireUser() using cookies() + Admin SDK
│   ├── currency.server.ts                # FX rate fetching & conversion
│   ├── assets.server.ts                  # Asset CRUD (Firestore, server-side)
│   ├── loans.server.ts                   # Loan CRUD + repayment transaction
│   └── members.server.ts                 # Member management helpers
│
├── actions/
│   ├── asset.actions.ts                  # Server Actions for asset mutations
│   ├── loan.actions.ts                   # Server Actions for loan/repayment mutations
│   └── member.actions.ts                 # Server Actions for invite/role changes
│
└── components/
    ├── layout/
    │   ├── AppShell.tsx                  # Sidebar + topbar wrapper
    │   ├── Sidebar.tsx
    │   └── Header.tsx
    ├── ui/
    │   ├── CurrencyInput.tsx             # Amount input with currency selector
    │   ├── CurrencyBadge.tsx
    │   ├── AmountDisplay.tsx             # Format + convert to base currency
    │   └── MemberAvatar.tsx
    ├── assets/
    │   ├── AssetCard.tsx
    │   ├── AssetForm.tsx                 # Used for new + edit
    │   └── AssetList.tsx
    └── loans/
        ├── LoanCard.tsx
        ├── LoanForm.tsx
        ├── RepaymentForm.tsx
        └── LoanSummary.tsx
```

---

## 5. Feature Implementation Details

### 5.1 Authentication & Session Management

Next.js App Router uses `cookies()` from `next/headers` — no need to thread `request` through every function.

```typescript
// lib/auth.server.ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/firebase/admin";

export async function requireUser() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) redirect("/login");

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded;
  } catch {
    redirect("/login");
  }
}
```

**Auth flow:**
1. Client signs in via Firebase Auth (email/password or Google)
2. Client gets ID token → `POST /api/auth/login` with token in body
3. Route Handler verifies token with Admin SDK → creates Firebase session cookie (httpOnly, secure, 14-day expiry)
4. All Server Components call `requireUser()` — fully SSR-safe, no client exposure

```typescript
// app/api/auth/login/route.ts
export async function POST(request: Request) {
  const { idToken } = await request.json();
  const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

  const response = NextResponse.json({ status: "ok" });
  response.cookies.set("session", sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: expiresIn / 1000,
    path: "/",
  });
  return response;
}
```

---

### 5.2 Users & Family Management

**Dashboard layout as auth guard:**
```typescript
// app/(dashboard)/layout.tsx
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/members.server";
import { AppShell } from "@/components/layout/AppShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  const members = await getFamilyMembers(family.id);

  return (
    <AppShell user={user} family={family} members={members}>
      {children}
    </AppShell>
  );
}
```

**Invite flow:**
1. Admin enters email → Server Action creates `members` doc with `status: "invited"`
2. Firebase Cloud Function triggers on doc creation → sends invite email with magic link
3. Invitee signs up → Cloud Function links them to the family automatically
4. Admin can change roles: `admin | member | viewer`

---

### 5.3 Asset Management (Multi-Currency)

**Asset categories:** Cash, Bank Account, Investment, Property, Crypto, Other

**Multi-currency design:**
- Each asset stores its **native currency + amount**
- Dashboard converts all to **family base currency** using cached FX rates
- FX rates fetched once daily via `/api/fx-rates` (triggered by Vercel Cron), stored in `fxRates/{YYYY-MM-DD}` Firestore doc
- Fallback: use previous day's rates if API is down

```typescript
// lib/currency.server.ts
export async function getConvertedAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  familyId: string
): Promise<number> {
  const rates = await getCachedRates(familyId);  // reads from Firestore
  const inBase = amount / rates[fromCurrency];
  return inBase * rates[toCurrency];
}

// Vercel Cron job: fetch and cache daily
// app/api/fx-rates/route.ts
export async function GET() {
  const res = await fetch("https://api.frankfurter.app/latest?base=USD");
  const { rates } = await res.json();
  const today = new Date().toISOString().split("T")[0];
  await db.doc(`fxRates/${today}`).set({ base: "USD", rates, fetchedAt: new Date() });
  return Response.json({ ok: true });
}
```

**Server Action for creating an asset:**
```typescript
// actions/asset.actions.ts
"use server";
import { requireUser } from "@/lib/auth.server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const AssetSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["cash", "bank", "investment", "property", "crypto", "other"]),
  currency: z.string().length(3),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
});

export async function createAsset(formData: FormData) {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);

  const parsed = AssetSchema.parse(Object.fromEntries(formData));
  // Server Actions write via the Admin SDK — never the client SDK.
  await adminDb.collection(`families/${family.id}/assets`).add({
    ...parsed,
    ownerId: user.uid,
    deleted: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath("/assets");
}
```

> **Note:** This is illustrative. In the final design (`05-assets.md`), the
> Firestore write lives in `src/lib/assets.server.ts` and the Server Action only
> validates input and calls it — no business logic in the action itself.

---

### 5.4 Loan Tracking (User-to-User, Multi-Currency)

**Loan creation:** Lender selects borrower, amount, currency, optional due date & interest rate. System creates `loan` doc with `remainingAmount = principalAmount`.

**Repayment recording:**
- Either party can record a repayment
- Repayment can be in a **different currency** than the loan
- Exchange rate captured at time of repayment for full audit trail
- `remainingAmount` updated atomically via Firestore transaction

```typescript
// lib/loans.server.ts
export async function recordRepayment(
  familyId: string,
  loanId: string,
  repayment: RepaymentInput
) {
  await db.runTransaction(async (tx) => {
    const loanRef = db.doc(`families/${familyId}/loans/${loanId}`);
    const loan = (await tx.get(loanRef)).data()!;

    const rates = await getCachedRates(familyId);
    const exchangeRate = rates[loan.currency] / rates[repayment.currency];
    const amountInLoanCurrency = repayment.amount * exchangeRate;

    const newRemaining = loan.remainingAmount - amountInLoanCurrency;
    const newStatus =
      newRemaining <= 0 ? "settled"
      : newRemaining < loan.principalAmount ? "partially_paid"
      : "active";

    tx.update(loanRef, {
      remainingAmount: Math.max(0, newRemaining),
      status: newStatus,
      updatedAt: serverTimestamp(),
    });

    const repaymentRef = loanRef.collection("repayments").doc();
    tx.set(repaymentRef, {
      ...repayment,
      exchangeRateUsed: exchangeRate,
      paidAt: serverTimestamp(),
    });
  });
}
```

**Loan dashboard views:**
- **I lent** — loans where `lenderId === currentUser`
- **I owe** — loans where `borrowerId === currentUser`
- Net balance per family member (e.g. "You owe Dad $200 net")
- Overdue indicator when `dueDate < today` and `status !== "settled"`

---

## 6. Key UI Pages

### Dashboard Overview (`/`)
- Total family net worth (all assets converted to base currency)
- Per-member asset breakdown (bar chart)
- Outstanding loans summary
- Recent activity feed

### Assets Page (`/assets`)
- Filter by: owner, category, currency
- Sort by: amount (converted), name, date added
- Totals per currency + grand total in base currency

### Loans Page (`/loans`)
- Tabs: "I Lent" / "I Owe" / "All"
- Each loan card: parties, amount, remaining, status badge, due date
- Quick "Record Payment" button inline
- Full repayment history on loan detail page

### Members Page (`/members`)
- List with avatar, role badge, total asset value
- Click member → their assets + loans involving them
- Invite by email, change role (admin only), remove member

---

## 7. Implementation Phases

### Phase 1 — Foundation (Week 1–2)
- [ ] `npx create-next-app@latest` with TypeScript + Tailwind + App Router
- [ ] Firebase project: Auth, Firestore, Storage
- [ ] Vercel project created (separate from portfolio)
- [ ] Firebase Admin SDK + session cookie auth
- [ ] `requireUser()` + login/logout Route Handlers
- [ ] Family creation + onboarding flow
- [ ] Basic Firestore security rules

### Phase 2 — Members (Week 2–3)
- [ ] Member list page (Server Component)
- [ ] Invite by email (Server Action + Cloud Function trigger)
- [ ] Role management (admin/member/viewer)
- [ ] Profile picture upload to Firebase Storage
- [ ] Cloud Function: send invite email via Firebase Extensions (Trigger Email)

### Phase 3 — Assets (Week 3–4)
- [ ] Asset CRUD via Server Actions
- [ ] Currency selector component (ISO 4217, searchable)
- [ ] FX rate fetch + Vercel Cron daily cache
- [ ] Multi-currency conversion throughout dashboard
- [ ] File attachment upload (client → Firebase Storage directly)

### Phase 4 — Loans (Week 4–5)
- [ ] Loan creation Server Action
- [ ] Repayment recording with Firestore transaction
- [ ] Cross-currency repayment with rate capture
- [ ] Loan status logic (active → partially_paid → settled)
- [ ] Overdue detection

### Phase 5 — Dashboard & Polish (Week 5–6)
- [ ] Net worth overview with Recharts bar/pie charts
- [ ] Activity feed (recent Firestore changes)
- [ ] `onSnapshot` real-time updates for loan/asset lists (Client Component islands)
- [ ] Mobile-responsive layout
- [ ] Loading skeletons (`loading.tsx`), error boundaries (`error.tsx`), empty states

### Phase 6 — Production Readiness (Week 6–7)
- [ ] Firestore security rules full audit
- [ ] Zod validation on all Server Actions
- [ ] Vercel Cron for daily FX rate refresh (`vercel.json`)
- [ ] Error monitoring (Sentry for Next.js)
- [ ] E2E tests (Playwright)
- [ ] Environment variable audit (nothing sensitive in `NEXT_PUBLIC_*`)

---

## 8. Environment Variables

```bash
# .env.local (server-only — never prefix with NEXT_PUBLIC_)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
CRON_SECRET=...                  # secures the /api/fx-rates cron endpoint

# Client-safe (must be NEXT_PUBLIC_ to reach the browser)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_APP_URL=...          # e.g. http://localhost:3000 — used by the logout redirect
```

> **Removed from earlier drafts:** `SESSION_SECRET` is unnecessary — the Firebase
> Admin SDK signs its own session cookies. `OPEN_EXCHANGE_RATES_APP_ID` is unused —
> the project standardizes on the free, keyless **Frankfurter API**. Sentry and
> Vercel KV variables are added in `09-production.md`.

```json
// vercel.json — daily FX rate refresh
{
  "crons": [
    {
      "path": "/api/fx-rates",
      "schedule": "0 1 * * *"
    }
  ]
}
```

---

## 9. Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth strategy | Firebase session cookies via Route Handler | httpOnly, SSR-safe, works with `cookies()` in Server Components |
| Data fetching | Async Server Components | Zero client JS for reads; only interactive parts are Client Components |
| Mutations | Server Actions + `revalidatePath` | No API routes needed for mutations; type-safe end-to-end |
| FX rates | Cached in Firestore (daily via Vercel Cron) | Avoids rate limits, consistent rates within a day |
| Loan currency mismatch | Convert at repayment time, store rate used | Full audit trail, no data loss |
| Real-time updates | Firestore `onSnapshot` in Client Component islands | Family members see changes instantly without full page reload |
| File uploads | Client → Firebase Storage directly | Bypass server for large files; use Storage Security Rules |
| Validation | Zod on Server Actions (server) + client for UX | Defense in depth; server is source of truth |
| Deployment | Separate Vercel project from portfolio | Security isolation, independent deploy cadence, clean codebase |

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| FX API downtime | Cache last-known rates in Firestore; show "rates as of [date]" warning in UI |
| Concurrent repayment edits | Firestore transactions ensure atomic `remainingAmount` updates |
| Accidental asset deletion | Soft-delete: set `deleted: true`, filter in all queries |
| Cross-family data leakage | Security rules server-enforced; `familyId` always derived from session, never trusted from client |
| Large dataset performance | Paginate asset/loan lists with Firestore cursors; index composite queries |
| Server Action abuse | Rate-limit sensitive actions (invite, loan creation) via Upstash Redis or Vercel KV |
