# Phase 3 — Family & Onboarding

## Goal
After sign-in, every user must belong to a family. This phase implements: family creation, joining via invite code, and the onboarding gate that prevents access to the dashboard until the user is in a family. Also wires the family context into `AppShell` and all dashboard layouts.

---

## Step 1 — Family lib (server)

```typescript
// src/lib/family.server.ts
import "server-only";
import { adminDb } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Family, FamilyMember } from "@/types";

// Get the first family this user belongs to (single-family MVP)
export async function getFamilyForUser(uid: string): Promise<Family | null> {
  const userDoc = await adminDb.doc(`users/${uid}`).get();
  if (!userDoc.exists) return null;

  const familyIds: string[] = userDoc.data()?.familyIds ?? [];
  if (familyIds.length === 0) return null;

  const familyDoc = await adminDb.doc(`families/${familyIds[0]}`).get();
  if (!familyDoc.exists) return null;

  const data = familyDoc.data()!;
  return {
    id: familyDoc.id,
    name: data.name,
    baseCurrency: data.settings?.baseCurrency ?? "USD",
    inviteCode: data.inviteCode ?? "",
    createdBy: data.createdBy,
    createdAt: data.createdAt.toDate(),
  };
}

export async function getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  const snap = await adminDb
    .collection(`families/${familyId}/members`)
    .where("status", "==", "active")
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      uid: doc.id,
      displayName: d.displayName,
      email: d.email,
      photoURL: d.photoURL ?? null,
      role: d.role,
      status: d.status,
      joinedAt: d.joinedAt.toDate(),
    };
  });
}

// Invite codes: 6 chars, uppercase, ambiguity-free alphabet (no 0/O, 1/I/L).
const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomInviteCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomInviteCode();
    const clash = await adminDb
      .collection("families")
      .where("inviteCode", "==", code)
      .limit(1)
      .get();
    if (clash.empty) return code;
  }
  throw new Error("Could not generate a unique invite code");
}

// Identity fields are copied onto each member doc so getFamilyMembers needs no
// extra per-member reads. Requires users/{uid} to exist (call ensureUserProfile first).
async function memberIdentity(uid: string) {
  const userSnap = await adminDb.doc(`users/${uid}`).get();
  const u = userSnap.data() ?? {};
  return {
    displayName: u.displayName ?? "Unknown",
    email: u.email ?? "",
    photoURL: u.photoURL ?? null,
  };
}

export async function createFamily(
  uid: string,
  name: string,
  baseCurrency: string
): Promise<string> {
  const inviteCode = await generateUniqueInviteCode();
  const identity = await memberIdentity(uid);
  const batch = adminDb.batch();

  // Create family doc
  const familyRef = adminDb.collection("families").doc();
  batch.set(familyRef, {
    name,
    inviteCode,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    settings: { baseCurrency },
  });

  // Add creator as admin member (identity fields included for getFamilyMembers)
  const memberRef = adminDb.doc(`families/${familyRef.id}/members/${uid}`);
  batch.set(memberRef, {
    ...identity,
    role: "admin",
    status: "active",
    joinedAt: FieldValue.serverTimestamp(),
  });

  // Update user's familyIds
  const userRef = adminDb.doc(`users/${uid}`);
  batch.set(userRef, { familyIds: FieldValue.arrayUnion(familyRef.id) }, { merge: true });

  await batch.commit();
  return familyRef.id;
}

// Join an existing family by its invite code. Idempotent: a user who is already
// an active member is returned their familyId without a duplicate write.
export async function joinFamilyByCode(uid: string, code: string): Promise<string> {
  const snap = await adminDb
    .collection("families")
    .where("inviteCode", "==", code.toUpperCase())
    .limit(1)
    .get();
  if (snap.empty) throw new Error("Invalid invite code");

  const familyId = snap.docs[0].id;
  const memberRef = adminDb.doc(`families/${familyId}/members/${uid}`);
  const memberSnap = await memberRef.get();
  if (memberSnap.exists && memberSnap.data()?.status === "active") {
    return familyId; // already a member — nothing to do
  }

  const identity = await memberIdentity(uid);
  const batch = adminDb.batch();
  batch.set(memberRef, {
    ...identity,
    role: "member",
    status: "active",
    joinedAt: FieldValue.serverTimestamp(),
  });
  batch.set(
    adminDb.doc(`users/${uid}`),
    { familyIds: FieldValue.arrayUnion(familyId) },
    { merge: true }
  );
  await batch.commit();
  return familyId;
}
```

