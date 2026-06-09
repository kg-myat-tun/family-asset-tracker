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
  // interestRate and dueDate are optional — drop empty strings before parsing
  if (raw.interestRate === "") delete (raw as Record<string, unknown>).interestRate;
  if (raw.dueDate === "") delete (raw as Record<string, unknown>).dueDate;

  const parsed = CreateLoanSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { direction, counterpartyType, counterpartyId, currency, principalAmount } = parsed.data;
  const members = await getFamilyMembers(family.id);

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
  await logActivity(family.id, "loan_created", message);

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
