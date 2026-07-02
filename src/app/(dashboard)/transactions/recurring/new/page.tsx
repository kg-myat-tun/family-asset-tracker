import { createRecurringRuleAction } from "@/actions/recurring-rules.actions";
import { RecurringRuleForm } from "@/components/transactions/RecurringRuleForm";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NewRecurringRulePage() {
  const { dict } = await getServerI18n();
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">
        {dict.transactions.recurring.addRuleTitle}
      </h1>
      <RecurringRuleForm
        action={createRecurringRuleAction}
        submitLabel={dict.transactions.recurring.createRule}
      />
    </div>
  );
}
