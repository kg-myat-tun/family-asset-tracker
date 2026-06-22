"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteActivityForItem, logActivity } from "@/lib/activity.server";
import { requireUser } from "@/lib/auth.server";
import { formatCurrency } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import {
  createLoan,
  deleteLoan,
  getLoan,
  getRepayments,
  recordRepayment,
  updateLoan,
} from "@/lib/loans.server";
import { canViewLoan } from "@/lib/visibility";
import type { Loan } from "@/types";

export type LoanFormState = { errors?: Record<string, string[]> } | null;

async function getContextOrThrow() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) throw new Error("No family");
  return { user, family };
}

// A loan can be edited or deleted by either participating family member, or by
// any family admin.
async function assertCanMutateLoan(familyId: string, loan: Loan, callerUid: string) {
  if (loan.lenderId === callerUid || loan.borrowerId === callerUid) return;
  const members = await getFamilyMembers(familyId);
  const self = members.find((m) => m.uid === callerUid);
  if (self?.role !== "admin") throw new Error("Not authorized");
}

const CreateLoanSchema = z
  .object({
    // "lent" = you lent to the counterparty; "borrowed" = you borrowed from them.
    direction: z.enum(["lent", "borrowed"]),
    // Counterparty is either an existing family member or an external person/org.
    counterpartyType: z.enum(["member", "external"]),
    counterpartyId: z.string().optional(),
    counterpartyName: z.string().max(120).optional(),
    visibility: z.enum(["private", "shared"]).default("shared"),
    currency: z.string().length(3),
    principalAmount: z.coerce.number().positive("Amount must be positive"),
    interestRate: z.coerce.number().min(0).max(100).optional(),
    compoundingPeriod: z.enum(["none", "monthly", "annually"]).default("none"),
    installmentCount: z.coerce.number().int().min(1).max(600).optional(),
    firstPaymentDate: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
    description: z.string().min(1, "Description is required").max(300),
    dueDate: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
  })
  .superRefine((data, ctx) => {
    if (data.counterpartyType === "member") {
      if (!data.counterpartyId) {
        ctx.addIssue({
          path: ["counterpartyId"],
          code: z.ZodIssueCode.custom,
          message: "Select a family member",
        });
      }
    } else if (!data.counterpartyName?.trim()) {
      ctx.addIssue({
        path: ["counterpartyName"],
        code: z.ZodIssueCode.custom,
        message: "Enter a name",
      });
    }
  });

export async function createLoanAction(
  _prevState: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const { user, family } = await getContextOrThrow();

  const raw = Object.fromEntries(formData);
  // Optional fields — drop empty strings before parsing.
  for (const key of ["interestRate", "dueDate", "installmentCount", "firstPaymentDate"]) {
    if (raw[key] === "") delete (raw as Record<string, unknown>)[key];
  }

  const parsed = CreateLoanSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { direction, counterpartyType, counterpartyId, currency, principalAmount } = parsed.data;
  const members = await getFamilyMembers(family.id);
  if (members.find((m) => m.uid === user.uid)?.role === "viewer") {
    return { errors: { _: ["Viewers cannot create loans"] } };
  }

  // Resolve the counterparty (the non-you side) into an id (member) or name (external).
  let counterId: string | null = null;
  let counterName: string | null = null;

  if (counterpartyType === "member") {
    if (counterpartyId === user.uid) {
      return { errors: { counterpartyId: ["You cannot pick yourself"] } };
    }
    if (!members.find((m) => m.uid === counterpartyId)) {
      return { errors: { counterpartyId: ["That person is not in your family"] } };
    }
    counterId = counterpartyId ?? null;
  } else {
    counterName = parsed.data.counterpartyName?.trim() ?? null;
  }

  // You are always one party; the counterparty is the other, per direction.
  const party = {
    lenderId: direction === "lent" ? user.uid : counterId,
    borrowerId: direction === "lent" ? counterId : user.uid,
    lenderName: direction === "lent" ? null : counterName,
    borrowerName: direction === "lent" ? counterName : null,
  };

  const loanId = await createLoan(family.id, {
    ...party,
    visibility: parsed.data.visibility,
    currency: parsed.data.currency,
    principalAmount: parsed.data.principalAmount,
    interestRate: parsed.data.interestRate,
    compoundingPeriod: parsed.data.compoundingPeriod,
    installmentCount: parsed.data.installmentCount,
    firstPaymentDate: parsed.data.firstPaymentDate,
    description: parsed.data.description,
    dueDate: parsed.data.dueDate,
  });

  const selfName = members.find((m) => m.uid === user.uid)?.displayName ?? "Someone";
  const counterLabel =
    counterpartyType === "member"
      ? (members.find((m) => m.uid === counterId)?.displayName ?? "someone")
      : (counterName ?? "someone");
  const amount = formatCurrency(principalAmount, currency);
  const message =
    direction === "lent"
      ? `${selfName} lent ${amount} to ${counterLabel}`
      : `${selfName} borrowed ${amount} from ${counterLabel}`;
  await logActivity(family.id, "loan_created", message, parsed.data.visibility, loanId);

  revalidatePath("/loans");
  redirect(`/loans/${loanId}`);
}