> **Invite-code model.** Every family carries a 6-character `inviteCode`,
> generated once at creation from an ambiguity-free alphabet and stored on the
> family doc. New members join by entering it (Step 5). The lookup query
> `where("inviteCode", "==", code)` runs through the Admin SDK, so it works even
> though Firestore rules forbid non-members from reading the `families`
> collection. Admins surface the code on the Members page (Phase 4).

---

## Step 2 — Ensure user profile exists

After login, the user profile in `users/{uid}` must exist. Create a helper called on first load:

```typescript
// src/lib/user.server.ts
import "server-only";
import { adminAuth, adminDb } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function ensureUserProfile(uid: string): Promise<void> {
  const ref = adminDb.doc(`users/${uid}`);
  const snap = await ref.get();
  if (snap.exists) return;

  // Fetch display info from Firebase Auth
  const authUser = await adminAuth.getUser(uid);
  await ref.set({
    displayName: authUser.displayName ?? authUser.email ?? "Unknown",
    email: authUser.email ?? "",
    photoURL: authUser.photoURL ?? null,
    familyIds: [],
    createdAt: FieldValue.serverTimestamp(),
  });
}
```

---

## Step 3 — Onboarding gate in dashboard layout

Update the dashboard layout to redirect to `/onboarding` if user has no family:

```typescript
// src/app/(dashboard)/layout.tsx
import { requireUser } from "@/lib/auth.server";
import { ensureUserProfile } from "@/lib/user.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { AppShell } from "@/components/layout/AppShell";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await ensureUserProfile(user.uid);

  const family = await getFamilyForUser(user.uid);
  if (!family) redirect("/onboarding");

  const members = await getFamilyMembers(family.id);

  return (
    <AppShell user={{ uid: user.uid, email: user.email ?? "" }} family={family} members={members}>
      {children}
    </AppShell>
  );
}
```

---

## Step 4 — Onboarding page

```typescript
// src/app/(auth)/onboarding/page.tsx
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser } from "@/lib/family.server";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/OnboardingForm";

export default async function OnboardingPage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (family) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Set up your family</h1>
        <p className="text-gray-500 mb-8">Create a new family group or join an existing one</p>
        <OnboardingForm />
      </div>
    </main>
  );
}
```

---

## Step 5 — Onboarding Server Actions

```typescript
// src/actions/family.actions.ts
"use server";
import { requireUser } from "@/lib/auth.server";
import { ensureUserProfile } from "@/lib/user.server";
import { createFamily, joinFamilyByCode } from "@/lib/family.server";
import { redirect } from "next/navigation";
import { z } from "zod";

const CreateFamilySchema = z.object({
  name: z.string().min(1, "Family name is required").max(60),
  baseCurrency: z.string().length(3, "Select a currency"),
});

// Signature is (prevState, formData) because the form drives it via useActionState.
export async function createFamilyAction(_prevState: unknown, formData: FormData) {
  const user = await requireUser();
  await ensureUserProfile(user.uid);

  const parsed = CreateFamilySchema.safeParse({
    name: formData.get("name"),
    baseCurrency: formData.get("baseCurrency"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  await createFamily(user.uid, parsed.data.name, parsed.data.baseCurrency);
  redirect("/dashboard");
}

const JoinFamilySchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, "Enter a valid 6-character invite code"),
});

export async function joinFamilyAction(_prevState: unknown, formData: FormData) {
  const user = await requireUser();
  await ensureUserProfile(user.uid); // joinFamilyByCode reads the profile for member identity

  const parsed = JoinFamilySchema.safeParse({
    inviteCode: formData.get("inviteCode"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  try {
    await joinFamilyByCode(user.uid, parsed.data.inviteCode);
  } catch {
    // joinFamilyByCode throws only when no family matches the code
    return { error: { inviteCode: ["No family found for that invite code"] } };
  }

  redirect("/dashboard");
}
```

