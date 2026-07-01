import { createIncomeAction } from "@/actions/income.actions";
import { IncomeForm } from "@/components/income/IncomeForm";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NewIncomePage() {
  const { dict } = await getServerI18n();
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">{dict.income.addTitle}</h1>
      <IncomeForm action={createIncomeAction} submitLabel={dict.income.createIncome} />
    </div>
  );
}
