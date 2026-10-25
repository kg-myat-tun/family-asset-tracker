"use client";

import { toggleRecurringRuleActiveAction } from "@/actions/recurring-rules.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

export function PauseResumeButton({ ruleId, active }: { ruleId: string; active: boolean }) {
  const { dict } = useI18n();
  const action = toggleRecurringRuleActiveAction.bind(null, ruleId, !active);

  return (
    <form action={action}>
      <button type="submit" className="text-sm text-accent hover:underline">
        {active ? dict.transactions.recurring.pause : dict.transactions.recurring.resume}
      </button>
    </form>
  );
}
