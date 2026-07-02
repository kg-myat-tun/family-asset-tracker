"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteActivityForItem, logActivity } from "@/lib/activity.server";
import { requireUser } from "@/lib/auth.server";
import { SUPPORTED_EXPENSE_CATEGORIES, SUPPORTED_INCOME_CATEGORIES } from "@/lib/cashflow";
import { formatCurrency } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import {
  createRecurringRule,
  getRecurringRule,
  softDeleteRecurringRule,
  updateRecurringRule,
} from "@/lib/recurring.server";
import { canViewRecurringRule } from "@/lib/visibility";

export type RecurringRuleFormState = { errors?: Record<string, string[]> } | null;

const RecurringRuleSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    name: z.string().min(1, "Name is required").max(100),
    category: z.enum([
      "salary",
      "bonus",
      "gift",
      "investment",
      "housing",
      "groceries",
      "utilities",
      "transport",
      "healthcare",
      "entertainment",
      "debt",
      "other",
    ]),
    customLabel: z.string().max(100).optional(),
    currency: z.string().length(3, "Invalid currency"),
    amount: z.coerce.number().positive("Amount must be positive"),
    frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
    visibility: z.enum(["private", "shared"]).default("shared"),
  })
  .superRefine((d, ctx) => {
    const valid: readonly string[] =
      d.type === "income" ? SUPPORTED_INCOME_CATEGORIES : SUPPORTED_EXPENSE_CATEGORIES;
    if (!valid.includes(d.category)) {
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: "Invalid category for this type",
      });
    }
    if (d.category === "other" && !d.customLabel) {
      ctx.addIssue({
        code: "custom",
        path: ["customLabel"],
        message: "Label is required for Other",
      });
    }
  });

function toRuleData(data: z.infer<typeof RecurringRuleSchema>) {
  return {
    type: data.type,
    name: data.name,
    category: data.category,
    customLabel: data.category === "other" ? (data.customLabel ?? null) : null,
    currency: data.currency,
    amount: data.amount,
    frequency: data.frequency,
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

export async function createRecurringRuleAction(
  _prevState: RecurringRuleFormState,
  formData: FormData,
): Promise<RecurringRuleFormState> {
  const { user, family } = await getContextOrThrow();

  const members = await getFamilyMembers(family.id);
  if (members.find((m) => m.uid === user.uid)?.role === "viewer") {
    return { errors: { _: ["Viewers cannot add recurring rules"] } };
  }

  const parsed = RecurringRuleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const ruleData = toRuleData(parsed.data);
  const ruleId = await createRecurringRule(family.id, user.uid, ruleData);

  await logActivity(
    family.id,
    "recurring_rule_added",
    `Added recurring ${ruleData.type} "${ruleData.name}" (${formatCurrency(ruleData.amount, ruleData.currency)}/${ruleData.frequency})`,
    ruleData.visibility,
    ruleId,
  );

  revalidatePath("/transactions/recurring");
  revalidatePath("/transactions");
  redirect("/transactions/recurring");
}

export async function updateRecurringRuleAction(
  ruleId: string,
  _prevState: RecurringRuleFormState,
  formData: FormData,
): Promise<RecurringRuleFormState> {
  const { user, family } = await getContextOrThrow();

  const existing = await getRecurringRule(family.id, ruleId);
  if (!existing || !canViewRecurringRule(existing, user.uid)) {
    return { errors: { _: ["Recurring rule not found"] } };
  }

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  const parsed = RecurringRuleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const ruleData = toRuleData(parsed.data);
  await updateRecurringRule(family.id, ruleId, ruleData);

  if (ruleData.visibility === "private") {
    await deleteActivityForItem(family.id, ruleId);
  } else {
    await logActivity(
      family.id,
      "recurring_rule_updated",
      `Updated recurring ${ruleData.type} "${ruleData.name}"`,
      ruleData.visibility,
      ruleId,
    );
  }

  revalidatePath("/transactions/recurring");
  revalidatePath("/transactions");
  redirect("/transactions/recurring");
}

export async function deleteRecurringRuleAction(ruleId: string): Promise<void> {
  const { user, family } = await getContextOrThrow();

  const existing = await getRecurringRule(family.id, ruleId);
  if (!existing || !canViewRecurringRule(existing, user.uid)) throw new Error("Not found");

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  await softDeleteRecurringRule(family.id, ruleId);
  revalidatePath("/transactions/recurring");
  revalidatePath("/transactions");
  redirect("/transactions/recurring");
}

// Lightweight toggle for the pause/resume button — a full form resubmit would
// be overkill for flipping one boolean.
export async function toggleRecurringRuleActiveAction(
  ruleId: string,
  active: boolean,
): Promise<void> {
  const { user, family } = await getContextOrThrow();

  const existing = await getRecurringRule(family.id, ruleId);
  if (!existing || !canViewRecurringRule(existing, user.uid)) throw new Error("Not found");

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  await updateRecurringRule(family.id, ruleId, { active });
  revalidatePath("/transactions/recurring");
}
