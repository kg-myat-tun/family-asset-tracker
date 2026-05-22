# Phase 4 — Members Management

## Goal
Implement the full member lifecycle: list all family members, invite by email, change roles, remove members, and upload profile pictures to Firebase Storage. By the end, admins have full control over who is in the family and with what permissions.

---

## Step 1 — Members lib (server)

```typescript
// src/lib/members.server.ts
import "server-only";
import { adminDb, adminAuth } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { FamilyMember, Role } from "@/types";

export async function inviteMember(
  familyId: string,
  inviterUid: string,
  email: string
): Promise<void> {
  // Check if a user with this email already exists
  let targetUid: string | null = null;
  try {
    const existingUser = await adminAuth.getUserByEmail(email);
    targetUid = existingUser.uid;
  } catch {
    // User doesn't exist yet — invite is pending
  }

  if (targetUid) {
    // User exists — add directly as member
    const memberRef = adminDb.doc(`families/${familyId}/members/${targetUid}`);
    const existing = await memberRef.get();
    if (existing.exists) throw new Error("User is already a member");

    const batch = adminDb.batch();
    batch.set(memberRef, {
      role: "member",
      status: "active",
      joinedAt: FieldValue.serverTimestamp(),
    });
    const userRef = adminDb.doc(`users/${targetUid}`);
    batch.set(userRef, { familyIds: FieldValue.arrayUnion(familyId) }, { merge: true });
    await batch.commit();
  } else {
    // Create pending invite doc — Cloud Function will send the email
    const inviteRef = adminDb.collection(`families/${familyId}/invites`).doc();
    await inviteRef.set({
      email,
      invitedBy: inviterUid,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

export async function changeMemberRole(
  familyId: string,
  targetUid: string,
  newRole: Role
): Promise<void> {
  await adminDb.doc(`families/${familyId}/members/${targetUid}`).update({ role: newRole });
}

export async function removeMember(familyId: string, targetUid: string): Promise<void> {
  const batch = adminDb.batch();
  batch.update(adminDb.doc(`families/${familyId}/members/${targetUid}`), {
    status: "removed",
  });
  batch.update(adminDb.doc(`users/${targetUid}`), {
    familyIds: FieldValue.arrayRemove(familyId),
  });
  await batch.commit();
}

export async function getMemberWithAssetCount(
  familyId: string,
  uid: string
): Promise<FamilyMember & { assetCount: number }> {
  const [memberSnap, assetsSnap] = await Promise.all([
    adminDb.doc(`families/${familyId}/members/${uid}`).get(),
    adminDb
      .collection(`families/${familyId}/assets`)
      .where("ownerId", "==", uid)
      .where("deleted", "==", false)
      .get(),
  ]);

  const d = memberSnap.data()!;
  const authUser = await adminAuth.getUser(uid);

  return {
    uid,
    displayName: authUser.displayName ?? authUser.email ?? "Unknown",
    email: authUser.email ?? "",
    photoURL: authUser.photoURL ?? null,
    role: d.role,
    status: d.status,
    joinedAt: d.joinedAt.toDate(),
    assetCount: assetsSnap.size,
  };
}
```

---

## Step 2 — Member Server Actions

```typescript
// src/actions/member.actions.ts
"use server";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { inviteMember, changeMemberRole, removeMember } from "@/lib/members.server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Helper: assert caller is admin
async function requireAdmin() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) throw new Error("No family");

  const members = await getFamilyMembers(family.id);
  const self = members.find((m) => m.uid === user.uid);
  if (self?.role !== "admin") throw new Error("Admin only");

  return { user, family };
}

const InviteSchema = z.object({
  email: z.string().email(),
});

export async function inviteMemberAction(formData: FormData) {
  const { user, family } = await requireAdmin();

  const parsed = InviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Invalid email" };

  try {
    await inviteMember(family.id, user.uid, parsed.data.email);
    revalidatePath("/members");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to invite" };
  }
}

const RoleSchema = z.object({
  targetUid: z.string().min(1),
  role: z.enum(["admin", "member", "viewer"]),
});

export async function changeRoleAction(formData: FormData) {
  const { family } = await requireAdmin();

  const parsed = RoleSchema.safeParse({
    targetUid: formData.get("targetUid"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  await changeMemberRole(family.id, parsed.data.targetUid, parsed.data.role);
  revalidatePath("/members");
  return { success: true };
}

export async function removeMemberAction(formData: FormData) {
  const { family } = await requireAdmin();
  const targetUid = formData.get("targetUid") as string;
  if (!targetUid) return { error: "Missing uid" };

  await removeMember(family.id, targetUid);
  revalidatePath("/members");
  return { success: true };
}
```

---

## Step 3 — Members page (Server Component)

