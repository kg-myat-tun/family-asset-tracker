"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth.server";
import { createFamily, joinFamilyByCode } from "@/lib/family.server";
import { ensureUserProfile } from "@/lib/user.server";

const CreateFamilySchema = z.object({
  name: z.string().min(1, "Family name is required").max(60),
  baseCurrency: z.string().length(3, "Select a currency"),
});

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
  await ensureUserProfile(user.uid);

  const parsed = JoinFamilySchema.safeParse({
    inviteCode: formData.get("inviteCode"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  try {
    await joinFamilyByCode(user.uid, parsed.data.inviteCode);
  } catch {
    return { error: { inviteCode: ["No family found for that invite code"] } };
  }

  redirect("/dashboard");
}
