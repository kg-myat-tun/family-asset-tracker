"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity.server";
import { createAsset, getAsset, softDeleteAsset, updateAsset } from "@/lib/assets.server";
import { requireUser } from "@/lib/auth.server";
import { formatCurrency } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { canViewAsset } from "@/lib/visibility";

export type AssetFormState = { errors?: Record<string, string[]> } | null;

const AssetSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  category: z.enum(["cash", "bank", "investment", "property", "crypto", "other"]),
  currency: z.string().length(3, "Invalid currency"),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().max(500).optional().default(""),
  attachmentURL: z.string().url().optional().or(z.literal("")),
  visibility: z.enum(["private", "shared"]).default("shared"),
});

async function getContextOrThrow() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) throw new Error("No family found");
  return { user, family };
}

async function assertCanMutate(familyId: string, ownerId: string, callerUid: string) {
  if (ownerId === callerUid) return;
  const members = await getFamilyMembers(familyId);
  const self = members.find((m) => m.uid === callerUid);
  if (self?.role !== "admin") throw new Error("Not authorized");
}

export async function createAssetAction(
  _prevState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const { user, family } = await getContextOrThrow();

  const members = await getFamilyMembers(family.id);
  if (members.find((m) => m.uid === user.uid)?.role === "viewer") {
    return { errors: { _: ["Viewers cannot add assets"] } };
  }

  const parsed = AssetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const assetId = await createAsset(family.id, user.uid, {
    ...parsed.data,
    attachmentURL: parsed.data.attachmentURL || undefined,
  });

  await logActivity(
    family.id,
    "asset_added",
    `Added asset "${parsed.data.name}" (${formatCurrency(parsed.data.amount, parsed.data.currency)})`,
    parsed.data.visibility,
  );

  revalidatePath("/assets");
  redirect(`/assets/${assetId}`);
}

export async function updateAssetAction(
  assetId: string,
  _prevState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const { user, family } = await getContextOrThrow();

  const existing = await getAsset(family.id, assetId);
  if (!existing || !canViewAsset(existing, user.uid)) {
    return { errors: { _: ["Asset not found"] } };
  }

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  const parsed = AssetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await updateAsset(family.id, assetId, {
    ...parsed.data,
    attachmentURL: parsed.data.attachmentURL || undefined,
  });

  await logActivity(
    family.id,
    "asset_updated",
    `Updated asset "${parsed.data.name}"`,
    parsed.data.visibility,
  );

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  redirect(`/assets/${assetId}`);
}

export async function deleteAssetAction(assetId: string): Promise<void> {
  const { user, family } = await getContextOrThrow();

  const existing = await getAsset(family.id, assetId);
  if (!existing || !canViewAsset(existing, user.uid)) throw new Error("Not found");

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  await softDeleteAsset(family.id, assetId);
  revalidatePath("/assets");
  redirect("/assets");
}
