import { notFound, redirect } from "next/navigation";
import { updateRecurringRuleAction } from "@/actions/recurring-rules.actions";
import { DeleteRecurringRuleButton } from "@/components/transactions/DeleteRecurringRuleButton";
import { PauseResumeButton } from "@/components/transactions/PauseResumeButton";
import { RecurringRuleForm } from "@/components/transactions/RecurringRuleForm";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getRecurringRule } from "@/lib/recurring.server";
import { canViewRecurringRule } from "@/lib/visibility";

export default async function EditRecurringRulePage({
  params,
}: {
  params: Promise<{ ruleId: string }>;
}) {
  const { ruleId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const rule = await getRecurringRule(family.id, ruleId);
  if (!rule || !canViewRecurringRule(rule, user.uid)) notFound();

  const members = await getFamilyMembers(family.id);
  const self = members.find((m) => m.uid === user.uid);
  const canMutate = rule.ownerId === user.uid || self?.role === "admin";
  if (!canMutate) redirect("/transactions/recurring");

  const boundAction = updateRecurringRuleAction.bind(null, rule.id);
  const { dict } = await getServerI18n();

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          {dict.transactions.recurring.editRuleTitle}
        </h1>
        <div className="flex items-center gap-3">
          <PauseResumeButton ruleId={rule.id} active={rule.active} />
          <DeleteRecurringRuleButton ruleId={rule.id} label={rule.name} />
        </div>
      </div>
      <RecurringRuleForm
        action={boundAction}
        defaultValues={rule}
        submitLabel={dict.common.saveChanges}
      />
    </div>
  );
}
