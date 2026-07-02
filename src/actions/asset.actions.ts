"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteActivityForItem, logActivity } from "@/lib/activity.server";
import { isDynamicAsset, normalizeSymbol } from "@/lib/asset-price";
import { getAssetPrice } from "@/lib/asset-price.server";
import { createAsset, getAsset, softDeleteAsset, updateAsset } from "@/lib/assets.server";
import { requireUser } from "@/lib/auth.server";
import { formatCurrency } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { canViewAsset } from "@/lib/visibility";
import type { AssetCategory } from "@/types";

export type AssetFormState = { errors?: Record<string, string[]> } | null;

const AssetSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    category: z.enum(["cash", "bank", "investment", "property", "crypto", "stock", "other"]),
    currency: z.string().length(3, "Invalid currency"),
    amount: z.coerce.number().positive("Amount must be positive").optional(),
    symbol: z.string().min(1).max(15).optional(),
    quantity: z.coerce.number().positive("Quantity must be positive").optional(),
    description: z.string().max(500).optional().default(""),
    attachmentURL: z.string().url().optional().or(z.literal("")),
    visibility: z.enum(["private", "shared"]).default("shared"),
  })
  .superRefine((d, ctx) => {
    if (isDynamicAsset(d.category)) {
      // Stock/crypto: value comes from symbol × live price, not a typed amount.
      if (!d.symbol) {
        ctx.addIssue({ code: "custom", path: ["symbol"], message: "Symbol is required" });
      }
      if (d.quantity == null) {
        ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantity is required" });
      }
    } else if (d.amount == null) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Amount is required" });
    }
  });

// Normalise a validated form into the shape persisted by the assets helper.
// Dynamic assets are priced in USD; their `amount` is a snapshot (quantity ×
// live price, or 0 when the price feed is unavailable) used as an offline fallback.
async function toAssetData(data: z.infer<typeof AssetSchema>) {
  if (isDynamicAsset(data.category)) {
    const symbol = normalizeSymbol(data.symbol ?? "");
    const quantity = data.quantity ?? 0;
    const price = await getAssetPrice(data.category as AssetCategory, symbol);
    return {
      name: data.name,
      category: data.category,
      currency: "USD",
      amount: price != null ? price * quantity : 0,
      symbol,
      quantity,
      description: data.description,
      attachmentURL: data.attachmentURL || undefined,
      visibility: data.visibility,
    };
  }
  return {
    name: data.name,
    category: data.category,
    currency: data.currency,
    amount: data.amount ?? 0,
    symbol: null,
    quantity: null,
    description: data.description,
    attachmentURL: data.attachmentURL || undefined,
    visibility: data.visibility,
  };
}

async function getContextOrThrow() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) throw new Error("No family found");
  return { user, family };
}

// An asset can only be edited or deleted by its owner. Shared visibility only
// grants other members read access — even family admins cannot mutate it.
function assertCanMutate(ownerId: string, callerUid: string) {
  if (ownerId !== callerUid) throw new Error("Not authorized");
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

  const assetData = await toAssetData(parsed.data);
  const assetId = await createAsset(family.id, user.uid, assetData);

  await logActivity(
    family.id,
    "asset_added",
    `Added asset "${assetData.name}" (${formatCurrency(assetData.amount, assetData.currency)})`,
    assetData.visibility,
    assetId,
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

  assertCanMutate(existing.ownerId, user.uid);

  const parsed = AssetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const assetData = await toAssetData(parsed.data);
  await updateAsset(family.id, assetId, assetData);

  if (assetData.visibility === "private") {
    // Item is now hidden from the family — drop any activity it logged while shared.
    await deleteActivityForItem(family.id, assetId);
  } else {
    await logActivity(
      family.id,
      "asset_updated",
      `Updated asset "${assetData.name}"`,
      assetData.visibility,
      assetId,
    );
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  redirect(`/assets/${assetId}`);
}

export async function deleteAssetAction(assetId: string): Promise<void> {
  const { user, family } = await getContextOrThrow();

  const existing = await getAsset(family.id, assetId);
  if (!existing || !canViewAsset(existing, user.uid)) throw new Error("Not found");

  assertCanMutate(existing.ownerId, user.uid);

  await softDeleteAsset(family.id, assetId);
  revalidatePath("/assets");
  redirect("/assets");
}
