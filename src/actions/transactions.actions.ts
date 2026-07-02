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
  createTransaction,
  getTransaction,
  softDeleteTransaction,
  updateTransaction,
} from "@/lib/transactions.server";
import { canViewTransaction } from "@/lib/visibility";

export type TransactionFormState = { errors?: Record<string, string[]> } | null;

const TransactionSchema = z
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
    date: z.string().min(1, "Date is required"),
    description: z.string().max(500).optional().default(""),
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

function toTransactionData(data: z.infer<typeof TransactionSchema>) {
  return {
    type: data.type,
    name: data.name,
    category: data.category,
    customLabel: data.category === "other" ? (data.customLabel ?? null) : null,
    currency: data.currency,
    amount: data.amount,
    date: new Date(data.date),
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

export async function createTransactionAction(
  _prevState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const { user, family } = await getContextOrThrow();

  const members = await getFamilyMembers(family.id);
  if (members.find((m) => m.uid === user.uid)?.role === "viewer") {
    return { errors: { _: ["Viewers cannot add transactions"] } };
  }

  const parsed = TransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const txData = toTransactionData(parsed.data);
  const transactionId = await createTransaction(family.id, user.uid, txData);

  await logActivity(
    family.id,
    "transaction_added",
    `${txData.type === "income" ? "Added income" : "Added expense"} "${txData.name}" (${formatCurrency(txData.amount, txData.currency)})`,
    txData.visibility,
    transactionId,
  );

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect(`/transactions/${transactionId}`);
}

export async function updateTransactionAction(
  transactionId: string,
  _prevState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const { user, family } = await getContextOrThrow();

  const existing = await getTransaction(family.id, transactionId);
  if (!existing || !canViewTransaction(existing, user.uid)) {
    return { errors: { _: ["Transaction not found"] } };
  }

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  const parsed = TransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const txData = toTransactionData(parsed.data);
  await updateTransaction(family.id, transactionId, txData);

  if (txData.visibility === "private") {
    await deleteActivityForItem(family.id, transactionId);
  } else {
    await logActivity(
      family.id,
      "transaction_updated",
      `Updated "${txData.name}"`,
      txData.visibility,
      transactionId,
    );
  }

  revalidatePath("/transactions");
  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/dashboard");
  redirect(`/transactions/${transactionId}`);
}

export async function deleteTransactionAction(transactionId: string): Promise<void> {
  const { user, family } = await getContextOrThrow();

  const existing = await getTransaction(family.id, transactionId);
  if (!existing || !canViewTransaction(existing, user.uid)) throw new Error("Not found");

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  await softDeleteTransaction(family.id, transactionId);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect("/transactions");
}
