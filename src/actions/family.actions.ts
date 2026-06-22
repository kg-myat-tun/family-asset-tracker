"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth.server";
import { DEFAULT_MMK_PER_USD } from "@/lib/currency";
import { fetchCbmUsdRate } from "@/lib/currency.server";
import { createFamily, joinFamilyByCode, updateFamilySettings } from "@/lib/family.server";
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

const MmkRateSchema = z.object({
  // MMK per 1 USD. Upper bound guards against fat-finger entries.
  mmkPerUsd: z.coerce.number().positive("Enter a valid rate").max(1_000_000, "Rate too large"),
});

export type MmkRateState = { error?: string; ok?: boolean } | null;

export async function updateMmkRateAction(
  _prevState: MmkRateState,
  formData: FormData,
): Promise<MmkRateState> {
  const { family } = await requireAdmin();

  const parsed = MmkRateSchema.safeParse({ mmkPerUsd: formData.get("mmkPerUsd") });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.mmkPerUsd?.[0] ?? "Invalid rate" };
  }

  await updateFamilySettings(family.id, { mmkPerUsd: parsed.data.mmkPerUsd });
  // Rates feed every page's converted figures; refresh the whole tree.
  revalidatePath("/", "layout");
  return { ok: true };
}

// Re-seed the family's MMK rate from the latest CBM value (market fallback if down).
export async function refreshMmkRateFromCbmAction(
  _prevState: MmkRateState,
  _formData: FormData,
): Promise<MmkRateState> {
  const { family } = await requireAdmin();
  const rate = (await fetchCbmUsdRate()) ?? DEFAULT_MMK_PER_USD;
  await updateFamilySettings(family.id, { mmkPerUsd: rate });
  revalidatePath("/", "layout");
  return { ok: true };
}
