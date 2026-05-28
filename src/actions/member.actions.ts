"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { changeMemberRole, inviteMember, removeMember } from "@/lib/members.server";

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

export async function inviteMemberAction(_prevState: unknown, formData: FormData) {
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

export async function changeRoleAction(formData: FormData): Promise<void> {
  const { family } = await requireAdmin();

  const parsed = RoleSchema.safeParse({
    targetUid: formData.get("targetUid"),
    role: formData.get("role"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  await changeMemberRole(family.id, parsed.data.targetUid, parsed.data.role);
  revalidatePath("/members");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const { family } = await requireAdmin();
  const targetUid = formData.get("targetUid");
  if (typeof targetUid !== "string" || targetUid.length === 0) {
    throw new Error("Missing uid");
  }

  await removeMember(family.id, targetUid);
  revalidatePath("/members");
}
