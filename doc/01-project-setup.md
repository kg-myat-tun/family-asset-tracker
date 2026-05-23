# Phase 1 — Project Setup

## Goal
Scaffold a clean Next.js 16+ App Router project with TypeScript, Tailwind, Biome `2.4.15`, and the Firebase SDKs wired up. The package manager is **pnpm** throughout. By the end of this phase the app runs locally with a working Firebase connection.

---

## Step 1 — Scaffold the project

> These instructions target **Next.js 16**. Before scaffolding, make sure your
> local Node.js version is **24.x**.

```bash
pnpm create next-app@latest family-asset-tracker \
  --typescript \
  --tailwind \
  --no-eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm

cd family-asset-tracker
```

> `--no-eslint` skips ESLint — Biome (Step 2) handles linting and formatting.
> `--use-pnpm` makes the scaffold install dependencies with pnpm.

---

## Step 2 — Install dependencies & tooling

```bash
# Firebase
pnpm add firebase firebase-admin

# Utilities
pnpm add zod date-fns

# Charts (used in Phase 7)
pnpm add recharts

# Dev tooling — types + Biome 2.4.15 (formatter & linter)
pnpm add -D @types/node @biomejs/biome@2.4.15
```

### Biome — formatter & linter

The project scaffolds with `--no-eslint`; **Biome** handles both formatting and
linting (it replaces ESLint *and* Prettier). Generate the config:

```bash
pnpm exec biome init
```

`biome init` writes `biome.json` with a `$schema` matching the installed Biome
version. These docs pin **Biome `2.4.15`**; replace the generated contents with:

```json
// biome.json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": {
    "formatter": { "quoteStyle": "double", "semicolons": "always" }
  }
}
```

`useIgnoreFile` makes Biome respect `.gitignore`, so it never touches `.next/`
or `node_modules/`. Add the `format`/`lint` scripts to `package.json` (the
`next` scripts are created by the scaffold):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "format": "biome format --write .",
    "lint": "biome check .",
    "lint:fix": "biome check --write ."
  }
}
```

---

## Step 3 — Directory structure

Create all directories now so imports resolve correctly throughout the project:

```bash
mkdir -p src/{firebase,lib,actions,components/{layout,ui,assets,loans,members},types}
```

Final `src/` tree:
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── onboarding/
│   ├── (dashboard)/
│   │   ├── assets/
│   │   │   ├── new/
│   │   │   └── [assetId]/edit/
│   │   ├── loans/
│   │   │   ├── new/
│   │   │   └── [loanId]/repay/
│   │   └── members/
│   │       └── [memberId]/
│   └── api/
│       ├── auth/
│       │   ├── login/
│       │   └── logout/
│       └── fx-rates/
├── firebase/
├── lib/
├── actions/
├── components/
└── types/
```

---

## Step 4 — Firebase client SDK

```typescript
// src/firebase/client.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

---

## Step 5 — Firebase Admin SDK

```typescript
// src/firebase/admin.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
```

> **Important:** Never import this file from any Client Component or any file that could end up in the browser bundle. Add a build-time guard by adding `"server-only"` as the first import:
> ```typescript
> import "server-only";
> ```

---

## Step 6 — Shared types

Create `src/types/index.ts` with the full type definitions from `00-master.md`. This is the single source of truth — do not redefine types elsewhere.

---

## Step 7 — Environment variables

Create `.env.local` with all variables from `00-master.md`. Then create `.env.example` with the same keys but empty values — commit `.env.example`, never `.env.local`.

Add to `.gitignore`:
```
.env.local
.env*.local
```

---

## Step 8 — next.config.ts

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google OAuth avatars
    ],
  },
};

export default nextConfig;
```

---

## Step 9 — vercel.json (Cron)

```json
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

## Step 10 — Root layout

```typescript
// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Family Asset Tracker",
  description: "Track your family's assets and loans across currencies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

---

## Step 11 — Root redirect

```typescript
// src/app/page.tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
```

---

## Verification

- [ ] `pnpm dev` starts without errors
- [ ] No TypeScript errors (`pnpm build`)
- [ ] `pnpm lint` passes (Biome — formatting and linting clean)
- [ ] `src/types/index.ts` exists with all domain types
- [ ] Firebase client and admin files are in place
- [ ] `.env.example` is committed, `.env.local` is gitignored
