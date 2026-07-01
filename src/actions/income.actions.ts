"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteActivityForItem, logActivity } from "@/lib/activity.server";
import { requireUser } from "@/lib/auth.server";
import { formatCurrency } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { createIncome, getIncome, softDeleteIncome, updateIncome } from "@/lib/income.server";
import { canViewIncome } from "@/lib/visibility";

export type IncomeFormState = { errors?: Record<string, string[]> } | null;

const IncomeSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    currency: z.string().length(3, "Invalid currency"),
    amount: z.coerce.number().positive("Amount must be positive"),
    frequency: z.enum(["weekly", "monthly", "quarterly", "yearly", "one_off"]),
    receivedAt: z.string().optional(),
    description: z.string().max(500).optional().default(""),
    visibility: z.enum(["private", "shared"]).default("shared"),
  })
  .superRefine((d, ctx) => {
    if (d.frequency === "one_off" && !d.receivedAt) {
      ctx.addIssue({ code: "custom", path: ["receivedAt"], message: "Date is required" });
    }
  });

// Normalise a validated form into the shape persisted by the income helper.
// receivedAt is only stored for one-off income; recurring streams null it out.
function toIncomeData(data: z.infer<typeof IncomeSchema>) {
  return {
    name: data.name,
    currency: data.currency,
    amount: data.amount,
    frequency: data.frequency,
    receivedAt: data.frequency === "one_off" && data.receivedAt ? new Date(data.receivedAt) : null,
    description: data.description,
    visibility: data.visibility,
  };
}

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

export async function createIncomeAction(
  _prevState: IncomeFormState,
  formData: FormData,
): Promise<IncomeFormState> {
  const { user, family } = await getContextOrThrow();

  const members = await getFamilyMembers(family.id);
  if (members.find((m) => m.uid === user.uid)?.role === "viewer") {
    return { errors: { _: ["Viewers cannot add income"] } };
  }

  const parsed = IncomeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const incomeData = toIncomeData(parsed.data);
  const incomeId = await createIncome(family.id, user.uid, incomeData);

  await logActivity(
    family.id,
    "income_added",
    `Added income "${incomeData.name}" (${formatCurrency(incomeData.amount, incomeData.currency)})`,
    incomeData.visibility,
    incomeId,
  );

  revalidatePath("/income");
  revalidatePath("/dashboard");
  redirect(`/income/${incomeId}`);
}

export async function updateIncomeAction(
  incomeId: string,
  _prevState: IncomeFormState,
  formData: FormData,
): Promise<IncomeFormState> {
  const { user, family } = await getContextOrThrow();

  const existing = await getIncome(family.id, incomeId);
  if (!existing || !canViewIncome(existing, user.uid)) {
    return { errors: { _: ["Income not found"] } };
  }

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  const parsed = IncomeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const incomeData = toIncomeData(parsed.data);
  await updateIncome(family.id, incomeId, incomeData);

  if (incomeData.visibility === "private") {
    await deleteActivityForItem(family.id, incomeId);
  } else {
    await logActivity(
      family.id,
      "income_updated",
      `Updated income "${incomeData.name}"`,
      incomeData.visibility,
      incomeId,
    );
  }

  revalidatePath("/income");
  revalidatePath(`/income/${incomeId}`);
  revalidatePath("/dashboard");
  redirect(`/income/${incomeId}`);
}

export async function deleteIncomeAction(incomeId: string): Promise<void> {
  const { user, family } = await getContextOrThrow();

  const existing = await getIncome(family.id, incomeId);
  if (!existing || !canViewIncome(existing, user.uid)) throw new Error("Not found");

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  await softDeleteIncome(family.id, incomeId);
  revalidatePath("/income");
  revalidatePath("/dashboard");
  redirect("/income");
}