---

## Step 6 — OnboardingForm component

```typescript
// src/components/auth/OnboardingForm.tsx
"use client";
import { useActionState, useState } from "react";
import { createFamilyAction, joinFamilyAction } from "@/actions/family.actions";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "THB", "JPY", "SGD", "AUD", "CAD"];

type Mode = "create" | "join";

export function OnboardingForm() {
  const [mode, setMode] = useState<Mode>("create");

  return (
    <div className="space-y-6">
      {/* Create / Join toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {(["create", "join"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === m
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {m === "create" ? "Create a family" : "Join a family"}
          </button>
        ))}
      </div>

      {mode === "create" ? <CreateFamilyForm /> : <JoinFamilyForm />}
    </div>
  );
}

function CreateFamilyForm() {
  const [state, action, pending] = useActionState(createFamilyAction, null);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Family name</label>
        <input
          name="name"
          placeholder="e.g. The Smiths"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {state?.error?.name && (
          <p className="text-sm text-red-500 mt-1">{state.error.name[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Base currency</label>
        <select
          name="baseCurrency"
          required
          defaultValue="USD"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {COMMON_CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Creating..." : "Create family"}
      </button>
    </form>
  );
}

function JoinFamilyForm() {
  const [state, action, pending] = useActionState(joinFamilyAction, null);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Invite code</label>
        <input
          name="inviteCode"
          placeholder="K7M2QP"
          required
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg uppercase tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {state?.error?.inviteCode && (
          <p className="text-sm text-red-500 mt-1">{state.error.inviteCode[0]}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          Ask a family admin for the 6-character code on their Members page.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Joining..." : "Join family"}
      </button>
    </form>
  );
}
```

---

## Step 7 — AppShell (full implementation)

```typescript
// src/components/layout/AppShell.tsx
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import type { Family, FamilyMember } from "@/types";

interface AppShellProps {
  user: { uid: string; email: string };
  family: Family;
  members: FamilyMember[];
  children: React.ReactNode;
}

export function AppShell({ user, family, members, children }: AppShellProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar family={family} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} family={family} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

```typescript
// src/components/layout/Sidebar.tsx
import Link from "next/link";
import type { Family } from "@/types";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/assets", label: "Assets", icon: "💰" },
  { href: "/loans", label: "Loans", icon: "🤝" },
  { href: "/members", label: "Members", icon: "👥" },
];

export function Sidebar({ family }: { family: Family }) {
  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <p className="text-xs text-gray-500 uppercase tracking-wide">Family</p>
        <p className="font-semibold text-gray-900 truncate">{family.name}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium"
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

```typescript
// src/components/layout/Header.tsx
"use client";
import { logout } from "@/lib/auth.client";
import type { Family } from "@/types";

export function Header({
  user,
  family,
}: {
  user: { uid: string; email: string };
  family: Family;
}) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <span className="text-sm text-gray-500">Base currency: {family.baseCurrency}</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-700">{user.email}</span>
        <button
          onClick={() => logout()}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
```

---

## Step 8 — Minimal dashboard index page

```typescript
// src/app/(dashboard)/page.tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
      <p className="text-gray-500 mt-1">Dashboard coming in Phase 7.</p>
    </div>
  );
}
```

---

## Verification

- [ ] New user after login lands on `/onboarding`
- [ ] Creating a family redirects to `/dashboard` and shows the family name in the sidebar
- [ ] Revisiting `/onboarding` after having a family redirects to `/dashboard`
- [ ] `users/{uid}` and `families/{familyId}` documents exist in Firestore after creation
- [ ] The creator is stored as `role: "admin"` in `families/{familyId}/members/{uid}`
- [ ] The created family doc has a 6-character `inviteCode`
- [ ] Member docs include `displayName`, `email`, and `photoURL` (so `getFamilyMembers` resolves)
- [ ] Switching the onboarding toggle to "Join a family" shows the invite-code form
- [ ] Joining with a valid code adds the user as `role: "member"` and redirects to `/dashboard`
- [ ] An invalid or non-existent code shows an inline error and does not create a member doc
- [ ] Joining with a code for a family the user is already in is a no-op (no duplicate member)
