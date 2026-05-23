# Family Asset Tracker — Agent Master Instructions

You are a senior full-stack engineer implementing a family financial asset tracking application. Work through each phase file in order. Do not skip ahead.

---

## Project Identity

- **App name:** Family Asset Tracker
- **Stack:** Next.js 16+ App Router · TypeScript · Tailwind CSS · Firebase (Auth, Firestore, Storage) · Vercel
- **Tooling:** Node.js 24.x · pnpm (package manager) · Biome 2.4.15 (formatter & linter — no ESLint/Prettier)
- **Repo:** A brand-new, standalone repository
- **Deploy target:** Vercel project 

---

## File Execution Order

Execute these instruction files in sequence. Complete all tasks in a file before moving to the next.

```
01-project-setup.md        → Scaffold repo, install deps, configure Firebase
02-auth.md                 → Session cookie auth, login/logout, requireUser()
03-family-onboarding.md    → Family creation, join flow, Firestore schema bootstrap
04-members.md              → Member list, invite, roles, profile pictures
05-assets.md               → Asset CRUD, currency selector, FX rates, Vercel Cron
06-loans.md                → Loan creation, repayment transactions, cross-currency
07-dashboard.md            → Overview page, charts, activity feed, real-time updates
08-polish.md               → Loading states, error boundaries, empty states, mobile
09-production.md           → Security rules audit, Zod validation, Sentry, E2E tests
```

---

## Non-Negotiable Rules (apply to every phase)

### Code quality
- TypeScript strict mode on — no `any`, no `@ts-ignore`
- Every Server Action validates input with **Zod** before touching Firestore
- Never trust `familyId` from the client — always derive it from the verified session
- All Firestore writes go through typed helper functions in `src/lib/`
- No business logic in page components — pages are thin, logic lives in `src/lib/` and `src/actions/`
- Format and lint with **Biome 2.4.15** — `pnpm lint` must pass clean before a phase is done

### Security
- Firebase Admin SDK is **server-only** — never import it in Client Components
- Session cookie is `httpOnly: true, secure: true, sameSite: "lax"`
- `FIREBASE_PRIVATE_KEY` and `FIREBASE_CLIENT_EMAIL` are never prefixed `NEXT_PUBLIC_`
- Firestore Security Rules enforce all access — never rely solely on server-side checks

### Patterns
- Prefer **async Server Components** for data fetching — avoid `useEffect` for reads
- Use **Client Components** only when interactivity or browser APIs are required (mark with `"use client"`)
- Real-time Firestore listeners (`onSnapshot`) live in Client Components only
- Use `revalidatePath()` or `revalidateTag()` after every mutation
- Use Next.js `loading.tsx` and `error.tsx` co-located with every route segment

### Style
- Tailwind only — no inline styles, no CSS modules unless unavoidable
- Mobile-first responsive design throughout
- All currency amounts displayed with `Intl.NumberFormat` — never raw floats

---

## Shared Type Definitions

Create `src/types/index.ts` in Phase 1 and keep it as the single source of truth for all domain types.

```typescript
export type Role = "admin" | "member" | "viewer";
export type MemberStatus = "active" | "invited" | "removed";
export type AssetCategory = "cash" | "bank" | "investment" | "property" | "crypto" | "other";
export type LoanStatus = "active" | "partially_paid" | "settled";

export interface FamilyMember {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  role: Role;
  status: MemberStatus;
  joinedAt: Date;
}

export interface Family {
  id: string;
  name: string;
  baseCurrency: string;
  inviteCode: string;
  createdBy: string;
  createdAt: Date;
}

export interface Asset {
  id: string;
  ownerId: string;
  name: string;
  category: AssetCategory;
  currency: string;
  amount: number;
  description: string;
  attachmentURL: string | null;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Loan {
  id: string;
  lenderId: string;
  borrowerId: string;
  currency: string;
  principalAmount: number;
  remainingAmount: number;
  interestRate: number | null;
  description: string;
  status: LoanStatus;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Repayment {
  id: string;
  loanId: string;
  amount: number;
  currency: string;
  exchangeRateUsed: number | null;
  note: string;
  paidAt: Date;
  recordedBy: string;
}

export interface FxRates {
  base: string;
  rates: Record<string, number>;
  fetchedAt: Date;
}
```

---

## Environment Variables Reference

```bash
# Server-only (.env.local)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
CRON_SECRET=

# Client-safe (NEXT_PUBLIC_ prefix required)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_APP_URL=          # e.g. http://localhost:3000 — used by the logout redirect
```

---

## Completion Checklist

After all phases are done, verify:
- [ ] `pnpm build` passes with zero TypeScript errors
- [ ] `pnpm lint` passes (Biome) with no errors
- [ ] All Firestore Security Rules deployed and tested with the emulator
- [ ] All `.env.local` values documented in `.env.example` (no real values)
- [ ] `README.md` covers local setup, env vars, and deploy steps
- [ ] No `console.log` statements left in production code
- [ ] Lighthouse score ≥ 90 on mobile
