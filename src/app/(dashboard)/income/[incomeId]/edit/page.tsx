import { notFound, redirect } from "next/navigation";
import { updateIncomeAction } from "@/actions/income.actions";
import { IncomeForm } from "@/components/income/IncomeForm";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getIncome } from "@/lib/income.server";
import { canViewIncome } from "@/lib/visibility";

export default async function EditIncomePage({
  params,
}: {
  params: Promise<{ incomeId: string }>;
}) {
  const { incomeId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const income = await getIncome(family.id, incomeId);
  if (!income || !canViewIncome(income, user.uid)) notFound();

  const members = await getFamilyMembers(family.id);
  const self = members.find((m) => m.uid === user.uid);
  const canMutate = income.ownerId === user.uid || self?.role === "admin";
  if (!canMutate) redirect(`/income/${income.id}`);

  const boundAction = updateIncomeAction.bind(null, income.id);
  const { dict } = await getServerI18n();

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">{dict.income.editTitle}</h1>
      <IncomeForm
        action={boundAction}
        defaultValues={income}
        submitLabel={dict.common.saveChanges}
      />
    </div>
  );
}
