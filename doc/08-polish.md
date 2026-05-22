# Phase 8 — Polish

## Goal
Add loading skeletons, error boundaries, empty states, mobile responsiveness, and a consistent design system across the entire app. No new features — purely quality of experience.

---

## Step 1 — Loading skeletons (co-locate with every route)

Create `loading.tsx` files next to every page. Pattern:

```typescript
// Reusable skeleton primitive
// src/components/ui/Skeleton.tsx
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
```

Apply to all routes:
```typescript
// src/app/(dashboard)/assets/loading.tsx
import { PageSkeleton } from "@/components/ui/Skeleton";
export default function Loading() { return <PageSkeleton rows={5} />; }

// src/app/(dashboard)/loans/loading.tsx
import { PageSkeleton } from "@/components/ui/Skeleton";
export default function Loading() { return <PageSkeleton rows={4} />; }

// src/app/(dashboard)/members/loading.tsx — already done in Phase 4
// src/app/(dashboard)/loading.tsx
import { Skeleton } from "@/components/ui/Skeleton";
export default function Loading() {
  return (
    <div className="space-y-8 max-w-5xl">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
```

---

## Step 2 — Error boundaries (co-locate with every route)

```typescript
// src/app/(dashboard)/error.tsx  (and copy to assets/, loans/, members/)
"use client";
import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to Sentry in Phase 9
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-5xl mb-4">⚠️</p>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-500 text-sm mb-6 max-w-sm">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
      >
        Try again
      </button>
    </div>
  );
}
```

---

## Step 3 — Not found pages

```typescript
// src/app/(dashboard)/assets/[assetId]/not-found.tsx
export default function AssetNotFound() {
  return (
    <div className="text-center py-24">
      <p className="text-5xl mb-4">🔍</p>
      <p className="text-lg font-medium text-gray-900">Asset not found</p>
      <p className="text-gray-500 text-sm">It may have been deleted.</p>
    </div>
  );
}
// Duplicate for loans/[loanId]/not-found.tsx
```

---

## Step 4 — Mobile responsive sidebar

Replace the fixed sidebar with a collapsible drawer on mobile:

```typescript
// src/components/layout/AppShell.tsx  (updated)
"use client";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import type { Family, FamilyMember } from "@/types";

interface Props {
  user: { uid: string; email: string };
  family: Family;
  members: FamilyMember[];
  children: React.ReactNode;
}

export function AppShell({ user, family, members, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar family={family} />
      </div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed left-0 top-0 h-full z-30 md:hidden">
            <Sidebar family={family} onNavigate={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          user={user}
          family={family}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
```

Update `Header` to show a hamburger on mobile:

```typescript
// Add to Header.tsx
<button
  onClick={onMenuClick}
  className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
</button>
```

---

## Step 5 — Empty states

Each list page must have an empty state that encourages action:

```typescript
// src/components/ui/EmptyState.tsx
import Link from "next/link";

interface Props {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200">
      <p className="text-5xl mb-4">{icon}</p>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
```

Usage:
```typescript
// In AssetList when assets.length === 0:
<EmptyState
  icon="💰"
  title="No assets yet"
  description="Start tracking your family's wealth by adding your first asset."
  action={{ label: "+ Add asset", href: "/assets/new" }}
/>
```

---

## Step 6 — AmountDisplay component

Centralise all currency formatting with a component that handles conversion display:

```typescript
// src/components/ui/AmountDisplay.tsx
import { formatCurrency, convertAmount } from "@/lib/currency.server";

interface Props {
  amount: number;
  currency: string;
  baseCurrency: string;
  rates: Record<string, number>;
  size?: "sm" | "md" | "lg";
}

export function AmountDisplay({ amount, currency, baseCurrency, rates, size = "md" }: Props) {
  const isBase = currency === baseCurrency;
  const converted = isBase ? null : convertAmount(amount, currency, baseCurrency, rates);

  const sizeClass = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl font-bold",
  }[size];

  return (
    <div>
      <p className={`font-semibold text-gray-900 ${sizeClass}`}>
        {formatCurrency(amount, currency)}
      </p>
      {converted !== null && (
        <p className="text-xs text-gray-400">
          ≈ {formatCurrency(converted, baseCurrency)}
        </p>
      )}
    </div>
  );
}
```

---

## Step 7 — Consistent page headers

Avoid repeating the heading + action button pattern. Create a reusable layout:

```typescript
// src/components/ui/PageHeader.tsx
import Link from "next/link";

interface Props {
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
}

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex-shrink-0"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
```

---

## Step 8 — Toast notifications

For mutation feedback (no page redirects), use a lightweight toast:

```typescript
// src/components/ui/Toast.tsx
"use client";
import { useState, useEffect } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3 ${
        type === "success"
          ? "bg-green-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      <span>{type === "success" ? "✓" : "✗"}</span>
      {message}
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100">×</button>
    </div>
  );
}
```

---

## Step 9 — Mobile layout audit

Go through every page and verify:

- [ ] All tables/grids collapse to single-column on screens < 640px
- [ ] All buttons have a minimum tap target of 44×44px
- [ ] No horizontal overflow — test at 375px (iPhone SE viewport)
- [ ] Sidebar drawer opens/closes smoothly on mobile
- [ ] Forms use `inputMode="decimal"` on amount inputs for better mobile keyboard
- [ ] Long text (names, descriptions) truncates with `truncate` class, not overflow

---

## Verification

- [ ] Every route segment has a `loading.tsx` skeleton
- [ ] Every route segment has an `error.tsx` boundary
- [ ] Dynamic routes have a `not-found.tsx`
- [ ] All list pages have an empty state with a call to action
- [ ] Sidebar converts to a mobile drawer with overlay at < md breakpoint
- [ ] No layout breaks at 375px viewport width