const UpdateLoanSchema = z.object({
  visibility: z.enum(["private", "shared"]).default("shared"),
  description: z.string().min(1, "Description is required").max(300),
  interestRate: z.coerce.number().min(0).max(100).optional(),
  compoundingPeriod: z.enum(["none", "monthly", "annually"]).default("none"),
  installmentCount: z.coerce.number().int().min(1).max(600).optional(),
  firstPaymentDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  dueDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  principalAmount: z.coerce.number().positive("Amount must be positive").optional(),
  currency: z.string().length(3).optional(),
});

export async function updateLoanAction(
  loanId: string,
  _prevState: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const { user, family } = await getContextOrThrow();

  const loan = await getLoan(family.id, loanId);
  if (!loan || !canViewLoan(loan, user.uid)) return { errors: { _: ["Loan not found"] } };
  await assertCanMutateLoan(family.id, loan, user.uid);

  const raw = Object.fromEntries(formData);
  for (const key of [
    "interestRate",
    "dueDate",
    "principalAmount",
    "installmentCount",
    "firstPaymentDate",
  ]) {
    if (raw[key] === "") delete (raw as Record<string, unknown>)[key];
  }

  const parsed = UpdateLoanSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // Principal and currency can only be amended before any repayment is recorded;
  // afterwards they would desync the balance, so silently ignore them.
  const repayments = await getRepayments(family.id, loanId);
  const editableAmount = repayments.length === 0;

  const compoundingPeriod = parsed.data.interestRate ? parsed.data.compoundingPeriod : "none";

  await updateLoan(family.id, loanId, {
    description: parsed.data.description,
    visibility: parsed.data.visibility,
    dueDate: parsed.data.dueDate ?? null,
    interestRate: parsed.data.interestRate ?? null,
    compoundingPeriod,
    installmentCount: parsed.data.installmentCount ?? null,
    firstPaymentDate: parsed.data.firstPaymentDate ?? null,
    principalAmount: editableAmount ? parsed.data.principalAmount : undefined,
    currency: editableAmount ? parsed.data.currency : undefined,
  });

  if (parsed.data.visibility === "private") {
    // Loan is now hidden from the family — drop any activity it logged while shared.
    await deleteActivityForItem(family.id, loanId);
  } else {
    await logActivity(
      family.id,
      "loan_updated",
      `Updated loan "${parsed.data.description}"`,
      parsed.data.visibility,
      loanId,
    );
  }

  revalidatePath("/loans");
  revalidatePath(`/loans/${loanId}`);
  redirect(`/loans/${loanId}`);
}

export async function deleteLoanAction(loanId: string): Promise<void> {
  const { user, family } = await getContextOrThrow();

  const loan = await getLoan(family.id, loanId);
  if (!loan || !canViewLoan(loan, user.uid)) throw new Error("Not found");
  await assertCanMutateLoan(family.id, loan, user.uid);

  await deleteLoan(family.id, loanId);
  await logActivity(
    family.id,
    "loan_deleted",
    `Deleted loan "${loan.description}"`,
    loan.visibility,
    loanId,
  );

  revalidatePath("/loans");
  redirect("/loans");
}

const RepaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().length(3),
  note: z.string().max(300).optional().default(""),
});

export async function recordRepaymentAction(
  loanId: string,
  _prevState: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const { user, family } = await getContextOrThrow();

  const loan = await getLoan(family.id, loanId);
  if (!loan) return { errors: { _: ["Loan not found"] } };

  if (loan.lenderId !== user.uid && loan.borrowerId !== user.uid) {
    return { errors: { _: ["Not authorized"] } };
  }

  const members = await getFamilyMembers(family.id);
  if (members.find((m) => m.uid === user.uid)?.role === "viewer") {
    return { errors: { _: ["Viewers cannot record repayments"] } };
  }

  const parsed = RepaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await recordRepayment(family.id, loanId, {
    ...parsed.data,
    recordedBy: user.uid,
  });

  await logActivity(
    family.id,
    "repayment_made",
    `Repayment of ${formatCurrency(parsed.data.amount, parsed.data.currency)} recorded on "${loan.description}"`,
    loan.visibility,
    loanId,
  );

  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/loans");
  redirect(`/loans/${loanId}`);
}