```typescript
// src/app/(dashboard)/members/page.tsx
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getMemberWithAssetCount } from "@/lib/members.server";
import { MemberCard } from "@/components/members/MemberCard";
import { InviteForm } from "@/components/members/InviteForm";

export default async function MembersPage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const members = await getFamilyMembers(family.id);
  const membersWithCounts = await Promise.all(
    members.map((m) => getMemberWithAssetCount(family.id, m.uid))
  );

  const currentMember = membersWithCounts.find((m) => m.uid === user.uid);
  const isAdmin = currentMember?.role === "admin";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Members</h1>
        {isAdmin && <InviteForm />}
      </div>

      <div className="space-y-3">
        {membersWithCounts.map((member) => (
          <MemberCard
            key={member.uid}
            member={member}
            isAdmin={isAdmin}
            isSelf={member.uid === user.uid}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Step 4 — Member components

```typescript
// src/components/members/MemberCard.tsx
"use client";
import Image from "next/image";
import { useActionState } from "react";
import { changeRoleAction, removeMemberAction } from "@/actions/member.actions";
import type { FamilyMember, Role } from "@/types";

interface Props {
  member: FamilyMember & { assetCount: number };
  isAdmin: boolean;
  isSelf: boolean;
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-purple-100 text-purple-700",
  member: "bg-blue-100 text-blue-700",
  viewer: "bg-gray-100 text-gray-700",
};

export function MemberCard({ member, isAdmin, isSelf }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
        {member.photoURL ? (
          <Image src={member.photoURL} alt={member.displayName} width={40} height={40} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium">
            {member.displayName[0]?.toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 truncate">{member.displayName}</p>
          {isSelf && <span className="text-xs text-gray-400">(you)</span>}
        </div>
        <p className="text-sm text-gray-500 truncate">{member.email}</p>
        <p className="text-xs text-gray-400">{member.assetCount} assets</p>
      </div>

      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[member.role]}`}>
        {ROLE_LABELS[member.role]}
      </span>

      {isAdmin && !isSelf && (
        <div className="flex gap-2">
          <form action={changeRoleAction}>
            <input type="hidden" name="targetUid" value={member.uid} />
            <select
              name="role"
              defaultValue={member.role}
              onChange={(e) => {
                const form = e.target.closest("form") as HTMLFormElement;
                form.requestSubmit();
              }}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </form>

          <form action={removeMemberAction}>
            <input type="hidden" name="targetUid" value={member.uid} />
            <button
              type="submit"
              className="text-sm text-red-500 hover:text-red-700 px-2 py-1"
              onClick={(e) => {
                if (!confirm(`Remove ${member.displayName}?`)) e.preventDefault();
              }}
            >
              Remove
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
```

```typescript
// src/components/members/InviteForm.tsx
"use client";
import { useActionState } from "react";
import { inviteMemberAction } from "@/actions/member.actions";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteMemberAction, null);

  return (
    <form action={action} className="flex gap-2">
      <input
        name="email"
        type="email"
        placeholder="name@example.com"
        required
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Inviting..." : "Invite"}
      </button>
      {state?.error && <p className="text-sm text-red-500 self-center">{state.error}</p>}
    </form>
  );
}
```

---

## Step 5 — Profile picture upload (Client Component)

```typescript
// src/components/members/AvatarUpload.tsx
"use client";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { auth, storage } from "@/firebase/client";
import { useState } from "react";

export function AvatarUpload({ uid }: { uid: string }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate: image only, max 2MB
    if (!file.type.startsWith("image/")) return alert("Images only");
    if (file.size > 2 * 1024 * 1024) return alert("Max 2MB");

    setUploading(true);
    const storageRef = ref(storage, `avatars/${uid}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { console.error(err); setUploading(false); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        // Update Firebase Auth profile
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { photoURL: url });
        }
        // Also update Firestore via Server Action (call a route or action)
        await fetch("/api/user/avatar", {
          method: "POST",
          body: JSON.stringify({ photoURL: url }),
          headers: { "Content-Type": "application/json" },
        });
        setUploading(false);
        window.location.reload();
      }
    );
  }

  return (
    <label className="cursor-pointer">
      <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <span className="text-sm text-blue-600 hover:underline">
        {uploading ? `Uploading ${progress}%...` : "Change photo"}
      </span>
    </label>
  );
}
```

Create the Route Handler that saves the URL to Firestore:

```typescript
// src/app/api/user/avatar/route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth.server";
import { adminDb } from "@/firebase/admin";

export async function POST(request: Request) {
  const user = await requireUser();
  const { photoURL } = await request.json();

  if (!photoURL || typeof photoURL !== "string") {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  await adminDb.doc(`users/${user.uid}`).update({ photoURL });
  return NextResponse.json({ ok: true });
}
```

---

## Step 6 — loading.tsx and error.tsx

```typescript
// src/app/(dashboard)/members/loading.tsx
export default function MembersLoading() {
  return (
    <div className="max-w-3xl space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

```typescript
// src/app/(dashboard)/members/error.tsx
"use client";
export default function MembersError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500 mb-4">Failed to load members: {error.message}</p>
      <button onClick={reset} className="text-blue-600 hover:underline">Try again</button>
    </div>
  );
}
```

---

## Verification

- [ ] `/members` shows all active members with their asset counts
- [ ] Admin can invite by email — if user exists, they're added immediately; if not, an invite doc is created
- [ ] Admin can change roles — change persists and UI updates
- [ ] Admin can remove a member — member status becomes "removed", they lose dashboard access
- [ ] Non-admin cannot see the invite form or role/remove controls
- [ ] Avatar upload stores photo in Firebase Storage and updates Firestore
- [ ] Loading skeleton shows during data fetch
