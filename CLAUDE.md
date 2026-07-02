# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (Node `24.x`). There is no test runner configured yet.

- `pnpm dev` — start the Next.js dev server (http://localhost:3000)
- `pnpm build` — production build; must pass with zero TypeScript errors
- `pnpm start` — run the production build
- `pnpm lint` — Biome check (lint + format check); must pass clean before finishing work
- `pnpm lint:fix` — Biome check with autofix
- `pnpm format` — Biome format-write only

Linting/formatting is **Biome 2.4.15** — there is no ESLint or Prettier. Config in `biome.json`: 2-space indent, 100 line width, double quotes, always semicolons.

## Local setup gotcha

The app will not boot without Firebase Admin credentials. Locally, place a service account JSON at `./firebase/serviceAccountKey.json` (or point `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` at it). On Vercel the same JSON is passed inline via `FIREBASE_SERVICE_ACCOUNT_KEY`, which takes precedence. See `.env.example` for the full variable set.

## Architecture

Next.js 16 App Router + React 19 + Firebase (Auth, Firestore, Storage), deployed to Vercel. The domain is a family financial tracker: families have members, assets, and loans, summarized on a dashboard.

### The server/client Firebase split (most important pattern)

Two distinct Firebase entry points — do not cross them:

- **`src/firebase/admin.ts`** — Admin SDK, `import "server-only"`. `getAdminDb()` / `getAdminAuth()`. This is how essentially **all reads and writes** happen. It bypasses Firestore Security Rules.
- **`src/firebase/client.ts`** — client Web SDK, used only in Client Components, and only for the **real-time activity feed and notifications** via `onSnapshot`.

Because writes go through the Admin SDK, `firestore.rules` is intentionally minimal: it only grants client-side **read** access to the `activity` and per-recipient `notifications` subcollections (gated on active membership). Everything else stays denied by default. When you add a new client-side `onSnapshot` read, you must also open a matching rule; server-side access needs no rule change.

### Layering — keep pages thin

Strict three-layer flow; no Firestore calls or business logic in components:

1. **`src/app/**`** — route segments. Server Components fetch data; pages stay thin. Routes are grouped: `(auth)` for login/onboarding, `(dashboard)` for the authenticated app. Co-locate `loading.tsx` / `error.tsx` / `not-found.tsx` per segment.
2. **`src/actions/*.actions.ts`** — `"use server"` Server Actions. Each one: calls `requireUser()`, derives the family from the session, **validates input with Zod**, enforces role/visibility, calls a `src/lib` helper, logs activity, then `revalidatePath()` and/or `redirect()`.
3. **`src/lib/*.server.ts`** — the only place that touches Firestore (via `getAdminDb()`). Typed helpers return domain types from `src/types/index.ts`, converting Firestore `Timestamp`s to `Date`.

`*.server.ts` files carry `import "server-only"`; non-suffixed `src/lib` files (`visibility.ts`, `loan-interest.ts`, `loan-party.ts`, `currency.ts`) are pure logic shared by both sides. The pure money helpers `convertAmount` / `formatCurrency` live in `currency.ts` (client-safe); `currency.server.ts` keeps the Firestore-backed `getCachedRates` and re-exports the pure pair for server callers.

### Client data layer (TanStack Query)

Reads are served to client components through **TanStack Query** (`src/lib/query/`), but **the security model is unchanged** — clients never read Firestore directly for app data.

- **Reads still originate server-side.** Each page stays a Server Component: it calls `requireUser()` + the `*.server.ts` helper (visibility enforced), `prefetchQuery`s into a per-request client (`getQueryClient()`), and wraps the client view in `<HydrationBoundary state={dehydrate(qc)}>`. First paint is fully server-rendered; the client `useQuery` mounts with data already in cache.
- **Client refetches hit Route Handlers, not Firestore.** `src/app/api/{assets,loans,dashboard}/...` re-run `requireUser()` + the same lib helper + the same visibility filter, then return JSON. The `queryFn` fetches these via `fetchJson` (`src/lib/query/fetch-json.ts`), which revives ISO date strings back to `Date`. **Never** point a `queryFn` at the client Firebase SDK for app data — `firestore.rules` would block it and visibility couldn't be enforced.
- **Query keys** come from the factory in `src/lib/query/keys.ts` (always family-scoped). Never inline key arrays.
- **Mutations** stay as redirecting Server Actions. The action's `revalidatePath()` invalidates the router cache, so the redirect/navigation re-runs the page's prefetch and **re-hydrates the TanStack cache** — that is how the client cache stays consistent after a write. (Optimistic `useMutation` is intentionally not used yet: `redirect()` inside a `useMutation` try/catch swallows `NEXT_REDIRECT`. Adding it requires first dropping `redirect()` from the actions.)
- **Realtime feeds** (`ActivityFeed`, `NotificationBell`) keep their `onSnapshot` listeners but write each snapshot into the query cache via `setQueryData`, and read it back with `useQuery(..., { queryFn: skipToken })` so the data is shared and survives navigation.

### Auth & session

Auth is **session-cookie based**, not client tokens. `src/lib/auth.server.ts` exposes `requireUser()` (redirects to `/login` if no valid `session` cookie) and `getOptionalUser()`. The login API route mints the `httpOnly` session cookie from a Firebase ID token. **Never trust a `familyId` (or any identity) from the client** — always resolve it from the verified session via `getFamilyForUser(user.uid)`.

### Authorization model

Two independent checks, both enforced in the Server Action / lib layer:

- **Roles** (`admin` | `member` | `viewer`): viewers cannot mutate. Edit/delete on an asset is restricted to its owner; on a loan, to its lender/borrower participants. This holds regardless of visibility — `shared` only grants other family members (including admins) read access, never mutate. See `assertCanMutate` / `assertCanMutateLoan` in the actions.
- **Visibility** (`shared` | `private`): enforced by `canViewAsset` / `canViewLoan` in `src/lib/visibility.ts`. `private` items are visible only to the owner/participants — **admins do not get to see others' private items.**

### Data model & multi-currency

Domain types live in `src/types/index.ts` (single source of truth). Firestore layout is family-scoped: `families/{id}` with `members`, `assets`, `loans` (+ `repayments`), `activity`, and `notifications` subcollections; top-level `users/{uid}` holds `familyIds`. Assets are **soft-deleted** (`deleted` flag), not removed.

Money is multi-currency: each asset/loan stores its own currency; the family has a `baseCurrency`. FX rates are refreshed by a daily Vercel Cron hitting `/api/fx-rates`; a second cron hits `/api/reminders` for loan due-date notifications (see `vercel.json`). Cron routes are protected by `CRON_SECRET`. Always format money with `Intl.NumberFormat` / the currency helpers — never render raw floats.

**MMK (Myanmar Kyat) is special:** the FX provider (Frankfurter/ECB) does **not** quote MMK, so without intervention `convertAmount` would treat 1 MMK = 1 USD. Instead each family stores a `settings.mmkPerUsd` (mirrored as `Family.mmkPerUsd`), seeded from the CBM API (`fetchCbmUsdRate`) at family creation and editable by an admin on the members page. It's injected into the rates map via `applyMmkRate` in `getCachedRates` (every live read) and in the `/api/fx-rates` cron (net-worth snapshots) — so no `convertAmount` caller changes. The selectable currency list is the single `SUPPORTED_CURRENCIES` in `src/lib/currency.ts`; `formatCurrency` renders MMK/JPY/KRW with no decimals. See `doc/11-mmk-currency.md`.

**Dynamic assets (stock/crypto):** these categories don't store a fixed `amount` — the user records a `symbol` + `quantity`, and the value is `quantity × live price` in USD. Prices come from Binance (crypto, no key) and Finnhub (stocks, `FINNHUB_API_KEY`), fetched on read with a short `fetch` cache (see `src/lib/asset-price.server.ts`). The live value is injected by `applyLivePrices`, which **overwrites `amount`/`currency` in the server read helpers** (`getAssets`/`getAsset`, `dashboard.server`, `networth.server`) — mirroring the `applyMmkRate` pattern — so every downstream `convertAmount` caller is unchanged. The stored `amount` is a snapshot/fallback used when a price fetch fails. Both feeds are treated as USD (documented limitation). See `doc/12-dynamic-asset-value.md`.

### i18n

Cookie-based locale (`en` / `my` — Burmese) in `src/lib/i18n/`, no URL locale prefix. Config and dictionaries are static; `I18nProvider` supplies translations client-side.

## Project conventions

- TypeScript strict — no `any`, no `@ts-ignore`.
- Every Server Action validates with **Zod** before any Firestore access.
- All Firestore writes go through a typed `src/lib/*.server.ts` helper — never inline a write in an action or component.
- Reads originate in Server Components (`prefetchQuery` + `HydrationBoundary`); client components consume them via `useQuery` keyed from `src/lib/query/keys.ts`, with the `queryFn` hitting a Route Handler (never the client Firestore SDK). Don't fetch app data with a raw `useEffect`.
- `revalidatePath()` / `revalidateTag()` after every mutation.
- Tailwind only (v4, via `@tailwindcss/postcss`); mobile-first; no inline styles or CSS modules.
- No `console.log` in committed code.
- **pnpm only** — never `npm` or `yarn`. The lockfile is `pnpm-lock.yaml`; using another package manager will desync it.
- Adding a **client-side `onSnapshot`** read requires a matching `allow read` rule in `firestore.rules` — without it the listener silently returns nothing (the Admin SDK bypasses rules, so server reads never reveal this).

## Reference docs

`doc/00-master.md` is the authoritative spec (domain types, env vars, non-negotiable rules); `doc/01..10-*.md` are the phased build plans for each feature area.
