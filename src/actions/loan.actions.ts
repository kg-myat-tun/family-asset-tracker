"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity.server";
import { requireUser } from "@/lib/auth.server";
import { formatCurrency } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { createLoan, getLoan, recordRepayment } from "@/lib/loans.server";

export type LoanFormState = { errors?: Record<string, string[]> } | null;

async function getContextOrThrow() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) throw new Error("No family");
  return { user, family };
}

const CreateLoanSchema = z.object({
  borrowerId: z.string().min(1, "Select a borrower"),
  currency: z.string().length(3),
  principalAmount: z.coerce.number().positive("Amount must be positive"),
  interestRate: z.coerce.number().min(0).max(100).optional(),
  description: z.string().min(1, "Description is required").max(300),
  dueDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

export async function createLoanAction(
  _prevState: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const { user, family } = await getContextOrThrow();

  const raw = Object.fromEntries(formData);
  // interestRate and dueDate are optional — drop empty strings before parsing
  if (raw.interestRate === "") delete (raw as Record<string, unknown>).interestRate;
  if (raw.dueDate === "") delete (raw as Record<string, unknown>).dueDate;

  const parsed = CreateLoanSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  if (parsed.data.borrowerId === user.uid) {
    return { errors: { borrowerId: ["You cannot lend to yourself"] } };
  }

  const members = await getFamilyMembers(family.id);
  if (!members.find((m) => m.uid === parsed.data.borrowerId)) {
    return { errors: { borrowerId: ["Borrower is not in your family"] } };
  }

  const loanId = await createLoan(family.id, {
    lenderId: user.uid,
    ...parsed.data,
  });

  const borrower = members.find((m) => m.uid === parsed.data.borrowerId);
  const lender = members.find((m) => m.uid === user.uid);
  await logActivity(
    family.id,
    "loan_created",
    `${lender?.displayName ?? "Someone"} lent ${formatCurrency(parsed.data.principalAmount, parsed.data.currency)} to ${borrower?.displayName ?? "someone"}`,
  );

  revalidatePath("/loans");
  redirect(`/loans/${loanId}`);
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
  );

  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/loans");
  redirect(`/loans/${loanId}`);
}
